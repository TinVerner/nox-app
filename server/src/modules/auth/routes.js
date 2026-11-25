import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../shared/prisma.js'
import { playerGameStats } from '../rating/list.js'
import { userJson } from '../users/user-json.js'
import { clearSessionCookie, findUserByEmail, meOrNull, normalizeEmail, openSession, passwordMeetsRules } from './session.js'

const router = Router()

router.get('/me', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  res.json(userJson(me))
})

router.get('/me/stats', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  const stats = await playerGameStats(me.id)
  res.json(stats || { points: 0, games: 0, wins: 0, winRate: null, byRole: [] })
})

router.patch('/me', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  const nick = String(req.body.nick ?? '').trim()
  const email = normalizeEmail(req.body.email)
  const login = normalizeEmail(req.body.login ?? email)
  const phone = String(req.body.phone ?? '').trim()
  if (!nick || !email || !login) return res.status(400).json({ error: 'Заполни поля' })
  if (login !== email) return res.status(400).json({ error: 'Логин — это email для входа' })
  if (nick.length > 100) return res.status(400).json({ error: 'ник слишком длинный' })
  if (phone.length > 30) return res.status(400).json({ error: 'телефон слишком длинный' })
  const taken = await findUserByEmail(email)
  if (taken && taken.id !== me.id) return res.status(409).json({ error: 'email занят' })
  try {
    const user = await prisma.user.update({
      where: { id: me.id },
      data: { displayName: nick, email, phone: phone || null },
    })
    res.json(userJson(user))
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'email занят' })
    throw error
  }
})

router.post('/me/password', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  const currentPassword = String(req.body.currentPassword ?? '')
  const newPassword = String(req.body.newPassword ?? '')
  const confirm = String(req.body.confirm ?? '')
  if (!currentPassword || !newPassword || !confirm) return res.status(400).json({ error: 'Заполни поля' })
  if (newPassword !== confirm) return res.status(400).json({ error: 'Пароли не совпали' })
  if (!passwordMeetsRules(newPassword)) {
    return res.status(400).json({
      error: 'Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол',
    })
  }
  const ok = await bcrypt.compare(currentPassword, me.passwordHash)
  if (!ok) return res.status(400).json({ error: 'Неверный текущий пароль' })
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } })
  res.json({ ok: true })
})

router.post('/logout', async (req, res) => {
  if (req.sessionId) await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {})
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.post('/register', async (req, res) => {
  const { password, nick } = req.body
  const email = normalizeEmail(req.body.email)
  if (!email || !password || !nick) return res.status(400).json({ error: 'email, password, nick обязательны' })
  if (!passwordMeetsRules(password)) {
    return res.status(400).json({
      error: 'Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол',
    })
  }
  if (await findUserByEmail(email)) return res.status(409).json({ error: 'email занят' })
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
  const email = normalizeEmail(req.body.email)
  const password = req.body.password
  if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' })
  const user = await findUserByEmail(email)
  if (!user) return res.status(401).json({ error: 'неверный email или пароль' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'неверный email или пароль' })
  if (user.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  await openSession(res, user.id)
  res.json(userJson(user))
})

export default router
