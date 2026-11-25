import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
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
  res.json(users.map((user) => userJson(user)))
})

router.patch('/users/:id/role', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const role = req.body.role
  if (!['PLAYER', 'HOST', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'роль: PLAYER, HOST или ADMIN' })
  const id = idParam(req.params.id)
  // Иначе единственный админ может лишить клуб админа одним кликом.
  if (id === me.id) return res.status(400).json({ error: 'нельзя менять свою роль' })
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({ where: { id }, data: { role } })
  res.json(userJson(updated))
})

router.patch('/users/:id/bonus', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  if (user.role === 'ADMIN') return res.status(404).json({ error: 'не найдено' })
  const bonus = Number(req.body.bonus)
  if (!Number.isFinite(bonus)) return res.status(400).json({ error: 'нужен баланс' })
  const updated = await prisma.user.update({ where: { id }, data: { bonusBalance: bonus } })
  res.json(userJson(updated))
})

router.patch('/users/:id/block', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const id = idParam(req.params.id)
  if (id === me.id) return res.status(400).json({ error: 'нельзя заблокировать себя' })
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({
    where: { id },
    data: { status: req.body.blocked ? 'BLOCKED' : 'ACTIVE' },
  })
  res.json(userJson(updated))
})

export default router
