import { prisma } from '../../shared/prisma.js'

export const RANK_LABEL = {
  MASTER: 'Мастер ★',
  MASTER_PRO: 'Мастер Про ★★',
  LEGEND: 'Легенда',
}

export const RANK_DEFS = [
  { code: 'MASTER', name: 'Мастер ★', criteria: { games: 90 }, benefits: 'Скидка 5 BYN на открытую игру' },
  { code: 'MASTER_PRO', name: 'Мастер Про ★★', criteria: { winrate: 75, games: 50 }, benefits: 'Скидка 10 BYN на открытую игру и 20% на вечеринки' },
  { code: 'LEGEND', name: 'Легенда', criteria: { winrate: 85, games: 50 }, benefits: 'Скидка 15 BYN на открытую игру и 50% на вечеринки' },
]

export async function ensureRanks() {
  for (const rank of RANK_DEFS) {
    await prisma.rankDefinition.upsert({
      where: { code: rank.code },
      update: {},
      create: rank,
    })
  }
}

export async function rankCodes(userIds) {
  const map = new Map()
  if (!userIds.length) return map
  const rows = await prisma.userRank.findMany({
    where: { userId: { in: userIds }, status: 'CONFIRMED' },
    include: { rank: true },
    orderBy: { confirmedAt: 'desc' },
  })
  for (const row of rows) {
    if (!map.has(row.userId)) map.set(row.userId, row.rank.code)
  }
  return map
}
