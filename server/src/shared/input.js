export function num(value) {
  if (value == null || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function idParam(value) {
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}
