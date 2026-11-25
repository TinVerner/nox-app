import { num } from '../../shared/input.js'

export function userJson(user) {
  return {
    id: user.id,
    email: user.email,
    login: user.email,
    nick: user.displayName,
    phone: user.phone || '',
    role: user.role,
    blocked: user.status === 'BLOCKED',
    bonus: num(user.bonusBalance),
  }
}
