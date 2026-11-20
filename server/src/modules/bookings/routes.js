import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'
import { approvedBookingBlock } from '../sanctions/policy.js'
import { takenCounts } from '../game-nights/night.js'
import { scoreOf } from '../results/score.js'
import { guestNames, personKey } from './people.js'
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
  const names = guestNames(req.body?.guests)
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
  const guestCreate = names.map((displayName) => ({ displayName }))
  const booking = existing
    ? await prisma.booking.update({
      where: { id: existing.id },
      data: {
        status,
        cancelledAt: null,
        cancellationReason: null,
        ...(guestCreate.length ? { guests: { create: guestCreate } } : {}),
      },
      include: { guests: true },
    })
    : await prisma.booking.create({
      data: {
        gameNightId: night.id,
        userId: me.id,
        status,
        ...(guestCreate.length ? { guests: { create: guestCreate } } : {}),
      },
      include: { guests: true },
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
    include: { guests: { orderBy: { createdAt: 'asc' } }, night: true },
  })
  const nightIds = bookings.map((booking) => booking.gameNightId)
  const taken = await takenCounts(nightIds)
  const played = nightIds.length
    ? await prisma.partyPlayer.findMany({
      where: { userId: me.id, party: { gameNightId: { in: nightIds } } },
      include: { party: { select: { gameNightId: true } } },
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
    guests: booking.guests.map((guest) => ({ id: guest.id, name: guest.displayName })),
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
  await prisma.bookingGuest.deleteMany({ where: { bookingId: booking.id } })
  res.json({ ok: true })
  await notifyHost(booking.night, 'Запись на вечер отменена')
})

router.post('/bookings/:id/guests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true, guests: true } }) : null
  if (!booking || booking.status === 'CANCELLED') return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  const [name] = guestNames(req.body?.name)
  if (!name) return res.status(400).json({ error: 'нужно имя гостя' })
  if (booking.guests.some((guest) => personKey(guest.displayName) === personKey(name))) {
    return res.status(409).json({ error: 'этот гость уже указан' })
  }
  const guest = await prisma.bookingGuest.create({ data: { bookingId: booking.id, displayName: name } })
  const taken = (await takenCounts([booking.gameNightId])).get(booking.gameNightId) || 0
  res.status(201).json({ id: guest.id, name: guest.displayName, taken })
  if (booking.status === 'CONFIRMED') await notifyHost(booking.night, 'Запись на вечер изменилась')
})

router.delete('/bookings/:id/guests/:guestId', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const guestId = idParam(req.params.guestId)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true } }) : null
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  const guest = guestId ? await prisma.bookingGuest.findUnique({ where: { id: guestId } }) : null
  if (!guest || guest.bookingId !== booking.id) return res.status(404).json({ error: 'гость не найден' })
  await prisma.bookingGuest.delete({ where: { id: guest.id } })
  const taken = (await takenCounts([booking.gameNightId])).get(booking.gameNightId) || 0
  res.json({ ok: true, taken })
  if (booking.status === 'CONFIRMED') await notifyHost(booking.night, 'Запись на вечер изменилась')
})

export default router
