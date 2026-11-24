import { prisma } from '../../shared/prisma.js'

export const POINT_DEFAULTS = [
  ['CLASSIC', 'Мирный', 'Победа', 1],
  ['CLASSIC', 'Мирный', 'Поражение', 0],
  ['CLASSIC', 'Мафия', 'Победа', 1],
  ['CLASSIC', 'Мафия', 'Поражение', 0],
  ['CLASSIC', 'Шериф', 'Победа', 1],
  ['CLASSIC', 'Дон', 'Победа', 1],
]

const CLASSIC_RULES = [
  ['CIVILIAN', 'CITY', 1],
  ['CIVILIAN', 'MAFIA', 0],
  ['SHERIFF', 'CITY', 1.25],
  ['SHERIFF', 'MAFIA', 0],
  ['MAFIA', 'CITY', 0],
  ['MAFIA', 'MAFIA', 1],
  ['DON', 'CITY', 0],
  ['DON', 'MAFIA', 1],
]

const LEGACY_CLASSIC = {
  'Мирный|Победа': ['CIVILIAN', 'CITY'],
  'Мирный|Поражение': ['CIVILIAN', 'MAFIA'],
  'Мафия|Победа': ['MAFIA', 'MAFIA'],
  'Мафия|Поражение': ['MAFIA', 'CITY'],
  'Шериф|Победа': ['SHERIFF', 'CITY'],
  'Шериф|Поражение': ['SHERIFF', 'MAFIA'],
  'Дон|Победа': ['DON', 'MAFIA'],
  'Дон|Поражение': ['DON', 'CITY'],
}

export async function ensurePointRules() {
  const count = await prisma.pointRule.count()
  if (count > 0) return
  await prisma.pointRule.createMany({
    data: POINT_DEFAULTS.map(([format, playerRole, gameResult, points]) => ({
      format,
      playerRole,
      gameResult,
      points,
    })),
  })
}

export async function alignClassicRules() {
  await ensurePointRules()
  const pointsByKey = new Map(CLASSIC_RULES.map(([role, side, points]) => [`${role}|${side}`, points]))
  const existing = await prisma.pointRule.findMany({ where: { format: 'CLASSIC' } })
  const byKey = new Map(existing.map((rule) => [`${rule.playerRole}|${rule.gameResult}`, rule]))
  for (const rule of existing) {
    const mapped = LEGACY_CLASSIC[`${rule.playerRole}|${rule.gameResult}`]
    if (!mapped) continue
    const [role, side] = mapped
    const key = `${role}|${side}`
    const target = byKey.get(key)
    if (target && target.id !== rule.id) {
      await prisma.pointRule.delete({ where: { id: rule.id } })
      continue
    }
    if (!target) {
      const updated = await prisma.pointRule.update({
        where: { id: rule.id },
        data: { playerRole: role, gameResult: side, points: pointsByKey.get(key) },
      })
      byKey.delete(`${rule.playerRole}|${rule.gameResult}`)
      byKey.set(key, updated)
    }
  }
  for (const [role, side, points] of CLASSIC_RULES) {
    const key = `${role}|${side}`
    if (byKey.has(key)) continue
    const created = await prisma.pointRule.create({
      data: { format: 'CLASSIC', playerRole: role, gameResult: side, points, isActive: true },
    })
    byKey.set(key, created)
  }
}

export function findActivePointRule(format, playerRole, gameResult) {
  return prisma.pointRule.findFirst({
    where: { format, playerRole, gameResult, isActive: true },
  })
}
