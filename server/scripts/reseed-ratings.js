/**
 * Careful rating reseed: drop invented party scores, keep Tin's real night,
 * insert a few published past nights with real players + point-rule scores.
 * Does NOT drop DB / wipe volume nox_pg_data.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { alignClassicRules, findActivePointRule } from '../src/modules/point-rules/rules.js'
import { round2 } from '../src/modules/results/calc.js'
import { num } from '../src/shared/input.js'

const prisma = new PrismaClient()

const PRESERVE_TITLE = 'Пятничная мафия'
const FAKE_NIGHT_TITLES = ['Таблица сезона']
const SEED_TAG = 'reseed-ratings-2026-11'

const CLASSIC_LINEUP = [
  'CIVILIAN', 'CIVILIAN', 'CIVILIAN', 'CIVILIAN', 'CIVILIAN', 'CIVILIAN',
  'SHERIFF', 'MAFIA', 'MAFIA', 'DON',
]

const SEED_NIGHTS = [
  {
    title: 'Классика 4 октября',
    startsAt: new Date('2026-10-04T16:00:00+03:00'),
    endsAt: new Date('2026-10-04T20:00:00+03:00'),
    parties: [
      { winningSide: 'CITY', extras: { 0: 0.25 } },
      { winningSide: 'MAFIA', extras: { 7: 0.5 } },
    ],
  },
  {
    title: 'Классика 18 октября',
    startsAt: new Date('2026-10-18T16:00:00+03:00'),
    endsAt: new Date('2026-10-18T20:00:00+03:00'),
    parties: [
      { winningSide: 'MAFIA' },
      { winningSide: 'CITY', extras: { 6: 0.25 } },
      { winningSide: 'CITY' },
    ],
  },
  {
    title: 'Классика 8 ноября',
    startsAt: new Date('2026-11-08T17:00:00+03:00'),
    endsAt: new Date('2026-11-08T21:00:00+03:00'),
    parties: [
      { winningSide: 'CITY' },
      { winningSide: 'MAFIA', extras: { 9: 0.25, 1: 0.5 } },
    ],
  },
]

function rotateRoles(offset) {
  const list = [...CLASSIC_LINEUP]
  for (let i = 0; i < offset; i += 1) list.push(list.shift())
  return list
}

async function basePoints(format, role, side) {
  if (!role || !side) return 0
  const rule = await findActivePointRule(format, role, side)
  return rule ? round2(num(rule.points)) : 0
}

async function clearFakeParties() {
  const cleared = []
  for (const title of FAKE_NIGHT_TITLES) {
    const night = await prisma.gameNight.findFirst({ where: { title } })
    if (!night) continue
    const parties = await prisma.party.findMany({ where: { gameNightId: night.id }, select: { id: true } })
    const ids = parties.map((party) => party.id)
    if (ids.length) {
      await prisma.partyPlayer.deleteMany({ where: { partyId: { in: ids } } })
      await prisma.party.deleteMany({ where: { id: { in: ids } } })
    }
    // Cancelled invented night: hard-delete so it leaves Сыгранные/rating forever
    const bookings = await prisma.booking.findMany({ where: { gameNightId: night.id }, select: { id: true } })
    const bookingIds = bookings.map((row) => row.id)
    if (bookingIds.length) {
      await prisma.bookingGuest.deleteMany({ where: { bookingId: { in: bookingIds } } })
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } })
    }
    await prisma.gameNight.delete({ where: { id: night.id } })
    cleared.push({ title, parties: ids.length, nightDeleted: true })
  }

  // Субботняя мафия: invented 2-player DONE party without proper sides
  const saturday = await prisma.gameNight.findFirst({ where: { title: 'Субботняя мафия' } })
  if (saturday) {
    const fake = await prisma.party.findMany({
      where: {
        gameNightId: saturday.id,
        OR: [
          { winningSide: null },
          { players: { some: { playerRole: { in: ['Мирный', 'Мафия', 'Шериф', 'Дон'] } } } },
        ],
      },
      include: { players: true },
    })
    for (const party of fake) {
      await prisma.partyPlayer.deleteMany({ where: { partyId: party.id } })
      await prisma.party.delete({ where: { id: party.id } })
      cleared.push({ title: saturday.title, parties: 1, nightDeleted: false, partyId: party.id })
    }
  }
  return cleared
}

async function ensureBookings(nightId, players) {
  for (const user of players) {
    await prisma.booking.upsert({
      where: { gameNightId_userId: { gameNightId: nightId, userId: user.id } },
      create: { gameNightId: nightId, userId: user.id, status: 'CONFIRMED' },
      update: { status: 'CONFIRMED', cancelledAt: null, cancellationReason: null },
    })
  }
}

async function writePublishedParties(night, players, partyDefs, hostId) {
  const existing = await prisma.party.count({ where: { gameNightId: night.id } })
  if (existing > 0) {
    return { skipped: true, reason: 'parties already exist', count: existing }
  }
  const created = []
  for (let index = 0; index < partyDefs.length; index += 1) {
    const def = partyDefs[index]
    const roles = rotateRoles(index + night.id)
    const party = await prisma.party.create({
      data: {
        gameNightId: night.id,
        partyNumber: index + 1,
        createdBy: hostId,
        status: 'PUBLISHED',
        winningSide: def.winningSide,
        finalizedAt: night.endsAt || new Date(night.startsAt.getTime() + 4 * 60 * 60 * 1000),
      },
    })
    const rows = []
    for (let seat = 0; seat < players.length; seat += 1) {
      const user = players[seat]
      const role = roles[seat % roles.length]
      const extra = round2(def.extras?.[seat] || 0)
      const base = await basePoints(night.format, role, def.winningSide)
      rows.push({
        partyId: party.id,
        userId: user.id,
        playerName: user.displayName,
        playerRole: role,
        gameResult: def.winningSide,
        basePoints: base,
        extraPoints: extra,
        attendanceStatus: 'PRESENT',
        note: SEED_TAG,
      })
    }
    await prisma.partyPlayer.createMany({ data: rows })
    created.push({ partyNumber: index + 1, winningSide: def.winningSide, players: rows.length })
  }
  return { skipped: false, created }
}

async function main() {
  await alignClassicRules()
  const host = await prisma.user.findFirst({
    where: { role: 'HOST', OR: [{ email: 'tin2@nox.club' }, { email: 'tin@nox.club' }] },
    orderBy: { id: 'asc' },
  }) || await prisma.user.findFirst({ where: { role: 'HOST' }, orderBy: { id: 'asc' } })
  if (!host) throw new Error('no HOST user found')

  let season = await prisma.season.findFirst({ where: { status: 'OPEN' }, orderBy: { startsOn: 'desc' } })
  if (!season) {
    season = await prisma.season.findFirst({ orderBy: { startsOn: 'desc' } })
  }

  const preserve = await prisma.gameNight.findFirst({
    where: { title: PRESERVE_TITLE },
    include: { parties: { where: { status: { in: ['PUBLISHED', 'DONE'] } }, select: { id: true, status: true } } },
  })

  const cleared = await clearFakeParties()

  // Prefer the same cohort as Tin's real night, then fill up to 10
  const preferredNames = ['qwerty', 'maxx', 'Дентесса', 'Бротузик', 'Арчи', 'Серафима', 'Маркиза', 'Волк', 'Лиса', 'Ворон']
  const allPlayers = await prisma.user.findMany({
    where: { role: 'PLAYER', status: 'ACTIVE' },
    orderBy: { id: 'asc' },
  })
  const byName = new Map(allPlayers.map((user) => [user.displayName, user]))
  const players = []
  for (const name of preferredNames) {
    const user = byName.get(name)
    if (user) players.push(user)
  }
  for (const user of allPlayers) {
    if (players.length >= 10) break
    if (!players.some((row) => row.id === user.id)) players.push(user)
  }
  if (players.length < 8) throw new Error('need at least 8 active players')

  const seeded = []
  for (const def of SEED_NIGHTS) {
    let night = await prisma.gameNight.findFirst({ where: { title: def.title } })
    if (!night) {
      night = await prisma.gameNight.create({
        data: {
          hostId: host.id,
          seasonId: season?.id || null,
          title: def.title,
          description: 'Опубликованный вечер для рейтинга (seed).',
          format: 'CLASSIC',
          capacity: 12,
          status: 'DONE',
          startsAt: def.startsAt,
          endsAt: def.endsAt,
          registrationDeadlineAt: new Date(def.startsAt.getTime() - 3 * 60 * 60 * 1000),
        },
      })
    } else {
      await prisma.gameNight.update({
        where: { id: night.id },
        data: {
          status: 'DONE',
          format: 'CLASSIC',
          startsAt: def.startsAt,
          endsAt: def.endsAt,
          description: night.description || 'Опубликованный вечер для рейтинга (seed).',
        },
      })
      night = await prisma.gameNight.findUnique({ where: { id: night.id } })
    }
    await ensureBookings(night.id, players)
    const result = await writePublishedParties(night, players, def.parties, host.id)
    seeded.push({
      id: night.id,
      title: night.title,
      startsAt: night.startsAt.toISOString(),
      partyCount: def.parties.length,
      players: players.length,
      ...result,
    })
  }

  // Optional: give Субботняя мафия one real published party if still empty
  const saturday = await prisma.gameNight.findFirst({ where: { title: 'Субботняя мафия' } })
  if (saturday) {
    const partyCount = await prisma.party.count({ where: { gameNightId: saturday.id } })
    if (partyCount === 0) {
      await ensureBookings(saturday.id, players)
      await prisma.gameNight.update({
        where: { id: saturday.id },
        data: { status: 'DONE', format: 'CLASSIC' },
      })
      const result = await writePublishedParties(
        { ...saturday, format: 'CLASSIC' },
        players,
        [{ winningSide: 'CITY', extras: { 2: 0.25 } }],
        host.id,
      )
      seeded.push({
        id: saturday.id,
        title: saturday.title,
        startsAt: saturday.startsAt.toISOString(),
        partyCount: 1,
        players: players.length,
        ...result,
      })
    }
  }

  const ratingSample = await prisma.$queryRaw`
    SELECT u.display_name AS nick,
           COUNT(pp.id)::int AS games,
           ROUND(SUM(pp.base_points + pp.extra_points)::numeric, 2) AS points
    FROM users u
    JOIN party_players pp ON pp.user_id = u.id AND pp.attendance_status <> 'SKIPPED'
    JOIN parties p ON p.id = pp.party_id AND p.status IN ('PUBLISHED', 'DONE')
    JOIN game_nights gn ON gn.id = p.game_night_id AND gn.status <> 'CANCELLED'
    WHERE u.role = 'PLAYER'
    GROUP BY u.id, u.display_name
    ORDER BY points DESC, nick ASC
    LIMIT 8
  `

  const publishedNights = await prisma.gameNight.findMany({
    where: {
      status: { not: 'CANCELLED' },
      parties: { some: { status: { in: ['PUBLISHED', 'DONE'] } } },
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      title: true,
      startsAt: true,
      parties: { where: { status: { in: ['PUBLISHED', 'DONE'] } }, select: { id: true } },
    },
  })

  console.log(JSON.stringify({
    preserve: preserve
      ? { id: preserve.id, title: preserve.title, publishedParties: preserve.parties.length }
      : null,
    cleared,
    seeded,
    publishedNights: publishedNights.map((night) => ({
      id: night.id,
      title: night.title,
      startsAt: night.startsAt,
      parties: night.parties.length,
    })),
    ratingTop: ratingSample,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
