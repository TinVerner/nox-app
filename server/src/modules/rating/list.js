import { prisma } from '../../shared/prisma.js'
import { scoreOf } from '../results/score.js'
import { RANK_LABEL, ensureRanks, rankCodes } from '../ranks/defs.js'

export async function ratingList() {
  await ensureRanks()
  const players = await prisma.user.findMany({
    where: { role: 'PLAYER' },
    select: { id: true, displayName: true },
  })
  const ids = players.map((player) => player.id)
  const played = ids.length
    ? await prisma.partyPlayer.findMany({
      where: {
        userId: { in: ids },
        attendanceStatus: { not: 'SKIPPED' },
        party: { status: { in: ['PUBLISHED', 'DONE'] } },
      },
      select: { userId: true, playerName: true, basePoints: true, extraPoints: true, penaltyPoints: true, attendanceStatus: true },
    })
    : []
  const codes = await rankCodes(ids)
  const stats = new Map(ids.map((id) => [id, { points: 0, games: 0 }]))
  for (const row of played) {
    const player = players.find((item) => item.id === row.userId)
    if (!player) continue
    const bucket = stats.get(player.id)
    bucket.points += scoreOf(row)
    bucket.games += 1
  }
  return players
    .map((player) => ({
      id: player.id,
      nick: player.displayName,
      points: stats.get(player.id).points,
      games: stats.get(player.id).games,
      rank: RANK_LABEL[codes.get(player.id)] || '',
    }))
    .sort((a, b) => b.points - a.points || a.nick.localeCompare(b.nick, 'ru'))
}
