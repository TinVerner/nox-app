export function num(value) {
  if (value == null || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function idParam(value) {
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}

/** Optional phone: empty OK; otherwise exact BY mobile +375 + 9 digits. */
export function normalizePhone(value) {
  return String(value ?? '').trim().replace(/[\s()-]/g, '')
}

export function phoneIsValid(value) {
  const compact = normalizePhone(value)
  if (!compact) return true
  return /^\+375\d{9}$/.test(compact)
}
