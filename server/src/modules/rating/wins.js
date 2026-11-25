import { ROLE_CODES, ROLE_LABEL } from '../results/calc.js'

/** Legacy / alternate role labels → canonical ROLE_CODES */
const ROLE_ALIAS = {
  CIVILIAN: 'CIVILIAN',
  Мирный: 'CIVILIAN',
  'мирный житель': 'CIVILIAN',
  SHERIFF: 'SHERIFF',
  Шериф: 'SHERIFF',
  шериф: 'SHERIFF',
  MAFIA: 'MAFIA',
  Мафия: 'MAFIA',
  мафия: 'MAFIA',
  DON: 'DON',
  Дон: 'DON',
  дон: 'DON',
}

const CITY_ROLES = new Set(['CIVILIAN', 'SHERIFF'])
const MAFIA_ROLES = new Set(['MAFIA', 'DON'])

export function normalizeRole(role) {
  const raw = String(role || '').trim()
  if (!raw) return ''
  return ROLE_ALIAS[raw] || (ROLE_CODES.includes(raw) ? raw : raw)
}

export function roleLabel(role) {
  const code = normalizeRole(role)
  return ROLE_LABEL[code] || code || '—'
}

/**
 * Win vs party winning side (CITY/MAFIA) or legacy Победа/Поражение.
 * Returns true/false, or null if outcome cannot be judged.
 */
export function roleWon(playerRole, gameResult) {
  const role = normalizeRole(playerRole)
  const result = String(gameResult || '').trim()
  if (!role || !result) return null
  if (result === 'Победа') return true
  if (result === 'Поражение') return false
  if (result === 'CITY') return CITY_ROLES.has(role)
  if (result === 'MAFIA') return MAFIA_ROLES.has(role)
  return null
}

export function emptyRoleBuckets() {
  const map = new Map()
  for (const code of ROLE_CODES) {
    map.set(code, { role: code, label: ROLE_LABEL[code], games: 0, wins: 0 })
  }
  return map
}

export function winRate(wins, games) {
  if (!games) return null
  return Math.round((wins / games) * 1000) / 10
}

export function applyPlay(bucket, won) {
  bucket.games += 1
  if (won === true) bucket.wins += 1
}

export function roleStatsList(byRole) {
  const order = [...ROLE_CODES]
  for (const key of byRole.keys()) {
    if (!order.includes(key)) order.push(key)
  }
  return order.map((code) => {
    const row = byRole.get(code) || { role: code, label: ROLE_LABEL[code] || code, games: 0, wins: 0 }
    return {
      role: row.role,
      label: row.label,
      games: row.games,
      wins: row.wins,
      winRate: winRate(row.wins, row.games),
    }
  }).filter((row) => row.games > 0)
}
