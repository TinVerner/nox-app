export const RANKS = [
  { id: 'MASTER', label: 'Мастер ★' },
  { id: 'MASTER_PRO', label: 'Мастер Про ★★' },
  { id: 'LEGEND', label: 'Легенда' },
]

export function rankLabel(id) {
  return RANKS.find((rank) => rank.id === id)?.label || ''
}
