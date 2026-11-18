import { prisma } from '../../shared/prisma.js'

export const POINT_DEFAULTS = [
  ['CLASSIC', 'Мирный', 'Победа', 1],
  ['CLASSIC', 'Мирный', 'Поражение', 0],
  ['CLASSIC', 'Мафия', 'Победа', 1],
  ['CLASSIC', 'Мафия', 'Поражение', 0],
  ['CLASSIC', 'Шериф', 'Победа', 1],
  ['CLASSIC', 'Дон', 'Победа', 1],
]

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

export function findActivePointRule(format, playerRole, gameResult) {
  return prisma.pointRule.findFirst({
    where: { format, playerRole, gameResult, isActive: true },
  })
}
