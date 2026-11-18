import { num } from '../../shared/input.js'

export function scoreOf(row) {
  return num(row.basePoints) + num(row.extraPoints) - num(row.penaltyPoints)
}
