import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'
import { approvedBookingBlock } from '../sanctions/policy.js'
import { takenCounts } from '../game-nights/night.js'
import { scoreOf } from '../results/score.js'
import { notifyHost } from './notify-host.js'

const WAITLIST_SIZE = 4

const router = Router()

router.post('/games/:id/book', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'запись только для игроков' })
  if (me.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  if (night.status === 'CANCELLED') return res.status(403).json({ error: 'запись закрыта' })
  // дедлайн записи хранится в game_nights.registration_deadline_at
  if (night.registrationDeadlineAt && night.registrationDeadlineAt.getTime() < Date.now()) {
    return res.status(403).json({ error: 'запись закрыта' })
  }
  const blocked = await approvedBookingBlock(me.id)
  if (blocked) return res.status(403).json({ error: 'запись закрыта' })
  const takenNow = (await takenCounts([night.id])).get(night.id) || 0
  const waiting = await prisma.booking.count({ where: { gameNightId: night.id, status: 'WAITING' } })
  let status = 'CONFIRMED'
  if (takenNow >= night.capacity) {
    if (waiting >= WAITLIST_SIZE) return res.status(409).json({ error: 'лист ожидания полон' })
    status = 'WAITING'
  }
  const existing = await prisma.booking.findUnique({
    where: { gameNightId_userId: { gameNightId: night.id, userId: me.id } },
  })
  if (existing && existing.status !== 'CANCELLED') return res.status(409).json({ error: 'уже записана' })
  const booking = existing
    ? await prisma.booking.update({
      where: { id: existing.id },
      data: {
        status,
        cancelledAt: null,
        cancellationReason: null,
      },
    })
    : await prisma.booking.create({
      data: {
        gameNightId: night.id,
        userId: me.id,
        status,
      },
    })
  res.status(201).json(booking)
  await notifyHost(night, 'Запись на вечер изменилась')
})

router.get('/bookings', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const bookings = await prisma.booking.findMany({
    where: { userId: me.id, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    include: { night: true },
  })
  const nightIds = bookings.map((booking) => booking.gameNightId)
  const taken = await takenCounts(nightIds)
  const played = nightIds.length
    ? await prisma.partyPlayer.findMany({
      where: {
        userId: me.id,
        attendanceStatus: { not: 'SKIPPED' },
        party: { gameNightId: { in: nightIds }, status: { in: ['PUBLISHED', 'DONE'] } },
      },
      include: { party: { select: { gameNightId: true, status: true } } },
    })
    : []
  const pointsByNight = new Map()
  for (const row of played) {
    const key = row.party.gameNightId
    pointsByNight.set(key, (pointsByNight.get(key) || 0) + scoreOf(row))
  }
  res.json(bookings.map((booking) => ({
    id: booking.id,
    gameId: booking.gameNightId,
    status: booking.status,
    gameStatus: booking.night?.status ?? null,
    title: booking.night?.title ?? null,
    startsAt: booking.night?.startsAt ?? null,
    place: booking.night?.description || '',
    seats: booking.night?.capacity ?? null,
    taken: taken.get(booking.gameNightId) || 0,
    points: pointsByNight.has(booking.gameNightId) ? pointsByNight.get(booking.gameNightId) : null,
  })))
})

router.delete('/bookings/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true } }) : null
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'отмена игроком' },
  })
  res.json({ ok: true })
  await notifyHost(booking.night, 'Запись на вечер отменена')
})

export default router
