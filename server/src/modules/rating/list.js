import { prisma } from '../../shared/prisma.js'
import { scoreOf } from '../results/score.js'
import {
  applyPlay,
  emptyRoleBuckets,
  normalizeRole,
  roleStatsList,
  roleWon,
  winRate,
} from './wins.js'

export async function ratingList() {
  const players = await prisma.user.findMany({
    where: { role: 'PLAYER' },
    select: { id: true, displayName: true },
  })
  const ids = players.map((player) => player.id)
  const nightFilter = {
    status: { not: 'CANCELLED' },
  }
  const partyFilter = {
    attendanceStatus: { not: 'SKIPPED' },
    party: {
      status: { in: ['PUBLISHED', 'DONE'] },
      night: nightFilter,
    },
    ...(ids.length ? { userId: { in: ids } } : { userId: -1 }),
  }
  const played = ids.length
    ? await prisma.partyPlayer.findMany({
      where: partyFilter,
      select: {
        userId: true,
        playerName: true,
        playerRole: true,
        gameResult: true,
        basePoints: true,
        extraPoints: true,
        penaltyPoints: true,
        attendanceStatus: true,
      },
    })
    : []
  const stats = new Map(ids.map((id) => [id, {
    points: 0,
    games: 0,
    wins: 0,
    byRole: emptyRoleBuckets(),
  }]))
  for (const row of played) {
    if (!row.userId || !stats.has(row.userId)) continue
    const bucket = stats.get(row.userId)
    bucket.points += scoreOf(row)
    bucket.games += 1
    const won = roleWon(row.playerRole, row.gameResult)
    if (won === true) bucket.wins += 1
    const role = normalizeRole(row.playerRole)
    if (role && bucket.byRole.has(role)) {
      applyPlay(bucket.byRole.get(role), won)
    } else if (role) {
      if (!bucket.byRole.has(role)) {
        bucket.byRole.set(role, { role, label: role, games: 0, wins: 0 })
      }
      applyPlay(bucket.byRole.get(role), won)
    }
  }
  return players
    .map((player) => {
      const row = stats.get(player.id)
      return {
        id: player.id,
        nick: player.displayName,
        points: row.points,
        games: row.games,
        wins: row.wins,
        winRate: winRate(row.wins, row.games),
        byRole: roleStatsList(row.byRole),
      }
    })
    .sort((a, b) => b.points - a.points || a.nick.localeCompare(b.nick, 'ru'))
}

/** Stats for one user (PLAYER or anyone with published games). */
export async function playerGameStats(userId) {
  if (!userId) return null
  const nightFilter = {
    status: { not: 'CANCELLED' },
  }
  const played = await prisma.partyPlayer.findMany({
    where: {
      userId,
      attendanceStatus: { not: 'SKIPPED' },
      party: {
        status: { in: ['PUBLISHED', 'DONE'] },
        night: nightFilter,
      },
    },
    select: {
      playerRole: true,
      gameResult: true,
      basePoints: true,
      extraPoints: true,
      penaltyPoints: true,
      attendanceStatus: true,
    },
  })
  const byRole = emptyRoleBuckets()
  let points = 0
  let games = 0
  let wins = 0
  for (const row of played) {
    points += scoreOf(row)
    games += 1
    const won = roleWon(row.playerRole, row.gameResult)
    if (won === true) wins += 1
    const role = normalizeRole(row.playerRole)
    if (role && byRole.has(role)) applyPlay(byRole.get(role), won)
    else if (role) {
      if (!byRole.has(role)) byRole.set(role, { role, label: role, games: 0, wins: 0 })
      applyPlay(byRole.get(role), won)
    }
  }
  return {
    points,
    games,
    wins,
    winRate: winRate(wins, games),
    byRole: roleStatsList(byRole),
  }
}
