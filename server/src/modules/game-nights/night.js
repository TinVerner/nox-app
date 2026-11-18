import { prisma } from '../../shared/prisma.js'
import { personKey } from '../bookings/people.js'

export const PUBLIC_NIGHT = new Set(['PUBLISHED', 'OPEN'])

export function nightJson(night, taken = 0) {
  return {
    id: night.id,
    title: night.title,
    startsAt: night.startsAt,
    place: night.description || '',
    description: night.description || '',
    registrationDeadlineAt: night.registrationDeadlineAt,
    imagePath: night.imagePath || '',
    seats: night.capacity,
    capacity: night.capacity,
    status: night.status,
    kind: night.format,
    format: night.format,
    price: 0,
    seasonId: night.seasonId,
    hostId: night.hostId,
    taken,
  }
}

export function nightExtras(body) {
  const data = {}
  if (body.description !== undefined || body.place !== undefined) {
    data.description = String(body.description ?? body.place ?? '')
  }
  if (body.registrationDeadlineAt !== undefined) {
    data.registrationDeadlineAt = body.registrationDeadlineAt ? new Date(body.registrationDeadlineAt) : null
  }
  if (body.imagePath !== undefined) {
    const path = String(body.imagePath || '').trim()
    data.imagePath = path || null
  }
  return data
}

export async function takenCounts(nightIds) {
  const ids = [...new Set(nightIds.filter(Boolean))]
  const map = new Map(ids.map((id) => [id, 0]))
  if (!ids.length) return map
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', gameNightId: { in: ids } },
    include: { guests: true, user: { select: { displayName: true } } },
  })
  const people = new Map()
  for (const booking of bookings) {
    if (!people.has(booking.gameNightId)) people.set(booking.gameNightId, new Set())
    const set = people.get(booking.gameNightId)
    const nick = personKey(booking.user?.displayName)
    set.add(nick || `user:${booking.userId}`)
    for (const guest of booking.guests) {
      const key = personKey(guest.displayName)
      if (key) set.add(key)
    }
  }
  for (const [id, set] of people) map.set(id, set.size)
  return map
}
