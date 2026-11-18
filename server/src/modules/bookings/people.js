export function personKey(name) {
  return String(name || '').trim().toLocaleLowerCase('ru')
}

export function guestNames(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',')
  const seen = new Set()
  const names = []
  for (const raw of list) {
    const name = String(raw).trim()
    const key = personKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name)
    if (names.length === 8) break
  }
  return names
}
