import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'
import { rankCodes } from '../ranks/defs.js'
import { userJson } from './user-json.js'

const router = Router()

router.get('/users', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const where = {}
  const role = req.query.role
  if (role === 'PLAYER' || role === 'HOST' || role === 'ADMIN') where.role = role
  const q = String(req.query.q || '').trim()
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  const users = await prisma.user.findMany({ where, orderBy: { displayName: 'asc' } })
  const codes = await rankCodes(users.map((user) => user.id))
  res.json(users.map((user) => userJson(user, codes.get(user.id))))
})

router.patch('/users/:id/role', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const role = req.body.role
  if (!['PLAYER', 'HOST', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'роль: PLAYER, HOST или ADMIN' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({ where: { id }, data: { role } })
  const codes = await rankCodes([id])
  res.json(userJson(updated, codes.get(id)))
})

router.patch('/users/:id/bonus', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const bonus = Number(req.body.bonus)
  if (!Number.isFinite(bonus)) return res.status(400).json({ error: 'нужен баланс' })
  const updated = await prisma.user.update({ where: { id }, data: { bonusBalance: bonus } })
  const codes = await rankCodes([id])
  res.json(userJson(updated, codes.get(id)))
})

router.patch('/users/:id/block', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({
    where: { id },
    data: { status: req.body.blocked ? 'BLOCKED' : 'ACTIVE' },
  })
  const codes = await rankCodes([id])
  res.json(userJson(updated, codes.get(id)))
})

export default router
