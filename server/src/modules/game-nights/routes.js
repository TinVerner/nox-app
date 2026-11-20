import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isStaff, meOrNull } from '../auth/session.js'
import { minskDate, nightExtras, nightJson, PUBLIC_NIGHT, takenCounts } from './night.js'

const router = Router()

router.get('/games', async (req, res) => {
  const me = await meOrNull(req)
  const staff = isStaff(me)
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
  res.json(visible.map((night) => nightJson(night, taken.get(night.id) || 0)))
})

router.post('/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
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
  const item = await prisma.gameNight.create({
    data: {
      hostId: me.id,
      title,
      startsAt,
      endsAt,
      description,
      capacity,
      format: req.body.format || req.body.kind || 'CLASSIC',
      status: req.body.status || 'PLANNED',
      seasonId: req.body.seasonId ? Number(req.body.seasonId) : null,
      ...nightExtras(req.body),
    },
  })
  res.status(201).json(nightJson(item, 0))
})

router.patch('/games/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
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
  }
  if (req.body.kind !== undefined || req.body.format !== undefined) {
    data.format = req.body.format || req.body.kind
  }
  if (req.body.status !== undefined) data.status = req.body.status
  Object.assign(data, nightExtras(req.body))
  const item = await prisma.gameNight.update({ where: { id }, data })
  const taken = await takenCounts([id])
  res.json(nightJson(item, taken.get(id) || 0))
})

router.post('/games/:id/cancel', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  if (night.status === 'CANCELLED') return res.status(409).json({ error: 'вечер уже отменён' })
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

export default router
