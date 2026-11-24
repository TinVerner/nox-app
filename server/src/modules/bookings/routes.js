import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'
import { approvedBookingBlock } from '../sanctions/policy.js'
import { lockNight, nightManageBlocked, promoteWaiting, PUBLIC_NIGHT, takenCounts } from '../game-nights/night.js'
import { MIN_CONFIRMED } from '../results/calc.js'
import { scoreOf } from '../results/score.js'
import { bookingMessage, notifyHost } from './notify-host.js'

const WAITLIST_SIZE = 4

const router = Router()

function bookingClosed(night, now = Date.now()) {
  if (!PUBLIC_NIGHT.has(night.status) || night.season?.status === 'CLOSED') return true
  if (nightManageBlocked(night, now)) return true
  return Boolean(night.registrationDeadlineAt && night.registrationDeadlineAt.getTime() < now)
}

router.post('/games/:id/book', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'запись только для игроков' })
  const id = idParam(req.params.id)
  if (!id) return res.status(404).json({ error: 'игра не найдена' })
  const blocked = await approvedBookingBlock(me.id)
  if (blocked) return res.status(403).json({ error: 'запись закрыта' })
  const outcome = await prisma.$transaction(async (tx) => {
    await lockNight(tx, id)
    const night = await tx.gameNight.findUnique({ where: { id }, include: { season: true } })
    if (!night) return { httpStatus: 404, error: 'игра не найдена' }
    if (bookingClosed(night)) return { httpStatus: 403, error: 'запись закрыта' }
    const existing = await tx.booking.findUnique({
      where: { gameNightId_userId: { gameNightId: id, userId: me.id } },
    })
    if (existing && existing.status !== 'CANCELLED') return { httpStatus: 409, error: 'уже записана' }
    const confirmed = await tx.booking.count({ where: { gameNightId: id, status: 'CONFIRMED' } })
    let status = 'CONFIRMED'
    if (confirmed >= night.capacity) {
      const waiting = await tx.booking.count({ where: { gameNightId: id, status: 'WAITING' } })
      if (waiting >= WAITLIST_SIZE) return { httpStatus: 409, error: 'лист ожидания полон' }
      status = 'WAITING'
    }
    const booking = existing
      ? await tx.booking.update({
        where: { id: existing.id },
        data: { status, cancelledAt: null, cancellationReason: null },
      })
      : await tx.booking.create({ data: { gameNightId: id, userId: me.id, status } })
    return { night, booking }
  })
  if (outcome.error) return res.status(outcome.httpStatus).json({ error: outcome.error })
  const { night, booking } = outcome
  res.status(201).json(booking)
  const action = booking.status === 'WAITING' ? 'wait' : 'book'
  await notifyHost(night, bookingMessage(action, me.displayName, night))
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
  const publishedNights = new Set()
  if (nightIds.length) {
    const parties = await prisma.party.findMany({
      where: { gameNightId: { in: nightIds }, status: { in: ['PUBLISHED', 'DONE'] } },
      select: { gameNightId: true },
    })
    for (const party of parties) publishedNights.add(party.gameNightId)
  }
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
  const now = Date.now()
  res.json(bookings.map((booking) => {
    const past = nightManageBlocked(booking.night, now) !== null
    const resultsPublished = publishedNights.has(booking.gameNightId)
    return {
      id: booking.id,
      gameId: booking.gameNightId,
      status: booking.status,
      gameStatus: booking.night?.status ?? null,
      title: booking.night?.title ?? null,
      startsAt: booking.night?.startsAt ?? null,
      place: booking.night?.description || '',
      seats: booking.night?.capacity ?? null,
      taken: taken.get(booking.gameNightId) || 0,
      // Меньше 8 подтверждённых — вечер не проводится, результатов не будет.
      held: (taken.get(booking.gameNightId) || 0) >= MIN_CONFIRMED,
      points: pointsByNight.has(booking.gameNightId) ? pointsByNight.get(booking.gameNightId) : null,
      past,
      resultsPublished,
      canCancel: !past,
    }
  }))
})

router.delete('/bookings/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const found = id ? await prisma.booking.findUnique({ where: { id } }) : null
  if (!found) return res.status(404).json({ error: 'не найдено' })
  if (found.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  const outcome = await prisma.$transaction(async (tx) => {
    await lockNight(tx, found.gameNightId)
    const booking = await tx.booking.findUnique({ where: { id }, include: { night: true } })
    if (booking.status === 'CANCELLED') return { httpStatus: 409, error: 'запись уже отменена' }
    if (nightManageBlocked(booking.night)) {
      return { httpStatus: 403, error: 'прошедшую запись нельзя отменить' }
    }
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'отмена игроком' },
    })
    if (booking.status === 'CONFIRMED') await promoteWaiting(tx, booking.night)
    return { booking }
  })
  if (outcome.error) return res.status(outcome.httpStatus).json({ error: outcome.error })
  res.json({ ok: true })
  const { night } = outcome.booking
  await notifyHost(night, bookingMessage('cancel', me.displayName, night))
})

export default router
