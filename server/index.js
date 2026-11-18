import 'dotenv/config'
import crypto from 'crypto'
import http from 'http'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { WebSocketServer } from 'ws'
import { ensureAutumn } from './season.js'

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('Не задан SESSION_SECRET')
}

const RANK_LABEL = {
  MASTER: 'Мастер ★',
  MASTER_PRO: 'Мастер Про ★★',
  LEGEND: 'Легенда',
}
const RANK_DEFS = [
  { code: 'MASTER', name: 'Мастер ★', criteria: { games: 90 }, benefits: 'Скидка 5 BYN на открытую игру' },
  { code: 'MASTER_PRO', name: 'Мастер Про ★★', criteria: { winrate: 75, games: 50 }, benefits: 'Скидка 10 BYN на открытую игру и 20% на вечеринки' },
  { code: 'LEGEND', name: 'Легенда', criteria: { winrate: 85, games: 50 }, benefits: 'Скидка 15 BYN на открытую игру и 50% на вечеринки' },
]
const SANCTION_DELTA = { LATE_10: -5, LATE_MORE: -10, NO_SHOW: -15, WARNING: 0 }
const PUBLIC_NIGHT = new Set(['PUBLISHED', 'OPEN'])
const POINT_DEFAULTS = [
  ['CLASSIC', 'Мирный', 'Победа', 1],
  ['CLASSIC', 'Мирный', 'Поражение', 0],
  ['CLASSIC', 'Мафия', 'Победа', 1],
  ['CLASSIC', 'Мафия', 'Поражение', 0],
  ['CLASSIC', 'Шериф', 'Победа', 1],
  ['CLASSIC', 'Дон', 'Победа', 1],
]

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000
const SESSION_MS = 14 * 24 * 60 * 60 * 1000

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

function setSessionCookie(res, id) {
  res.setHeader('Set-Cookie', `nox.sid=${encodeURIComponent(id)}; HttpOnly; Path=/; SameSite=Lax`)
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'nox.sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
}

app.use(async (req, res, next) => {
  try {
    const sid = readCookie(req, 'nox.sid')
    if (!sid) return next()
    const row = await prisma.session.findUnique({ where: { id: sid } })
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) await prisma.session.delete({ where: { id: row.id } }).catch(() => {})
      return next()
    }
    req.sessionId = row.id
    req.userId = row.userId
    next()
  } catch (error) {
    next(error)
  }
})

function num(value) {
  if (value == null || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function idParam(value) {
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}

function personKey(name) {
  return String(name || '').trim().toLocaleLowerCase('ru')
}

function guestNames(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',')
  const seen = new Set()
  const names = []
  for (const raw of list) {
    const name = String(raw).trim()
    const key = personKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name)
    if (names.length === 8) break
  }
  return names
}

function passwordMeetsRules(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /\d/.test(password) &&
    /[A-ZА-ЯЁ]/.test(password) &&
    /[^0-9A-Za-zА-Яа-яЁё]/.test(password)
  )
}

function isStaff(user) {
  return user && (user.role === 'HOST' || user.role === 'ADMIN')
}

async function meOrNull(req) {
  if (!req.userId) return null
  return prisma.user.findUnique({ where: { id: req.userId } })
}

async function openSession(res, userId) {
  const id = crypto.randomBytes(32).toString('hex')
  await prisma.session.create({
    data: { id, userId, expiresAt: new Date(Date.now() + SESSION_MS) },
  })
  setSessionCookie(res, id)
}

async function ensureRanks() {
  for (const rank of RANK_DEFS) {
    await prisma.rankDefinition.upsert({
      where: { code: rank.code },
      update: {},
      create: rank,
    })
  }
}

async function rankCodes(userIds) {
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

function userJson(user, rankCode) {
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

async function clubSettings() {
  const defaults = {
    club_name: { value: 'NOX', description: 'Название клуба' },
    booking_open: { value: true, description: 'Запись открыта' },
    waitlist_size: { value: 4, description: 'Размер листа ожидания' },
  }
  const rows = await prisma.appSetting.findMany()
  const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]))
  for (const [key, item] of Object.entries(defaults)) {
    if (map.has(key)) continue
    await prisma.appSetting.create({
      data: { settingKey: key, settingValue: item.value, description: item.description },
    })
    map.set(key, item.value)
  }
  return {
    name: String(map.get('club_name') ?? 'NOX'),
    bookingOpen: map.get('booking_open') !== false,
    waitlistSize: Number(map.get('waitlist_size') ?? 4),
  }
}

async function ensurePointRules() {
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

function nightJson(night, taken = 0) {
  return {
    id: night.id,
    title: night.title,
    startsAt: night.startsAt,
    place: night.description || '',
    description: night.description || '',
    registrationDeadlineAt: night.registrationDeadlineAt,
    imagePath: night.imagePath || '',
    seats: night.capacity,
    capacity: night.capacity,
    status: night.status,
    kind: night.format,
    format: night.format,
    price: 0,
    seasonId: night.seasonId,
    hostId: night.hostId,
    taken,
  }
}

function nightExtras(body) {
  const data = {}
  if (body.description !== undefined || body.place !== undefined) {
    data.description = String(body.description ?? body.place ?? '')
  }
  if (body.registrationDeadlineAt !== undefined) {
    data.registrationDeadlineAt = body.registrationDeadlineAt ? new Date(body.registrationDeadlineAt) : null
  }
  if (body.imagePath !== undefined) {
    const path = String(body.imagePath || '').trim()
    data.imagePath = path || null
  }
  return data
}

async function takenCounts(nightIds) {
  const ids = [...new Set(nightIds.filter(Boolean))]
  const map = new Map(ids.map((id) => [id, 0]))
  if (!ids.length) return map
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', gameNightId: { in: ids } },
    include: { guests: true, user: { select: { displayName: true } } },
  })
  const people = new Map()
  for (const booking of bookings) {
    if (!people.has(booking.gameNightId)) people.set(booking.gameNightId, new Set())
    const set = people.get(booking.gameNightId)
    const nick = personKey(booking.user?.displayName)
    set.add(nick || `user:${booking.userId}`)
    for (const guest of booking.guests) {
      const key = personKey(guest.displayName)
      if (key) set.add(key)
    }
  }
  for (const [id, set] of people) map.set(id, set.size)
  return map
}

function scoreOf(row) {
  return num(row.basePoints) + num(row.extraPoints) - num(row.penaltyPoints)
}

async function ratingList() {
  await ensureRanks()
  const players = await prisma.user.findMany({
    where: { role: 'PLAYER' },
    select: { id: true, displayName: true },
  })
  const ids = players.map((player) => player.id)
  const played = ids.length
    ? await prisma.partyPlayer.findMany({
      where: { OR: [{ userId: { in: ids } }, { playerName: { in: players.map((player) => player.displayName) } }] },
      select: { userId: true, playerName: true, basePoints: true, extraPoints: true, penaltyPoints: true },
    })
    : []
  const codes = await rankCodes(ids)
  const stats = new Map(ids.map((id) => [id, { points: 0, games: 0 }]))
  for (const row of played) {
    const player = row.userId
      ? players.find((item) => item.id === row.userId)
      : players.find((item) => item.displayName === row.playerName)
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

async function notifyHost(night, message) {
  if (!night?.hostId) return
  await prisma.notification.create({
    data: {
      userId: night.hostId,
      notificationType: 'BOOKING',
      message,
      targetPath: '/games',
    },
  })
  broadcastGames(message)
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'NOX API hello' })
})

app.get('/api/news', async (req, res) => {
  const items = await prisma.newsPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { reactions: true } } },
  })
  const mine = req.userId
    ? new Set((await prisma.reaction.findMany({
      where: { userId: req.userId },
      select: { postId: true },
    })).map((row) => row.postId))
    : new Set()
  res.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.content,
    createdAt: item.createdAt,
    likes: item._count.reactions,
    liked: mine.has(item.id),
  })))
})

app.post('/api/news', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const title = String(req.body.title || '').trim()
  const body = String(req.body.body || '').trim()
  if (!title || !body) return res.status(400).json({ error: 'title и body обязательны' })
  const item = await prisma.newsPost.create({
    data: { authorId: me.id, title, content: body, status: 'PUBLISHED' },
  })
  res.status(201).json({ id: item.id, title: item.title, body: item.content, createdAt: item.createdAt })
})

app.get('/api/news/:id/comments', async (req, res) => {
  const postId = idParam(req.params.id)
  if (!postId) return res.status(404).json({ error: 'новость не найдена' })
  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true } } },
  })
  res.json(comments.map((comment) => ({
    id: comment.id,
    userId: comment.userId,
    body: comment.content,
    createdAt: comment.createdAt,
    nick: comment.user.displayName,
  })))
})

app.post('/api/news/:id/comments', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const content = String(req.body.body || '').trim()
  if (!postId || !content) return res.status(400).json({ error: 'нужен текст' })
  const post = await prisma.newsPost.findUnique({ where: { id: postId } })
  if (!post) return res.status(404).json({ error: 'новость не найдена' })
  const comment = await prisma.comment.create({
    data: { postId, userId: me.id, content },
  })
  res.status(201).json({ id: comment.id, userId: me.id, body: comment.content, createdAt: comment.createdAt, nick: me.displayName })
})

app.delete('/api/news/:id/comments/:commentId', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const commentId = idParam(req.params.commentId)
  const comment = postId && commentId
    ? await prisma.comment.findFirst({ where: { id: commentId, postId } })
    : null
  if (!comment) return res.status(404).json({ error: 'не найдено' })
  if (comment.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  await prisma.comment.delete({ where: { id: comment.id } })
  res.json({ ok: true })
})

app.post('/api/news/:id/reactions', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const post = postId ? await prisma.newsPost.findUnique({ where: { id: postId } }) : null
  if (!post) return res.status(404).json({ error: 'новость не найдена' })
  const where = { postId_userId: { postId, userId: me.id } }
  const existing = await prisma.reaction.findUnique({ where })
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } })
  else await prisma.reaction.create({ data: { postId, userId: me.id, reactionType: 'LIKE' } })
  const likes = await prisma.reaction.count({ where: { postId } })
  res.json({ likes, liked: !existing })
})

app.get('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  const staff = isStaff(me)
  const items = await prisma.gameNight.findMany({
    orderBy: { startsAt: 'asc' },
    include: { season: true },
  })
  const visible = staff
    ? items
    : items.filter((night) => PUBLIC_NIGHT.has(night.status) && night.season?.status !== 'CLOSED')
  const taken = await takenCounts(visible.map((night) => night.id))
  res.json(visible.map((night) => nightJson(night, taken.get(night.id) || 0)))
})

app.post('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const title = String(req.body.title || '').trim()
  const startsAt = req.body.startsAt
  const description = String(req.body.description ?? req.body.place ?? '').trim()
  const capacity = Number(req.body.capacity ?? req.body.seats)
  if (!title || !startsAt || !Number.isInteger(capacity) || capacity < 1) {
    return res.status(400).json({ error: 'title, startsAt, place, seats обязательны' })
  }
  const item = await prisma.gameNight.create({
    data: {
      hostId: me.id,
      title,
      startsAt: new Date(startsAt),
      description,
      capacity,
      format: req.body.format || req.body.kind || 'CLASSIC',
      status: req.body.status || 'PLANNED',
      seasonId: req.body.seasonId ? Number(req.body.seasonId) : null,
      ...nightExtras(req.body),
    },
  })
  res.status(201).json(nightJson(item, 0))
})

app.patch('/api/games/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const data = {}
  if (req.body.title !== undefined) data.title = req.body.title
  if (req.body.startsAt !== undefined) data.startsAt = new Date(req.body.startsAt)
  if (req.body.place !== undefined || req.body.description !== undefined) {
    data.description = req.body.description ?? req.body.place
  }
  if (req.body.seats !== undefined || req.body.capacity !== undefined) {
    data.capacity = Number(req.body.capacity ?? req.body.seats)
  }
  if (req.body.kind !== undefined || req.body.format !== undefined) {
    data.format = req.body.format || req.body.kind
  }
  if (req.body.status !== undefined) data.status = req.body.status
  Object.assign(data, nightExtras(req.body))
  const item = await prisma.gameNight.update({ where: { id }, data })
  const taken = await takenCounts([id])
  res.json(nightJson(item, taken.get(id) || 0))
})

app.post('/api/games/:id/cancel', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  if (night.status === 'CANCELLED') return res.status(409).json({ error: 'вечер уже отменён' })
  const updated = await prisma.gameNight.update({ where: { id }, data: { status: 'CANCELLED' } })
  const bookings = await prisma.booking.findMany({
    where: { gameNightId: id, status: { in: ['CONFIRMED', 'WAITING'] } },
    select: { userId: true },
  })
  if (bookings.length) {
    await prisma.notification.createMany({
      data: bookings.map((booking) => ({
        userId: booking.userId,
        notificationType: 'NIGHT',
        message: `Игра отменена: ${night.title}`,
        targetPath: '/notices',
      })),
    })
  }
  const taken = await takenCounts([id])
  res.json(nightJson(updated, taken.get(id) || 0))
})

app.post('/api/games/:id/book', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'запись только для игроков' })
  if (me.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  if (night.status === 'CANCELLED') return res.status(403).json({ error: 'запись закрыта' })
  // дедлайн записи хранится в game_nights.registration_deadline_at
  if (night.registrationDeadlineAt && night.registrationDeadlineAt.getTime() < Date.now()) {
    return res.status(403).json({ error: 'запись закрыта' })
  }
  const blocked = await prisma.sanction.findFirst({
    where: { userId: me.id, status: 'APPROVED', bookingBlocked: true },
  })
  if (blocked) return res.status(403).json({ error: 'запись закрыта' })
  const settings = await clubSettings()
  if (!settings.bookingOpen) return res.status(403).json({ error: 'запись закрыта' })
  const names = guestNames(req.body?.guests)
  const takenNow = (await takenCounts([night.id])).get(night.id) || 0
  const waiting = await prisma.booking.count({ where: { gameNightId: night.id, status: 'WAITING' } })
  let status = 'CONFIRMED'
  if (takenNow >= night.capacity) {
    if (waiting >= settings.waitlistSize) return res.status(409).json({ error: 'лист ожидания полон' })
    status = 'WAITING'
  }
  const existing = await prisma.booking.findUnique({
    where: { gameNightId_userId: { gameNightId: night.id, userId: me.id } },
  })
  if (existing && existing.status !== 'CANCELLED') return res.status(409).json({ error: 'уже записана' })
  const guestCreate = names.map((displayName) => ({ displayName }))
  const booking = existing
    ? await prisma.booking.update({
      where: { id: existing.id },
      data: {
        status,
        cancelledAt: null,
        cancellationReason: null,
        ...(guestCreate.length ? { guests: { create: guestCreate } } : {}),
      },
      include: { guests: true },
    })
    : await prisma.booking.create({
      data: {
        gameNightId: night.id,
        userId: me.id,
        status,
        ...(guestCreate.length ? { guests: { create: guestCreate } } : {}),
      },
      include: { guests: true },
    })
  res.status(201).json(booking)
  await notifyHost(night, 'Запись на вечер изменилась')
})

app.get('/api/games/:id/parties', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const parties = await prisma.party.findMany({
    where: { gameNightId: night.id },
    orderBy: { partyNumber: 'asc' },
    include: { players: { orderBy: { id: 'asc' } } },
  })
  res.json(parties.map((party) => ({
    id: party.id,
    partyNumber: party.partyNumber,
    status: party.status,
    players: party.players.map((player) => ({
      id: player.id,
      playerName: player.playerName,
      playerRole: player.playerRole,
      gameResult: player.gameResult,
      basePoints: num(player.basePoints),
      extraPoints: num(player.extraPoints),
      penaltyPoints: num(player.penaltyPoints),
      total: scoreOf(player),
    })),
  })))
})

app.post('/api/games/:id/parties', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const night = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
  if (!night) return res.status(404).json({ error: 'игра не найдена' })
  const last = await prisma.party.findFirst({
    where: { gameNightId: night.id },
    orderBy: { partyNumber: 'desc' },
  })
  const party = await prisma.party.create({
    data: { gameNightId: night.id, partyNumber: (last?.partyNumber || 0) + 1, createdBy: me.id },
  })
  res.status(201).json({ id: party.id, partyNumber: party.partyNumber, status: party.status, players: [] })
})

app.post('/api/parties/:id/players', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const party = id ? await prisma.party.findUnique({ where: { id }, include: { night: true } }) : null
  if (!party) return res.status(404).json({ error: 'партия не найдена' })
  const playerName = String(req.body.playerName || req.body.nick || '').trim()
  const playerRole = String(req.body.playerRole || '').trim()
  const gameResult = String(req.body.gameResult || '').trim()
  if (!playerName || !playerRole || !gameResult) {
    return res.status(400).json({ error: 'нужны имя, роль и исход' })
  }
  await ensurePointRules()
  const rule = await prisma.pointRule.findFirst({
    where: { format: party.night.format, playerRole, gameResult, isActive: true },
  })
  const linked = await prisma.user.findFirst({ where: { displayName: playerName, role: 'PLAYER' } })
  const player = await prisma.partyPlayer.create({
    data: {
      partyId: party.id,
      userId: linked?.id,
      playerName,
      playerRole,
      gameResult,
      basePoints: rule ? num(rule.points) : 0,
      extraPoints: num(req.body.extraPoints),
      penaltyPoints: num(req.body.penaltyPoints),
    },
  })
  res.status(201).json({
    id: player.id,
    playerName: player.playerName,
    playerRole: player.playerRole,
    gameResult: player.gameResult,
    basePoints: num(player.basePoints),
    extraPoints: num(player.extraPoints),
    penaltyPoints: num(player.penaltyPoints),
    total: scoreOf(player),
  })
})

app.get('/api/point-rules', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  await ensurePointRules()
  const rules = await prisma.pointRule.findMany({ orderBy: [{ format: 'asc' }, { playerRole: 'asc' }] })
  res.json(rules.map((rule) => ({
    id: rule.id,
    format: rule.format,
    playerRole: rule.playerRole,
    gameResult: rule.gameResult,
    points: num(rule.points),
    isActive: rule.isActive,
  })))
})

app.post('/api/point-rules', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const format = String(req.body.format || '').trim()
  const playerRole = String(req.body.playerRole || '').trim()
  const gameResult = String(req.body.gameResult || '').trim()
  if (!format || !playerRole || !gameResult) return res.status(400).json({ error: 'нужны формат, роль и исход' })
  try {
    const rule = await prisma.pointRule.create({
      data: { format, playerRole, gameResult, points: num(req.body.points), isActive: req.body.isActive !== false },
    })
    res.status(201).json({
      id: rule.id,
      format: rule.format,
      playerRole: rule.playerRole,
      gameResult: rule.gameResult,
      points: num(rule.points),
      isActive: rule.isActive,
    })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'такое правило уже есть' })
    throw error
  }
})

app.patch('/api/point-rules/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const rule = id ? await prisma.pointRule.findUnique({ where: { id } }) : null
  if (!rule) return res.status(404).json({ error: 'не найдено' })
  const data = {}
  if (req.body.points !== undefined) data.points = num(req.body.points)
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive)
  const updated = await prisma.pointRule.update({ where: { id }, data })
  res.json({
    id: updated.id,
    format: updated.format,
    playerRole: updated.playerRole,
    gameResult: updated.gameResult,
    points: num(updated.points),
    isActive: updated.isActive,
  })
})

app.get('/api/bookings', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const bookings = await prisma.booking.findMany({
    where: { userId: me.id, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    include: { guests: { orderBy: { createdAt: 'asc' } }, night: true },
  })
  const nightIds = bookings.map((booking) => booking.gameNightId)
  const taken = await takenCounts(nightIds)
  const played = nightIds.length
    ? await prisma.partyPlayer.findMany({
      where: { userId: me.id, party: { gameNightId: { in: nightIds } } },
      include: { party: { select: { gameNightId: true } } },
    })
    : []
  const pointsByNight = new Map()
  for (const row of played) {
    const key = row.party.gameNightId
    pointsByNight.set(key, (pointsByNight.get(key) || 0) + scoreOf(row))
  }
  res.json(bookings.map((booking) => ({
    id: booking.id,
    gameId: booking.gameNightId,
    status: booking.status,
    gameStatus: booking.night?.status ?? null,
    title: booking.night?.title ?? null,
    startsAt: booking.night?.startsAt ?? null,
    place: booking.night?.description || '',
    seats: booking.night?.capacity ?? null,
    taken: taken.get(booking.gameNightId) || 0,
    points: pointsByNight.has(booking.gameNightId) ? pointsByNight.get(booking.gameNightId) : null,
    guests: booking.guests.map((guest) => ({ id: guest.id, name: guest.displayName })),
  })))
})

app.delete('/api/bookings/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true } }) : null
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'отмена игроком' },
  })
  await prisma.bookingGuest.deleteMany({ where: { bookingId: booking.id } })
  res.json({ ok: true })
  await notifyHost(booking.night, 'Запись на вечер отменена')
})

app.post('/api/bookings/:id/guests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true, guests: true } }) : null
  if (!booking || booking.status === 'CANCELLED') return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  const [name] = guestNames(req.body?.name)
  if (!name) return res.status(400).json({ error: 'нужно имя гостя' })
  if (booking.guests.some((guest) => personKey(guest.displayName) === personKey(name))) {
    return res.status(409).json({ error: 'этот гость уже указан' })
  }
  const guest = await prisma.bookingGuest.create({ data: { bookingId: booking.id, displayName: name } })
  const taken = (await takenCounts([booking.gameNightId])).get(booking.gameNightId) || 0
  res.status(201).json({ id: guest.id, name: guest.displayName, taken })
  if (booking.status === 'CONFIRMED') await notifyHost(booking.night, 'Запись на вечер изменилась')
})

app.delete('/api/bookings/:id/guests/:guestId', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const guestId = idParam(req.params.guestId)
  const booking = id ? await prisma.booking.findUnique({ where: { id }, include: { night: true } }) : null
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  const guest = guestId ? await prisma.bookingGuest.findUnique({ where: { id: guestId } }) : null
  if (!guest || guest.bookingId !== booking.id) return res.status(404).json({ error: 'гость не найден' })
  await prisma.bookingGuest.delete({ where: { id: guest.id } })
  const taken = (await takenCounts([booking.gameNightId])).get(booking.gameNightId) || 0
  res.json({ ok: true, taken })
  if (booking.status === 'CONFIRMED') await notifyHost(booking.night, 'Запись на вечер изменилась')
})

app.get('/api/rating', async (req, res) => {
  res.json(await ratingList())
})

app.get('/api/seasons', async (req, res) => {
  const seasons = await ensureAutumn(prisma)
  res.json(seasons.map((season) => ({
    id: season.id,
    name: season.name,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    status: season.status,
    closed: season.status === 'CLOSED',
  })))
})

app.patch('/api/seasons/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  if (req.body.closed !== true) return res.status(400).json({ error: 'closed: true' })
  const id = idParam(req.params.id)
  const season = id ? await prisma.season.findUnique({ where: { id } }) : null
  if (!season) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.season.update({ where: { id }, data: { status: 'CLOSED' } })
  res.json({
    id: updated.id,
    name: updated.name,
    startsOn: updated.startsOn,
    endsOn: updated.endsOn,
    status: updated.status,
    closed: true,
  })
})

app.get('/api/members', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'нельзя' })
  await ensureRanks()
  const members = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    orderBy: { displayName: 'asc' },
  })
  const codes = await rankCodes(members.map((member) => member.id))
  res.json(members.map((member) => ({
    id: member.id,
    nick: member.displayName,
    role: member.role,
    rank: codes.get(member.id) || null,
  })))
})

app.patch('/api/members/:id/rank', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  await ensureRanks()
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const rank = req.body.rank || null
  // пустое значение снимает подтверждённый ранг; новый ранг идёт через заявку
  if (rank) return res.status(400).json({ error: 'ранг подтверждается по заявке' })
  await prisma.userRank.deleteMany({ where: { userId: user.id, status: 'CONFIRMED' } })
  res.json({ id: user.id, nick: user.displayName, role: user.role, rank: null })
})

app.get('/api/rank-requests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const where = isStaff(me) ? { status: 'PENDING' } : { userId: me.id }
  const rows = await prisma.userRank.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    include: { user: { select: { displayName: true } }, rank: true },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    nick: row.user.displayName,
    rank: row.rank.code,
    label: row.rank.name,
    status: row.status,
    requestedAt: row.requestedAt,
  })))
})

app.post('/api/rank-requests', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'PLAYER') return res.status(403).json({ error: 'заявку подаёт игрок' })
  await ensureRanks()
  const code = req.body.rank
  if (!RANK_LABEL[code]) return res.status(400).json({ error: 'неизвестный ранг' })
  const definition = await prisma.rankDefinition.findUnique({ where: { code } })
  const pending = await prisma.userRank.findFirst({
    where: { userId: me.id, rankId: definition.id, status: 'PENDING' },
  })
  if (pending) return res.status(409).json({ error: 'заявка уже есть' })
  const row = await prisma.userRank.create({
    data: { userId: me.id, rankId: definition.id, status: 'PENDING' },
  })
  res.status(201).json({ id: row.id, rank: code, label: definition.name, status: row.status })
})

app.patch('/api/rank-requests/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isStaff(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const row = id ? await prisma.userRank.findUnique({ where: { id }, include: { rank: true, user: true } }) : null
  if (!row) return res.status(404).json({ error: 'не найдено' })
  const status = req.body.status
  if (status !== 'CONFIRMED' && status !== 'REJECTED') return res.status(400).json({ error: 'статус: CONFIRMED или REJECTED' })
  if (status === 'CONFIRMED') {
    await prisma.userRank.deleteMany({ where: { userId: row.userId, status: 'CONFIRMED', id: { not: row.id } } })
  }
  const updated = await prisma.userRank.update({
    where: { id: row.id },
    data: {
      status,
      confirmedBy: me.id,
      confirmedAt: new Date(),
    },
  })
  await prisma.notification.create({
    data: {
      userId: row.userId,
      notificationType: 'RANK',
      message: status === 'CONFIRMED' ? `Ранг подтверждён: ${row.rank.name}` : `Заявка на ранг отклонена: ${row.rank.name}`,
      targetPath: '/profile',
    },
  })
  res.json({ id: updated.id, status: updated.status, nick: row.user.displayName, label: row.rank.name })
})

app.get('/api/members/:id', async (req, res) => {
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user || user.role === 'ADMIN') return res.status(404).json({ error: 'не найдено' })
  const codes = await rankCodes([user.id])
  const row = (await ratingList()).find((item) => item.id === user.id)
  res.json({
    id: user.id,
    nick: user.displayName,
    role: user.role,
    rank: codes.get(user.id) || null,
    rating: row ? { points: row.points, games: row.games } : null,
  })
})

app.get('/api/users', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const users = await prisma.user.findMany({ orderBy: { displayName: 'asc' } })
  const codes = await rankCodes(users.map((user) => user.id))
  res.json(users.map((user) => userJson(user, codes.get(user.id))))
})

app.patch('/api/users/:id/role', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const role = req.body.role
  if (!['PLAYER', 'HOST', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'роль: PLAYER, HOST или ADMIN' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({ where: { id }, data: { role } })
  const codes = await rankCodes([id])
  res.json(userJson(updated, codes.get(id)))
})

app.patch('/api/users/:id/block', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const id = idParam(req.params.id)
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({
    where: { id },
    data: { status: req.body.blocked ? 'BLOCKED' : 'ACTIVE' },
  })
  const codes = await rankCodes([id])
  res.json(userJson(updated, codes.get(id)))
})

app.get('/api/settings', async (req, res) => {
  res.json(await clubSettings())
})

app.patch('/api/settings', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const current = await clubSettings()
  const name = req.body.name !== undefined ? String(req.body.name) : current.name
  const bookingOpen = req.body.bookingOpen !== undefined ? Boolean(req.body.bookingOpen) : current.bookingOpen
  const waitlistSize = req.body.waitlistSize !== undefined ? Number(req.body.waitlistSize) : current.waitlistSize
  if (!Number.isInteger(waitlistSize) || waitlistSize < 0) {
    return res.status(400).json({ error: 'лист ожидания должен быть числом' })
  }
  await prisma.appSetting.update({ where: { settingKey: 'club_name' }, data: { settingValue: name } })
  await prisma.appSetting.update({ where: { settingKey: 'booking_open' }, data: { settingValue: bookingOpen } })
  await prisma.appSetting.update({ where: { settingKey: 'waitlist_size' }, data: { settingValue: waitlistSize } })
  res.json(await clubSettings())
})

app.get('/api/me', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'не вошла' })
  const codes = await rankCodes([me.id])
  res.json(userJson(me, codes.get(me.id)))
})

app.post('/api/logout', async (req, res) => {
  if (req.sessionId) await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {})
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.post('/api/register', async (req, res) => {
  const { email, password, nick } = req.body
  if (!email || !password || !nick) return res.status(400).json({ error: 'email, password, nick обязательны' })
  if (!passwordMeetsRules(password)) {
    return res.status(400).json({
      error: 'Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол',
    })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: String(nick).trim(), role: 'PLAYER' },
    })
    res.status(201).json({ id: user.id, email: user.email, nick: user.displayName, role: user.role })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'email занят' })
    throw error
  }
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' })
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'неверный email или пароль' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'неверный email или пароль' })
  if (user.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  await openSession(res, user.id)
  const codes = await rankCodes([user.id])
  res.json(userJson(user, codes.get(user.id)))
})

app.get('/api/sanctions', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const rows = await prisma.sanction.findMany({
    orderBy: { reportedAt: 'desc' },
    include: { user: { select: { displayName: true } } },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    nick: row.user.displayName,
    kind: row.sanctionType,
    reason: row.reason,
    bonusDelta: num(row.bonusDelta),
    status: row.status,
    createdAt: row.reportedAt,
  })))
})

app.post('/api/sanctions', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const kind = req.body.kind
  if (!Object.prototype.hasOwnProperty.call(SANCTION_DELTA, kind)) {
    return res.status(400).json({ error: 'неизвестный вид' })
  }
  const reason = String(req.body.reason || '').trim()
  if (!reason) return res.status(400).json({ error: 'нужна причина' })
  const userId = idParam(req.body.userId)
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null
  if (!user) return res.status(404).json({ error: 'игрок не найден' })
  const bonusDelta = SANCTION_DELTA[kind]
  const row = await prisma.sanction.create({
    data: {
      userId: user.id,
      reportedBy: me.id,
      approvedBy: me.id,
      sanctionType: kind,
      bonusDelta,
      bookingBlocked: kind === 'NO_SHOW',
      reason,
      status: 'APPROVED',
      approvedAt: new Date(),
      warningNumber: kind === 'NO_SHOW' || kind === 'WARNING' ? 1 : null,
    },
  })
  await prisma.user.update({
    where: { id: user.id },
    data: { bonusBalance: { increment: bonusDelta } },
  })
  res.status(201).json({ id: row.id, nick: user.displayName, kind, reason, bonusDelta })
})

app.get('/api/notifications', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    type: row.notificationType,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt,
  })))
})

app.patch('/api/notifications/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const row = id ? await prisma.notification.findUnique({ where: { id } }) : null
  if (!row || row.userId !== me.id) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } })
  res.json({ id: updated.id, isRead: updated.isRead })
})

const server = http.createServer(app)
const sockets = new WebSocketServer({ server, path: '/ws' })

// Плашка на клиенте сама гаснет через несколько секунд, здесь только текст события.
function broadcastGames(notice = 'Запись на вечер изменилась') {
  const payload = JSON.stringify({ type: 'games', notice })
  for (const client of sockets.clients) {
    if (client.readyState === 1) client.send(payload)
  }
}

server.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})
