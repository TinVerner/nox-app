import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isStaff, meOrNull } from '../auth/session.js'
import { ensureRanks, rankCodes } from '../ranks/defs.js'
import { ratingList } from '../rating/list.js'

const router = Router()

router.get('/members', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'нельзя' })
  await ensureRanks()
  const members = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    orderBy: { displayName: 'asc' },
  })
  const codes = await rankCodes(members.map((member) => member.id))
  res.json(members.map((member) => ({
    id: member.id,
    nick: member.displayName,
    role: member.role,
    rank: codes.get(member.id) || null,
  })))
})

router.get('/members/:id', async (req, res) => {
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user || user.role === 'ADMIN') return res.status(404).json({ error: 'не найдено' })
  const codes = await rankCodes([user.id])
  const row = (await ratingList()).find((item) => item.id === user.id)
  res.json({
    id: user.id,
    nick: user.displayName,
    role: user.role,
    rank: codes.get(user.id) || null,
    rating: row ? { points: row.points, games: row.games } : null,
  })
})

export default router
