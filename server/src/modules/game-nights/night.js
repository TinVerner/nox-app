import { prisma } from '../../shared/prisma.js'

export const PUBLIC_NIGHT = new Set(['PUBLISHED', 'OPEN'])

export function minskDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) return new Date(text)
  const withSeconds = text.length === 16 ? `${text}:00` : text
  return new Date(`${withSeconds}+03:00`)
}

/** null — можно править/отменить; иначе текст ошибки для API */
export function nightManageBlocked(night, now = Date.now()) {
  if (!night) return 'игра не найдена'
  if (night.status === 'CANCELLED') return 'вечер уже отменён'
  if (night.status === 'DONE') return 'вечер уже завершён'
  const start = night.startsAt instanceof Date ? night.startsAt.getTime() : new Date(night.startsAt).getTime()
  if (Number.isNaN(start) || start <= now) return 'вечер уже начался'
  return null
}

/** null — можно отменить; иначе текст ошибки для API */
export function nightCancelBlocked(night, now = Date.now()) {
  return nightManageBlocked(night, now)
}

/** null — можно править; иначе текст ошибки для API */
export function nightEditBlocked(night, now = Date.now()) {
  return nightManageBlocked(night, now)
}

export function nightJson(night, taken = 0) {
  return {
    id: night.id,
    title: night.title,
    startsAt: night.startsAt,
    endsAt: night.endsAt,
    place: night.description || '',
    description: night.description || '',
    registrationDeadlineAt: night.registrationDeadlineAt,
    seats: night.capacity,
    capacity: night.capacity,
    status: night.status,
    kind: night.format,
    format: night.format,
    price: 0,
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
    data.registrationDeadlineAt = body.registrationDeadlineAt ? minskDate(body.registrationDeadlineAt) : null
  }
  if (body.endsAt !== undefined) data.endsAt = minskDate(body.endsAt)
  return data
}

export async function takenCounts(nightIds) {
  const ids = [...new Set(nightIds.filter(Boolean))]
  const map = new Map(ids.map((id) => [id, 0]))
  if (!ids.length) return map
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', gameNightId: { in: ids } },
    select: { gameNightId: true, userId: true },
  })
  const people = new Map()
  for (const booking of bookings) {
    if (!people.has(booking.gameNightId)) people.set(booking.gameNightId, new Set())
    people.get(booking.gameNightId).add(booking.userId)
  }
  for (const [id, set] of people) map.set(id, set.size)
  return map
}

// Строка вечера блокируется до конца транзакции: параллельные записи, отмены и правки
// вечера идут по очереди, поэтому мест не бывает больше, чем capacity.
export function lockNight(tx, nightId) {
  return tx.$queryRaw`SELECT id FROM game_nights WHERE id = ${nightId} FOR UPDATE`
}

// Свободные места получают те, кто дольше всех ждёт; каждому приходит уведомление.
export async function promoteWaiting(tx, night) {
  const confirmed = await tx.booking.count({ where: { gameNightId: night.id, status: 'CONFIRMED' } })
  const free = night.capacity - confirmed
  if (free <= 0) return
  const waiting = await tx.booking.findMany({
    where: { gameNightId: night.id, status: 'WAITING' },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: free,
  })
  for (const row of waiting) {
    await tx.booking.update({ where: { id: row.id }, data: { status: 'CONFIRMED' } })
    await tx.notification.create({
      data: {
        userId: row.userId,
        notificationType: 'BOOKING',
        message: `Освободилось место — вы записаны на «${night.title}»`,
        targetPath: '/bookings',
      },
    })
  }
}
