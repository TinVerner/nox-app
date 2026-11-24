import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { lockNight, minskDate, nightCancelBlocked, nightEditBlocked, nightExtras, nightJson, promoteWaiting, PUBLIC_NIGHT, seasonIdFor, takenCounts } from './night.js'

const router = Router()
// CANCELLED ставит только /cancel (с уведомлениями), DONE вручную запер бы будущий вечер.
const HOST_STATUSES = new Set(['PLANNED', 'DRAFT', 'PUBLISHED', 'OPEN'])
const STATUS_ERROR = 'статус: черновик или опубликован; отмена — кнопкой «Отменить»'

router.get('/games', async (req, res) => {
  const me = await meOrNull(req)
  const staff = isHost(me)
  const items = await prisma.gameNight.findMany({
    orderBy: { startsAt: 'asc' },
    include: { season: true },
  })
  const now = Date.now()
  const visible = staff
    ? items
    : items.filter((night) => {
      if (!PUBLIC_NIGHT.has(night.status) || night.season?.status === 'CLOSED') return false
      if (me?.role === 'PLAYER' && night.startsAt.getTime() <= now) return false
      return true
    })
  const taken = await takenCounts(visible.map((night) => night.id))
  const partyRows = staff && visible.length
    ? await prisma.party.findMany({
      where: { gameNightId: { in: visible.map((night) => night.id) } },
      select: { gameNightId: true, status: true },
    })
    : []
  const resultsStatus = new Map()
  for (const row of partyRows) {
    const published = row.status === 'PUBLISHED' || row.status === 'DONE'
    const current = resultsStatus.get(row.gameNightId)
    if (current === 'DRAFT') continue
    if (!published) resultsStatus.set(row.gameNightId, 'DRAFT')
    else if (!current) resultsStatus.set(row.gameNightId, 'PUBLISHED')
  }
  res.json(visible.map((night) => {
    const json = nightJson(night, taken.get(night.id) || 0)
    if (staff) json.resultsStatus = resultsStatus.get(night.id) || null
    return json
  }))
})

router.post('/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const title = String(req.body.title || '').trim()
  const startsAt = minskDate(req.body.startsAt)
  const endsAt = minskDate(req.body.endsAt)
  const description = String(req.body.description ?? req.body.place ?? '').trim()
  const capacity = Number(req.body.capacity ?? req.body.seats)
  if (!title || !startsAt || Number.isNaN(startsAt.getTime()) || !endsAt || Number.isNaN(endsAt.getTime()) || !Number.isInteger(capacity) || capacity < 1) {
    return res.status(400).json({ error: 'нужны название, начало, конец и число мест' })
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return res.status(400).json({ error: 'конец должен быть позже начала' })
  }
  const status = req.body.status || 'PLANNED'
  if (!HOST_STATUSES.has(status)) return res.status(400).json({ error: STATUS_ERROR })
  const item = await prisma.gameNight.create({
    data: {
      hostId: me.id,
      title,
      startsAt,
      endsAt,
      description,
      capacity,
      format: req.body.format || req.body.kind || 'CLASSIC',
      status,
      // Форма сезон не передаёт: без этого вечер не попадёт в рейтинг сезона.
      seasonId: idParam(req.body.seasonId) || await seasonIdFor(startsAt),
      ...nightExtras(req.body),
    },
  })
  res.status(201).json(nightJson(item, 0))
})

router.patch('/games/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const blocked = nightEditBlocked(night)
  if (blocked) return res.status(409).json({ error: blocked })
  const data = {}
  if (req.body.title !== undefined) data.title = req.body.title
  if (req.body.startsAt !== undefined) data.startsAt = minskDate(req.body.startsAt)
  if (req.body.endsAt !== undefined) data.endsAt = minskDate(req.body.endsAt)
  if ((data.startsAt && Number.isNaN(data.startsAt.getTime())) || (req.body.endsAt !== undefined && (!data.endsAt || Number.isNaN(data.endsAt.getTime())))) {
    return res.status(400).json({ error: 'нужны время начала и конца' })
  }
  const nextStart = data.startsAt || night.startsAt
  const nextEnd = data.endsAt === undefined ? night.endsAt : data.endsAt
  if (nextStart && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
    return res.status(400).json({ error: 'конец должен быть позже начала' })
  }
  if (req.body.place !== undefined || req.body.description !== undefined) {
    data.description = req.body.description ?? req.body.place
  }
  if (req.body.seats !== undefined || req.body.capacity !== undefined) {
    data.capacity = Number(req.body.capacity ?? req.body.seats)
    if (!Number.isInteger(data.capacity) || data.capacity < 1) {
      return res.status(400).json({ error: 'число мест — целое от 1' })
    }
  }
  if (req.body.kind !== undefined || req.body.format !== undefined) {
    data.format = req.body.format || req.body.kind
  }
  if (req.body.status !== undefined) {
    if (!HOST_STATUSES.has(req.body.status)) return res.status(400).json({ error: STATUS_ERROR })
    data.status = req.body.status
  }
  if (data.startsAt) data.seasonId = await seasonIdFor(data.startsAt)
  Object.assign(data, nightExtras(req.body))
  const outcome = await prisma.$transaction(async (tx) => {
    await lockNight(tx, id)
    if (data.capacity !== undefined) {
      const confirmed = await tx.booking.count({ where: { gameNightId: id, status: 'CONFIRMED' } })
      if (data.capacity < confirmed) return { error: `уже записано ${confirmed} — мест не может быть меньше` }
    }
    const item = await tx.gameNight.update({ where: { id }, data })
    await promoteWaiting(tx, item)
    return { item }
  })
  if (outcome.error) return res.status(409).json({ error: outcome.error })
  const taken = await takenCounts([id])
  res.json(nightJson(outcome.item, taken.get(id) || 0))
})

router.post('/games/:id/cancel', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const blocked = nightCancelBlocked(night)
  if (blocked) return res.status(409).json({ error: blocked })
  const updated = await prisma.gameNight.update({ where: { id }, data: { status: 'CANCELLED' } })
  const bookings = await prisma.booking.findMany({
    where: { gameNightId: id, status: { in: ['CONFIRMED', 'WAITING'] } },
    select: { userId: true },
  })
  if (bookings.length) {
    await prisma.notification.createMany({
      data: bookings.map((booking) => ({
        userId: booking.userId,
        notificationType: 'NIGHT',
        message: `Игра отменена: ${night.title}`,
        targetPath: '/notices',
      })),
    })
  }
  const taken = await takenCounts([id])
  res.json(nightJson(updated, taken.get(id) || 0))
})

/** Hard-delete night + parties/bookings so it leaves schedule, Сыгранные and rating. */
router.delete('/games/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const start = night.startsAt instanceof Date ? night.startsAt.getTime() : new Date(night.startsAt).getTime()
  const started = !Number.isNaN(start) && start <= Date.now()
  if (!started && night.status !== 'CANCELLED') {
    return res.status(409).json({ error: 'сначала отмените будущий вечер или дождитесь начала' })
  }
  await prisma.$transaction(async (tx) => {
    const parties = await tx.party.findMany({ where: { gameNightId: id }, select: { id: true } })
    const partyIds = parties.map((party) => party.id)
    if (partyIds.length) {
      await tx.partyPlayer.deleteMany({ where: { partyId: { in: partyIds } } })
      await tx.party.deleteMany({ where: { id: { in: partyIds } } })
    }
    const bookings = await tx.booking.findMany({ where: { gameNightId: id }, select: { id: true } })
    const bookingIds = bookings.map((booking) => booking.id)
    if (bookingIds.length) {
      await tx.bookingGuest.deleteMany({ where: { bookingId: { in: bookingIds } } })
      await tx.booking.deleteMany({ where: { id: { in: bookingIds } } })
    }
    await tx.gameNight.delete({ where: { id } })
  })
  res.json({ ok: true, id })
})

export default router
