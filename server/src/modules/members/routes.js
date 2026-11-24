import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { num } from '../../shared/input.js'
import { ensureRanks, rankCodes } from '../ranks/defs.js'
import { ratingList } from '../rating/list.js'
import { ensureAutumn } from '../seasons/ensure-autumn.js'

const router = Router()

router.get('/members', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'нельзя' })
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
    bonus: num(member.bonusBalance),
  })))
})

router.get('/members/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'нельзя' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user || user.role === 'ADMIN') return res.status(404).json({ error: 'не найдено' })
  const codes = await rankCodes([user.id])
  const overall = (await ratingList()).find((item) => item.id === user.id) || null
  const seasons = await ensureAutumn(prisma)
  const current = seasons.find((season) => season.status !== 'CLOSED') || null
  const seasonRows = current ? await ratingList(current.id) : []
  const season = seasonRows.find((item) => item.id === user.id) || null
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { night: { select: { id: true, title: true, startsAt: true, status: true, format: true } } },
  })
  const nights = bookings.map((row) => ({
    id: row.night.id,
    title: row.night.title,
    startsAt: row.night.startsAt,
    status: row.night.status,
    format: row.night.format,
    bookingStatus: row.status,
  }))
  res.json({
    id: user.id,
    nick: user.displayName,
    role: user.role,
    rank: codes.get(user.id) || null,
    bonus: num(user.bonusBalance),
    rating: overall ? { points: overall.points, games: overall.games } : null,
    season: current
      ? {
        id: current.id,
        name: current.name,
        points: season?.points ?? 0,
        games: season?.games ?? 0,
      }
      : null,
    recentNights: nights,
  })
})

export default router
