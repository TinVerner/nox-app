export const RANKS = [
  { id: 'MASTER', label: 'Мастер ★' },
  { id: 'MASTER_PRO', label: 'Мастер Про ★★' },
  { id: 'LEGEND', label: 'Легенда' },
]

export function rankLabel(id) {
  return RANKS.find((rank) => rank.id === id)?.label || ''
}

export function nextRank(current) {
  if (!current) return RANKS[0]
  const index = RANKS.findIndex((rank) => rank.id === current)
  if (index < 0 || index >= RANKS.length - 1) return null
  return RANKS[index + 1]
}
