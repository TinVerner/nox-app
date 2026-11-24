import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { alignClassicRules, findActivePointRule } from '../point-rules/rules.js'
import { ROLE_CODES, SIDE_CODES, lineScore, nightSums, parseExtra, round2 } from './calc.js'

function canReadPlayed(user) {
  return user && (user.role === 'PLAYER' || user.role === 'HOST' || user.role === 'ADMIN')
}

async function loadPublishedParties(nightId) {
  return prisma.party.findMany({
    where: { gameNightId: nightId, status: { in: [...PUBLISHED] } },
    orderBy: { partyNumber: 'asc' },
    include: {
      players: {
        orderBy: { id: 'asc' },
        include: {
          user: { select: { id: true, displayName: true } },
          guest: true,
        },
      },
    },
  })
}

function publishedDetail(night, parties) {
  const shown = parties.map(sheetParty)
  return {
    night: {
      ...nightMeta(night),
      endsAt: night.endsAt,
    },
    parties: shown,
    totals: nightSums(shown),
  }
}

const router = Router()
const PUBLISHED = new Set(['PUBLISHED', 'DONE'])
const MIN_CONFIRMED = 8

function playerKind(player) {
  if (player.bookingGuestId) return 'GUEST'
  if (player.userId) return 'PLAYER'
  return 'LEGACY'
}

function playerLabel(player) {
  if (player.guest) return player.guest.displayName
  if (player.user) return player.user.displayName
  return player.playerName
}

function sheetPlayer(player) {
  const attendance = player.attendanceStatus === 'SKIPPED' ? 'SKIPPED' : 'PRESENT'
  const scored = lineScore(attendance, num(player.basePoints), num(player.extraPoints))
  return {
    id: player.id,
    userId: player.userId,
    guestId: player.bookingGuestId,
    kind: playerKind(player),
    label: playerLabel(player),
    attendance,
    role: player.playerRole || '',
    extraPoints: scored.extra,
    note: player.note || '',
    basePoints: scored.base,
    total: scored.total,
  }
}

function sheetParty(party) {
  const players = party.players.map(sheetPlayer)
  return {
    id: party.id,
    partyNumber: party.partyNumber,
    status: party.status,
    winningSide: party.winningSide || '',
    players,
  }
}

async function confirmedRoster(nightId) {
  const bookings = await prisma.booking.findMany({
    where: { gameNightId: nightId, status: 'CONFIRMED' },
    orderBy: { id: 'asc' },
    include: { user: { select: { id: true, displayName: true, role: true } } },
  })
  const roster = []
  const seen = new Set()
  for (const booking of bookings) {
    const user = booking.user
    if (!user || user.role !== 'PLAYER' || seen.has(user.id)) continue
    seen.add(user.id)
    roster.push({ kind: 'PLAYER', userId: user.id, label: user.displayName })
  }
  return roster
}

function isProtectedPlayer(row, confirmedIds) {
  if (row.bookingGuestId || !row.userId) return true
  return !confirmedIds.has(row.userId)
}

function partyIsEditable(party, confirmedIds) {
  return party.players.every((row) => row.userId && !row.bookingGuestId && confirmedIds.has(row.userId))
}

function blankFromRoster(roster) {
  return {
    id: null,
    partyNumber: 1,
    status: 'DRAFT',
    winningSide: '',
    players: roster.map((person) => ({
      id: null,
      userId: person.userId || null,
      guestId: person.guestId || null,
      kind: person.kind,
      label: person.label,
      attendance: 'PRESENT',
      role: '',
      extraPoints: 0,
      note: '',
      basePoints: 0,
      total: 0,
    })),
  }
}

function nightStarted(night, now = Date.now()) {
  const start = night.startsAt instanceof Date ? night.startsAt.getTime() : new Date(night.startsAt).getTime()
  return !Number.isNaN(start) && start <= now
}

function nightMeta(night) {
  return {
    id: night.id,
    title: night.title,
    format: night.format,
    startsAt: night.startsAt,
  }
}

async function readSheet(night) {
  const roster = await confirmedRoster(night.id)
  const allowed = new Set(roster.map((person) => person.userId))
  const started = nightStarted(night)
  // До старта запись ещё открыта — не объявляем вечер несостоявшимся по min-8.
  if (!started) {
    return {
      night: nightMeta(night),
      persisted: false,
      started: false,
      held: null,
      confirmedCount: roster.length,
      minimum: MIN_CONFIRMED,
      roster: [],
      parties: [],
      totals: [],
    }
  }
  if (roster.length < MIN_CONFIRMED) {
    return {
      night: nightMeta(night),
      persisted: false,
      started: true,
      held: false,
      confirmedCount: roster.length,
      minimum: MIN_CONFIRMED,
      roster: [],
      parties: [],
      totals: [],
    }
  }
  const parties = await prisma.party.findMany({
    where: { gameNightId: night.id },
    orderBy: { partyNumber: 'asc' },
    include: {
      players: {
        orderBy: { id: 'asc' },
        include: {
          user: { select: { id: true, displayName: true } },
          guest: true,
        },
      },
    },
  })
  const editable = parties.filter((party) => partyIsEditable(party, allowed))
  const shown = editable.length ? editable.map(sheetParty) : [blankFromRoster(roster)]
  return {
    night: nightMeta(night),
    persisted: editable.length > 0,
    started: true,
    held: true,
    confirmedCount: roster.length,
    minimum: MIN_CONFIRMED,
    roster,
    parties: shown,
    totals: nightSums(shown),
  }
}

async function baseFor(format, role, side) {
  if (!role || !side) return 0
  const rule = await findActivePointRule(format, role, side)
  return rule ? round2(num(rule.points)) : 0
}

function fail(res, status, error) {
  res.status(status).json({ error })
  return null
}

async function prepare(night, body, publish) {
  const parties = Array.isArray(body?.parties) ? body.parties : null
  if (!parties) return { error: 'нужен список партий', status: 400 }
  if (!nightStarted(night)) {
    return { error: 'Вечер ещё не начался', status: 400 }
  }
  const roster = await confirmedRoster(night.id)
  const confirmedIds = new Set(roster.map((person) => person.userId))
  const userMap = new Map(roster.map((person) => [person.userId, person]))
  if (confirmedIds.size < MIN_CONFIRMED) {
    return { error: 'Вечер не состоялся: подтверждено меньше 8 игроков', status: 400 }
  }
  await alignClassicRules()
  if (publish && parties.length === 0) return { error: 'нужна хотя бы одна партия', status: 400 }
  const existingIds = parties.map((party) => Number(party.id)).filter((id) => Number.isInteger(id) && id > 0)
  const existing = existingIds.length
    ? await prisma.partyPlayer.findMany({ where: { party: { gameNightId: night.id, id: { in: existingIds } } } })
    : []
  const existingById = new Map(existing.map((row) => [row.id, row]))
  const prepared = []
  for (const party of parties) {
    const side = String(party.winningSide || '').trim()
    if (side && !SIDE_CODES.includes(side)) return { error: 'неизвестная сторона победы', status: 400 }
    if (publish && !side) return { error: 'у каждой партии нужна сторона победы', status: 400 }
    const seen = new Set()
    const players = []
    for (const raw of party.players || []) {
      const attendance = raw.attendance === 'SKIPPED' ? 'SKIPPED' : 'PRESENT'
      const userId = raw.userId ? Number(raw.userId) : null
      const guestId = raw.guestId ? Number(raw.guestId) : null
      const rowId = raw.id ? Number(raw.id) : null
      const found = rowId ? existingById.get(rowId) : null
      const stored = found && found.userId === userId ? found : null
      if (guestId) return { error: 'запись только для аккаунта', status: 400 }
      if (!userId || !userMap.has(userId)) return { error: 'игрок не записан на этот вечер', status: 400 }
      const key = `user:${userId}`
      if (seen.has(key)) return { error: 'игрок уже есть в этой партии', status: 400 }
      seen.add(key)
      const extra = parseExtra(raw.extraPoints)
      if (!extra.ok) return { error: 'дополнительные очки задайте числом с сотыми', status: 400 }
      let role = String(raw.role || '').trim()
      if (attendance === 'SKIPPED') role = ''
      else if (role && !ROLE_CODES.includes(role)) {
        if (!(stored && stored.playerRole === role)) return { error: 'неизвестная роль', status: 400 }
      }
      if (publish && attendance === 'PRESENT' && !ROLE_CODES.includes(role)) {
        return { error: 'у каждого участника нужна роль', status: 400 }
      }
      const note = String(raw.note || '').trim().slice(0, 500)
      const base = attendance === 'SKIPPED' ? 0 : await baseFor(night.format, role, side)
      const scored = lineScore(attendance, base, extra.value)
      const label = userMap.get(userId).label
      players.push({
        id: stored?.id || null,
        userId,
        guestId: null,
        label,
        attendance,
        role: scored.extra === 0 && attendance === 'SKIPPED' ? '' : role,
        note: attendance === 'SKIPPED' ? '' : note,
        basePoints: scored.base,
        extraPoints: scored.extra,
      })
    }
    prepared.push({
      id: Number.isInteger(Number(party.id)) && Number(party.id) > 0 ? Number(party.id) : null,
      winningSide: side || null,
      players,
    })
  }
  return { prepared, confirmedIds }
}

async function writeSheet(night, prepared, userId, publish, confirmedIds) {
  const status = publish ? 'PUBLISHED' : 'DRAFT'
  await prisma.$transaction(async (tx) => {
    const existing = await tx.party.findMany({
      where: { gameNightId: night.id },
      include: { players: true },
    })
    const protectedParties = existing.filter((party) => !partyIsEditable(party, confirmedIds))
    const editable = existing.filter((party) => partyIsEditable(party, confirmedIds))
    for (const party of editable) {
      await tx.party.update({ where: { id: party.id }, data: { partyNumber: 200000 + party.id } })
    }
    const editableIds = new Set(editable.map((party) => party.id))
    const usedNumbers = new Set(protectedParties.map((party) => party.partyNumber))
    const kept = []
    for (const party of prepared) {
      if (party.id && !editableIds.has(party.id)) {
        const error = new Error('партия не найдена')
        error.status = 404
        throw error
      }
      let saved
      if (party.id) {
        saved = await tx.party.update({
          where: { id: party.id },
          data: {
            winningSide: party.winningSide,
            status,
            finalizedAt: publish ? new Date() : null,
          },
        })
      } else {
        saved = await tx.party.create({
          data: {
            gameNightId: night.id,
            partyNumber: 100000 + kept.length,
            createdBy: userId,
            status,
            winningSide: party.winningSide,
            finalizedAt: publish ? new Date() : null,
          },
        })
      }
      const currentPlayers = await tx.partyPlayer.findMany({ where: { partyId: saved.id } })
      const keepPlayers = new Set()
      for (const player of party.players) {
        const data = {
          userId: player.userId,
          bookingGuestId: null,
          playerName: player.label || 'игрок',
          playerRole: player.role,
          gameResult: party.winningSide || '',
          basePoints: player.basePoints,
          extraPoints: player.extraPoints,
          penaltyPoints: 0,
          attendanceStatus: player.attendance,
          note: player.note || null,
        }
        const match = player.id
          ? currentPlayers.find((row) => row.id === player.id && row.userId === player.userId)
          : currentPlayers.find((row) => row.userId === player.userId)
        if (match && !isProtectedPlayer(match, confirmedIds)) {
          await tx.partyPlayer.update({ where: { id: match.id }, data })
          keepPlayers.add(match.id)
        } else {
          const created = await tx.partyPlayer.create({ data: { ...data, partyId: saved.id } })
          keepPlayers.add(created.id)
        }
      }
      const drop = currentPlayers
        .filter((row) => !keepPlayers.has(row.id) && !isProtectedPlayer(row, confirmedIds))
        .map((row) => row.id)
      if (drop.length) await tx.partyPlayer.deleteMany({ where: { id: { in: drop } } })
      kept.push(saved.id)
    }
    const remove = editable.filter((party) => !kept.includes(party.id)).map((party) => party.id)
    if (remove.length) await tx.party.deleteMany({ where: { id: { in: remove } } })
    let number = 1
    for (const id of kept) {
      while (usedNumbers.has(number)) number += 1
      await tx.party.update({ where: { id }, data: { partyNumber: number } })
      usedNumbers.add(number)
      number += 1
    }
  })
}

router.get('/played', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (!canReadPlayed(me)) return res.status(403).json({ error: 'нет доступа' })
  const nights = await prisma.gameNight.findMany({
    where: {
      status: { not: 'CANCELLED' },
      parties: { some: { status: { in: [...PUBLISHED] } } },
    },
    orderBy: { startsAt: 'desc' },
    include: {
      parties: {
        where: { status: { in: [...PUBLISHED] } },
        select: { id: true, finalizedAt: true },
      },
    },
  })
  res.json(nights.map((night) => {
    let publishedAt = null
    for (const party of night.parties) {
      if (!party.finalizedAt) continue
      if (!publishedAt || party.finalizedAt.getTime() > publishedAt.getTime()) {
        publishedAt = party.finalizedAt
      }
    }
    return {
      id: night.id,
      title: night.title,
      format: night.format,
      startsAt: night.startsAt,
      endsAt: night.endsAt,
      partyCount: night.parties.length,
      publishedAt,
    }
  }))
})

router.get('/played/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (!canReadPlayed(me)) return res.status(403).json({ error: 'нет доступа' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night || night.status === 'CANCELLED') return res.status(404).json({ error: 'вечер не найден' })
  const parties = await loadPublishedParties(night.id)
  if (!parties.length) return res.status(404).json({ error: 'результаты не опубликованы' })
  res.json(publishedDetail(night, parties))
})

router.get('/games/:id/results', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  res.json(await readSheet(night))
})

router.post('/games/:id/results', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const publish = req.body?.mode === 'publish'
  const prepared = await prepare(night, req.body, publish)
  if (prepared.error) return fail(res, prepared.status, prepared.error)
  try {
    await writeSheet(night, prepared.prepared, me.id, publish, prepared.confirmedIds)
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message })
    throw error
  }
  res.json(await readSheet(night))
})

router.delete('/games/:id/parties/:partyId', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const nightId = idParam(req.params.id)
  const partyId = idParam(req.params.partyId)
  const night = nightId ? await prisma.gameNight.findUnique({ where: { id: nightId } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  if (!nightStarted(night)) return res.status(400).json({ error: 'Вечер ещё не начался' })
  const roster = await confirmedRoster(night.id)
  const confirmedIds = new Set(roster.map((person) => person.userId))
  if (confirmedIds.size < MIN_CONFIRMED) {
    return res.status(400).json({ error: 'Вечер не состоялся: подтверждено меньше 8 игроков' })
  }
  const party = partyId
    ? await prisma.party.findFirst({
      where: { id: partyId, gameNightId: night.id },
      include: { players: true },
    })
    : null
  if (!party) return res.status(404).json({ error: 'партия не найдена' })
  if (!partyIsEditable(party, confirmedIds)) {
    return res.status(409).json({ error: 'эту партию нельзя удалить' })
  }
  await prisma.$transaction(async (tx) => {
    await tx.partyPlayer.deleteMany({ where: { partyId: party.id } })
    await tx.party.delete({ where: { id: party.id } })
    const left = await tx.party.findMany({
      where: { gameNightId: night.id },
      orderBy: { partyNumber: 'asc' },
    })
    let number = 1
    for (const row of left) {
      if (row.partyNumber !== number) {
        await tx.party.update({ where: { id: row.id }, data: { partyNumber: number } })
      }
      number += 1
    }
  })
  res.json(await readSheet(night))
})

export { PUBLISHED }
export default router
