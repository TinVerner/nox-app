export const ROLE_CODES = ['CIVILIAN', 'SHERIFF', 'MAFIA', 'DON']
export const SIDE_CODES = ['CITY', 'MAFIA']

export const ROLE_LABEL = {
  CIVILIAN: 'мирный житель',
  SHERIFF: 'шериф',
  MAFIA: 'мафия',
  DON: 'дон',
}

export const SIDE_LABEL = {
  CITY: 'мирный город',
  MAFIA: 'мафия',
}

export function round2(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round((number + Number.EPSILON) * 100) / 100
}

export function parseExtra(value) {
  if (value == null || value === '') return { ok: true, value: 0 }
  const text = String(value).trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false }
  const number = round2(text)
  if (number > 100) return { ok: false }
  return { ok: true, value: number }
}

export function lineScore(attendance, base, extra) {
  if (attendance === 'SKIPPED') return { base: 0, extra: 0, total: 0 }
  const safeBase = round2(base)
  const safeExtra = round2(extra)
  return { base: safeBase, extra: safeExtra, total: round2(safeBase + safeExtra) }
}

export function personKey(player) {
  if (player.userId) return `user:${player.userId}`
  if (player.guestId || player.bookingGuestId) return `guest:${player.guestId || player.bookingGuestId}`
  if (player.id) return `row:${player.id}`
  return ''
}

export function nightSums(parties) {
  const sums = new Map()
  for (const party of parties) {
    for (const player of party.players || []) {
      const key = personKey(player)
      if (!key) continue
      const score = lineScore(player.attendance || player.attendanceStatus, player.basePoints, player.extraPoints)
      const current = sums.get(key) || { key, label: player.label || player.playerName, kind: player.kind || (player.guestId || player.bookingGuestId ? 'GUEST' : 'PLAYER'), total: 0 }
      current.total = round2(current.total + score.total)
      sums.set(key, current)
    }
  }
  return [...sums.values()]
}
