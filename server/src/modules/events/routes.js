import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { isStaff, meOrNull } from '../auth/session.js'

const router = Router()
const TYPES = new Set(['TOURNAMENT', 'CLUB_EVENT'])

function eventJson(item, registrations, mine) {
  return {
    id: item.id,
    eventType: item.eventType,
    seasonId: item.seasonId,
    hostId: item.hostId,
    hostNick: item.host?.displayName || '',
    title: item.title,
    description: item.description || '',
    startsAt: item.startsAt,
    capacity: item.capacity,
    price: item.price == null ? null : num(item.price),
    imagePath: item.imagePath || '',
    status: item.status,
    registrations: registrations.map((row) => ({
      id: row.id,
      userId: row.userId,
      nick: row.user?.displayName || '',
      status: row.status,
      guestCount: row.guestCount,
      finalPlace: row.finalPlace,
      registeredAt: row.registeredAt,
    })),
    mine: mine
      ? {
        id: mine.id,
        status: mine.status,
        guestCount: mine.guestCount,
        finalPlace: mine.finalPlace,
      }
      : null,
  }
}

function taken(registrations) {
  return registrations.reduce((sum, row) => sum + 1 + row.guestCount, 0)
}

router.get('/events', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const items = await prisma.event.findMany({
    orderBy: { startsAt: 'asc' },
    include: {
      host: { select: { displayName: true } },
      registrations: { include: { user: { select: { displayName: true } } }, orderBy: { registeredAt: 'asc' } },
    },
  })
  const staff = isStaff(me)
  res.json(items.map((item) => {
    const mine = item.registrations.find((row) => row.userId === me.id) || null
    const visible = staff ? item.registrations : mine ? [mine] : []
    return eventJson(item, visible, mine)
  }))
})

router.post('/events', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const title = String(req.body.title || '').trim()
  const eventType = req.body.eventType
  const startsAt = req.body.startsAt
  if (!title || !TYPES.has(eventType) || !startsAt || Number.isNaN(new Date(startsAt).getTime())) {
    return res.status(400).json({ error: 'нужны тип, название и время' })
  }
  const capacity = req.body.capacity == null || req.body.capacity === '' ? null : Number(req.body.capacity)
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
    return res.status(400).json({ error: 'места должны быть числом' })
  }
  const price = req.body.price == null || req.body.price === '' ? null : Number(req.body.price)
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return res.status(400).json({ error: 'цена должна быть числом' })
  }
  const seasonId = req.body.seasonId ? Number(req.body.seasonId) : null
  const item = await prisma.event.create({
    data: {
      eventType,
      hostId: me.id,
      seasonId: Number.isInteger(seasonId) ? seasonId : null,
      title,
      description: String(req.body.description || '').trim() || null,
      startsAt: new Date(startsAt),
      capacity,
      price,
      imagePath: String(req.body.imagePath || '').trim() || null,
      status: String(req.body.status || 'PLANNED').trim() || 'PLANNED',
    },
    include: { host: { select: { displayName: true } } },
  })
  res.status(201).json(eventJson(item, [], null))
})

router.patch('/events/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const item = id ? await prisma.event.findUnique({ where: { id } }) : null
  if (!item) return res.status(404).json({ error: 'не найдено' })
  const data = {}
  if (req.body.title !== undefined) {
    const title = String(req.body.title || '').trim()
    if (!title) return res.status(400).json({ error: 'нужно название' })
    data.title = title
  }
  if (req.body.eventType !== undefined) {
    if (!TYPES.has(req.body.eventType)) return res.status(400).json({ error: 'неизвестный тип' })
    data.eventType = req.body.eventType
  }
  if (req.body.startsAt !== undefined) data.startsAt = new Date(req.body.startsAt)
  if (req.body.description !== undefined) data.description = String(req.body.description || '').trim() || null
  if (req.body.capacity !== undefined) {
    const capacity = req.body.capacity === '' || req.body.capacity == null ? null : Number(req.body.capacity)
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
      return res.status(400).json({ error: 'места должны быть числом' })
    }
    data.capacity = capacity
  }
  if (req.body.price !== undefined) {
    const price = req.body.price === '' || req.body.price == null ? null : Number(req.body.price)
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      return res.status(400).json({ error: 'цена должна быть числом' })
    }
    data.price = price
  }
  if (req.body.imagePath !== undefined) data.imagePath = String(req.body.imagePath || '').trim() || null
  if (req.body.status !== undefined) data.status = String(req.body.status || '').trim() || 'PLANNED'
  if (req.body.seasonId !== undefined) data.seasonId = req.body.seasonId ? Number(req.body.seasonId) : null
  const updated = await prisma.event.update({
    where: { id },
    data,
    include: {
      host: { select: { displayName: true } },
      registrations: { include: { user: { select: { displayName: true } } }, orderBy: { registeredAt: 'asc' } },
    },
  })
  res.json(eventJson(updated, updated.registrations, null))
})

router.post('/events/:id/register', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'запись только для игроков' })
  if (me.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  const id = idParam(req.params.id)
  const item = id
    ? await prisma.event.findUnique({ where: { id }, include: { registrations: true } })
    : null
  if (!item) return res.status(404).json({ error: 'не найдено' })
  if (item.registrations.some((row) => row.userId === me.id)) {
    return res.status(409).json({ error: 'уже записана' })
  }
  const guestCount = req.body.guestCount == null || req.body.guestCount === '' ? 0 : Number(req.body.guestCount)
  if (!Number.isInteger(guestCount) || guestCount < 0) {
    return res.status(400).json({ error: 'гости должны быть числом' })
  }
  if (item.capacity != null && taken(item.registrations) + 1 + guestCount > item.capacity) {
    return res.status(409).json({ error: 'мест нет' })
  }
  await prisma.eventRegistration.create({
    data: { eventId: item.id, userId: me.id, guestCount },
  })
  const fresh = await prisma.event.findUnique({
    where: { id: item.id },
    include: {
      host: { select: { displayName: true } },
      registrations: { include: { user: { select: { displayName: true } } }, orderBy: { registeredAt: 'asc' } },
    },
  })
  const mine = fresh.registrations.find((row) => row.userId === me.id)
  res.status(201).json(eventJson(fresh, [mine], mine))
})

router.delete('/events/:id/register', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const row = id
    ? await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: id, userId: me.id } } })
    : null
  if (!row) return res.status(404).json({ error: 'записи нет' })
  if (row.userId !== me.id && !isStaff(me)) return res.status(403).json({ error: 'нельзя' })
  await prisma.eventRegistration.delete({ where: { id: row.id } })
  res.json({ ok: true })
})

router.patch('/events/:id/registrations/:registrationId', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const eventId = idParam(req.params.id)
  const registrationId = idParam(req.params.registrationId)
  const row = registrationId
    ? await prisma.eventRegistration.findUnique({ where: { id: registrationId } })
    : null
  if (!row || row.eventId !== eventId) return res.status(404).json({ error: 'не найдено' })
  const data = {}
  if (req.body.finalPlace !== undefined) {
    const place = req.body.finalPlace === '' || req.body.finalPlace == null ? null : Number(req.body.finalPlace)
    if (place != null && (!Number.isInteger(place) || place < 1)) {
      return res.status(400).json({ error: 'место должно быть числом' })
    }
    data.finalPlace = place
  }
  if (req.body.guestCount !== undefined) {
    const guestCount = Number(req.body.guestCount)
    if (!Number.isInteger(guestCount) || guestCount < 0) {
      return res.status(400).json({ error: 'гости должны быть числом' })
    }
    data.guestCount = guestCount
  }
  if (req.body.status !== undefined) data.status = String(req.body.status || '').trim() || 'CONFIRMED'
  await prisma.eventRegistration.update({ where: { id: row.id }, data })
  const fresh = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      host: { select: { displayName: true } },
      registrations: { include: { user: { select: { displayName: true } } }, orderBy: { registeredAt: 'asc' } },
    },
  })
  res.json(eventJson(fresh, fresh.registrations, null))
})

export default router
