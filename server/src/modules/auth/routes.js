import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../shared/prisma.js'
import { rankCodes } from '../ranks/defs.js'
import { userJson } from '../users/user-json.js'
import { clearSessionCookie, meOrNull, openSession, passwordMeetsRules } from './session.js'

const router = Router()

router.get('/me', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  const codes = await rankCodes([me.id])
  res.json(userJson(me, codes.get(me.id)))
})

router.post('/logout', async (req, res) => {
  if (req.sessionId) await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {})
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.post('/register', async (req, res) => {
  const { email, password, nick } = req.body
  if (!email || !password || !nick) return res.status(400).json({ error: 'email, password, nick обязательны' })
  if (!passwordMeetsRules(password)) {
    return res.status(400).json({
      error: 'Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол',
    })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: String(nick).trim(), role: 'PLAYER' },
    })
    res.status(201).json({ id: user.id, email: user.email, nick: user.displayName, role: user.role })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'email занят' })
    throw error
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' })
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'неверный email или пароль' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'неверный email или пароль' })
  if (user.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  await openSession(res, user.id)
  const codes = await rankCodes([user.id])
  res.json(userJson(user, codes.get(user.id)))
})

export default router
