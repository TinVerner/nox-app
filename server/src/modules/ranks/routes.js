import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { RANK_LABEL, ensureRanks } from './defs.js'

const router = Router()

router.patch('/members/:id/rank', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  await ensureRanks()
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const rank = req.body.rank || null
  // пустое значение снимает подтверждённый ранг; новый ранг идёт через заявку
  if (rank) return res.status(400).json({ error: 'ранг подтверждается по заявке' })
  await prisma.userRank.deleteMany({ where: { userId: user.id, status: 'CONFIRMED' } })
  res.json({ id: user.id, nick: user.displayName, role: user.role, rank: null })
})

router.get('/rank-requests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const where = isHost(me) ? { status: 'PENDING' } : { userId: me.id }
  const rows = await prisma.userRank.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    include: { user: { select: { displayName: true } }, rank: true },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    nick: row.user.displayName,
    rank: row.rank.code,
    label: row.rank.name,
    status: row.status,
    requestedAt: row.requestedAt,
  })))
})

router.post('/rank-requests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'PLAYER') return res.status(403).json({ error: 'заявку подаёт игрок' })
  await ensureRanks()
  const code = req.body.rank
  if (!RANK_LABEL[code]) return res.status(400).json({ error: 'неизвестный ранг' })
  const definition = await prisma.rankDefinition.findUnique({ where: { code } })
  const pending = await prisma.userRank.findFirst({
    where: { userId: me.id, rankId: definition.id, status: 'PENDING' },
  })
  if (pending) return res.status(409).json({ error: 'заявка уже есть' })
  const row = await prisma.userRank.create({
    data: { userId: me.id, rankId: definition.id, status: 'PENDING' },
  })
  res.status(201).json({ id: row.id, rank: code, label: definition.name, status: row.status })
})

router.patch('/rank-requests/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const row = id ? await prisma.userRank.findUnique({ where: { id }, include: { rank: true, user: true } }) : null
  if (!row) return res.status(404).json({ error: 'не найдено' })
  const status = req.body.status
  if (status !== 'CONFIRMED' && status !== 'REJECTED') return res.status(400).json({ error: 'статус: CONFIRMED или REJECTED' })
  if (status === 'CONFIRMED') {
    await prisma.userRank.deleteMany({ where: { userId: row.userId, status: 'CONFIRMED', id: { not: row.id } } })
  }
  const updated = await prisma.userRank.update({
    where: { id: row.id },
    data: {
      status,
      confirmedBy: me.id,
      confirmedAt: new Date(),
    },
  })
  await prisma.notification.create({
    data: {
      userId: row.userId,
      notificationType: 'RANK',
      message: status === 'CONFIRMED' ? `Ранг подтверждён: ${row.rank.name}` : `Заявка на ранг отклонена: ${row.rank.name}`,
      targetPath: '/profile',
    },
  })
  res.json({ id: updated.id, status: updated.status, nick: row.user.displayName, label: row.rank.name })
})

export default router
