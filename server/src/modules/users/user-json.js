import { num } from '../../shared/input.js'

export function userJson(user, rankCode) {
  return {
    id: user.id,
    email: user.email,
    nick: user.displayName,
    role: user.role,
    blocked: user.status === 'BLOCKED',
    rank: rankCode || null,
    bonus: num(user.bonusBalance),
  }
}
