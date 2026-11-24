import { num } from '../../shared/input.js'
import { lineScore } from './calc.js'

export function scoreOf(row) {
  const scored = lineScore(row.attendanceStatus, num(row.basePoints), num(row.extraPoints))
  return scored.total
}
