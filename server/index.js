import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import session from 'express-session'
import { WebSocketServer } from 'ws'
import { ensureAutumn } from './season.js'

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('Не задан SESSION_SECRET')
}

const GAME_STATUS = ['DRAFT', 'PUBLISHED', 'DONE']
const GAME_KIND = ['CLASSIC', 'TOURNAMENT', 'NOVICE']
const RANKS = ['MASTER', 'MASTER_PRO', 'LEGEND']
const SANCTION_DELTA = { LATE_10: -5, LATE_MORE: -10, NO_SHOW: -15, WARNING: 0 }

const CATALOG = [
  { name: 'Абонемент на 5 посещений', detail: 'Открытые игры', price: 160 },
  { name: 'Абонемент безлимит на 1 месяц', detail: 'Открытые игры', price: 300 },
  { name: 'Абонемент безлимит на 6 месяцев', detail: 'Открытые игры', price: 1500 },
  { name: 'Абонемент безлимит на 12 месяцев', detail: 'Открытые игры', price: 3000 },
  { name: 'Подарочный сертификат на 1 персону', detail: 'Открытая игра, действителен в течение 1 месяца', price: 35 },
  { name: 'Подарочный сертификат на 2 персоны', detail: 'Открытая игра, действителен в течение 1 месяца', price: 70 },
  { name: 'Сертификат на закрытую игру', detail: 'Любая из 6 программ', price: 400 },
  { name: 'Именная игровая маска', detail: 'Под заказ', price: 80 },
]

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

async function takenCounts(gameIds) {
  const ids = [...new Set(gameIds.filter(Boolean))]
  const map = new Map(ids.map((id) => [id, 0]))
  if (!ids.length) return map
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', gameId: { in: ids } },
    include: { guests: true },
  })
  const users = bookings.length
    ? await prisma.user.findMany({
      where: { id: { in: [...new Set(bookings.map((booking) => booking.userId))] } },
      select: { id: true, nick: true },
    })
    : []
  const nickById = new Map(users.map((user) => [user.id, user.nick]))
  const people = new Map()
  for (const booking of bookings) {
    if (!people.has(booking.gameId)) people.set(booking.gameId, new Set())
    const set = people.get(booking.gameId)
    const nick = personKey(nickById.get(booking.userId))
    set.add(nick || `user:${booking.userId}`)
    for (const guest of booking.guests) {
      const key = personKey(guest.displayName)
      if (key) set.add(key)
    }
  }
  for (const [gameId, set] of people) map.set(gameId, set.size)
  return map
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

function readPrice(value) {
  if (typeof value === 'boolean' || value === null) return { error: 'цена должна быть числом' }
  const price = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(price) || !Number.isInteger(price)) {
    return { error: 'цена должна быть числом' }
  }
  if (price < 0) return { error: 'цена не может быть отрицательной' }
  return { price }
}

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
}))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'NOX API hello' })
})

app.get('/api/news', async (req, res) => {
  const items = await prisma.news.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { reactions: true } } },
  })
  const mine = req.session.userId
    ? new Set((await prisma.reaction.findMany({
      where: { userId: req.session.userId },
      select: { newsId: true },
    })).map((row) => row.newsId))
    : new Set()
  res.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt,
    likes: item._count.reactions,
    liked: mine.has(item.id),
  })))
})

app.post('/api/news', async (req, res) => {
  const { title, body } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title и body обязательны' })
  const item = await prisma.news.create({ data: { title, body } })
  res.status(201).json(item)
})

app.get('/api/news/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { newsId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { nick: true } } },
  })
  res.json(comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    nick: comment.user.nick,
  })))
})

app.post('/api/news/:id/comments', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const text = String(req.body.body || '').trim()
  if (!text) return res.status(400).json({ error: 'комментарий пустой' })
  const news = await prisma.news.findUnique({ where: { id: req.params.id } })
  if (!news) return res.status(404).json({ error: 'новость не найдена' })
  const comment = await prisma.comment.create({
    data: { newsId: news.id, userId: req.session.userId, body: text },
    include: { user: { select: { nick: true } } },
  })
  res.status(201).json({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    nick: comment.user.nick,
  })
})

app.post('/api/news/:id/reactions', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const news = await prisma.news.findUnique({ where: { id: req.params.id } })
  if (!news) return res.status(404).json({ error: 'новость не найдена' })
  const where = { newsId_userId: { newsId: news.id, userId: req.session.userId } }
  const existing = await prisma.reaction.findUnique({ where })
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } })
  else await prisma.reaction.create({ data: { newsId: news.id, userId: req.session.userId } })
  const likes = await prisma.reaction.count({ where: { newsId: news.id } })
  res.json({ likes, liked: !existing })
})

app.get('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  const staff = me && (me.role === 'HOST' || me.role === 'ADMIN')
  const items = await prisma.game.findMany({
    orderBy: { startsAt: 'asc' },
    include: { season: true },
  })
  const visible = staff
    ? items
    : items.filter((game) => game.status === 'PUBLISHED' && (!game.season || game.season.closed === false))
  const takenByGame = await takenCounts(visible.map((game) => game.id))
  res.json(visible.map(({ season, ...game }) => ({
    ...game,
    taken: takenByGame.get(game.id) || 0,
  })))
})

app.post('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const { title, startsAt, place, seats, status, kind, price } = req.body
  if (!title || !startsAt || !place || !seats) {
    return res.status(400).json({ error: 'title, startsAt, place, seats обязательны' })
  }
  if (status && !GAME_STATUS.includes(status)) {
    return res.status(400).json({ error: 'статус: DRAFT, PUBLISHED или DONE' })
  }
  if (kind && !GAME_KIND.includes(kind)) {
    return res.status(400).json({ error: 'вид: CLASSIC, TOURNAMENT или NOVICE' })
  }
  let priceValue = 0
  if (price !== undefined) {
    const parsed = readPrice(price)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    priceValue = parsed.price
  }
  const item = await prisma.game.create({
    data: {
      title,
      startsAt: new Date(startsAt),
      place,
      seats: Number(seats),
      status: status || 'PUBLISHED',
      kind: kind || 'CLASSIC',
      price: priceValue,
    },
  })
  res.status(201).json(item)
})

app.patch('/api/games/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const game = await prisma.game.findUnique({ where: { id: req.params.id } })
  if (!game) return res.status(404).json({ error: 'игра не найдена' })
  const { title, startsAt, place, seats, status, kind, price } = req.body
  if (status !== undefined && !GAME_STATUS.includes(status)) {
    return res.status(400).json({ error: 'статус: DRAFT, PUBLISHED или DONE' })
  }
  if (kind !== undefined && !GAME_KIND.includes(kind)) {
    return res.status(400).json({ error: 'вид: CLASSIC, TOURNAMENT или NOVICE' })
  }
  let priceValue
  if (price !== undefined) {
    const parsed = readPrice(price)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    priceValue = parsed.price
  }
  const data = {}
  if (title !== undefined) data.title = title
  if (startsAt !== undefined) data.startsAt = new Date(startsAt)
  if (place !== undefined) data.place = place
  if (seats !== undefined) data.seats = Number(seats)
  if (status !== undefined) data.status = status
  if (kind !== undefined) data.kind = kind
  if (priceValue !== undefined) data.price = priceValue
  const item = await prisma.game.update({ where: { id: game.id }, data })
  res.json(item)
})

app.post('/api/games/:id/book', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'запись только для игроков' })
  const game = await prisma.game.findUnique({ where: { id: req.params.id } })
  if (!game) return res.status(404).json({ error: 'игра не найдена' })
  const settings = await clubSettings()
  if (!settings.bookingOpen) return res.status(403).json({ error: 'запись закрыта' })
  const already = await prisma.booking.findFirst({
    where: { userId: me.id, gameId: game.id },
  })
  if (already) return res.status(409).json({ error: 'уже записана' })
  const takenNow = (await takenCounts([game.id])).get(game.id) || 0
  const waiting = await prisma.booking.count({ where: { gameId: game.id, status: 'WAITING' } })
  let status = 'CONFIRMED'
  if (takenNow >= game.seats) {
    if (waiting >= settings.waitlistSize) {
      return res.status(409).json({ error: 'лист ожидания полон' })
    }
    status = 'WAITING'
  }
  try {
    const names = guestNames(req.body?.guests)
    const booking = await prisma.booking.create({
      data: {
        userId: me.id,
        gameId: game.id,
        status,
        guests: { create: names.map((displayName) => ({ displayName })) },
      },
      include: { guests: true },
    })
    res.status(201).json(booking)
    broadcastGames('Запись на вечер изменилась')
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'уже записана' })
    throw err
  }
})

app.get('/api/bookings', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const bookings = await prisma.booking.findMany({
    where: { userId: req.session.userId },
    orderBy: { createdAt: 'desc' },
    include: { guests: { orderBy: { createdAt: 'asc' } } },
  })
  const gameIds = bookings.map((booking) => booking.gameId)
  const games = gameIds.length
    ? await prisma.game.findMany({ where: { id: { in: gameIds } } })
    : []
  const takenByGame = await takenCounts(gameIds)
  const me = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { nick: true },
  })
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const resultRows = gameIds.length
    ? await prisma.result.findMany({
      where: { gameId: { in: gameIds }, nick: me.nick },
      select: { gameId: true, points: true },
    })
    : []
  const byId = new Map(games.map((game) => [game.id, game]))
  const pointsByGame = new Map()
  for (const row of resultRows) {
    pointsByGame.set(row.gameId, (pointsByGame.get(row.gameId) || 0) + row.points)
  }
  res.json(bookings.map((booking) => {
    const game = byId.get(booking.gameId)
    return {
      id: booking.id,
      gameId: booking.gameId,
      status: booking.status,
      gameStatus: game?.status ?? null,
      title: game?.title ?? null,
      startsAt: game?.startsAt ?? null,
      place: game?.place ?? null,
      seats: game?.seats ?? null,
      taken: takenByGame.get(booking.gameId) || 0,
      points: pointsByGame.has(booking.gameId) ? pointsByGame.get(booking.gameId) : null,
      guests: booking.guests.map((guest) => ({ id: guest.id, name: guest.displayName })),
    }
  }))
})

app.delete('/api/bookings/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== req.session.userId) return res.status(403).json({ error: 'нельзя' })
  await prisma.booking.delete({ where: { id: booking.id } })
  res.json({ ok: true })
  broadcastGames('Запись на вечер отменена')
})

app.post('/api/bookings/:id/guests', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== req.session.userId) return res.status(403).json({ error: 'нельзя' })
  const [name] = guestNames(req.body?.name)
  if (!name) return res.status(400).json({ error: 'нужно имя гостя' })
  const existing = await prisma.bookingGuest.findMany({ where: { bookingId: booking.id } })
  if (existing.some((guest) => personKey(guest.displayName) === personKey(name))) {
    return res.status(409).json({ error: 'этот гость уже указан' })
  }
  const guest = await prisma.bookingGuest.create({
    data: { bookingId: booking.id, displayName: name },
  })
  const taken = (await takenCounts([booking.gameId])).get(booking.gameId) || 0
  res.status(201).json({ id: guest.id, name: guest.displayName, taken })
  if (booking.status === 'CONFIRMED') broadcastGames('Запись на вечер изменилась')
})

app.delete('/api/bookings/:id/guests/:guestId', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } })
  if (!booking) return res.status(404).json({ error: 'не найдено' })
  if (booking.userId !== req.session.userId) return res.status(403).json({ error: 'нельзя' })
  const guest = await prisma.bookingGuest.findUnique({ where: { id: req.params.guestId } })
  if (!guest || guest.bookingId !== booking.id) return res.status(404).json({ error: 'гость не найден' })
  await prisma.bookingGuest.delete({ where: { id: guest.id } })
  const taken = (await takenCounts([booking.gameId])).get(booking.gameId) || 0
  res.json({ ok: true, taken })
  if (booking.status === 'CONFIRMED') broadcastGames('Запись на вечер изменилась')
})

async function ratingList() {
  const grouped = await prisma.result.groupBy({
    by: ['nick'],
    _sum: { points: true },
    _count: { nick: true },
    orderBy: { _sum: { points: 'desc' } },
  })
  if (grouped.length === 0) {
    return prisma.playerStat.findMany({ orderBy: { points: 'desc' } })
  }
  return grouped.map((row) => ({
    id: row.nick,
    nick: row.nick,
    points: row._sum.points ?? 0,
    games: row._count.nick,
  }))
}

app.get('/api/rating', async (req, res) => {
  res.json(await ratingList())
})

app.get('/api/results', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const gameId = req.query.gameId
  if (!gameId) return res.status(400).json({ error: 'gameId обязателен' })
  const items = await prisma.result.findMany({
    where: { gameId: String(gameId) },
    orderBy: { createdAt: 'desc' },
  })
  res.json(items)
})

app.post('/api/results', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const { gameId, nick, points } = req.body
  if (!gameId || !nick || points === undefined || points === '') {
    return res.status(400).json({ error: 'gameId, nick, points обязательны' })
  }
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return res.status(404).json({ error: 'игра не найдена' })
  const item = await prisma.result.create({
    data: { gameId, nick, points: Number(points) },
  })
  res.status(201).json(item)
})

app.get('/api/seasons', async (req, res) => {
  const seasons = await ensureAutumn(prisma)
  res.json(seasons)
})

app.patch('/api/seasons/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  if (req.body.closed !== true) return res.status(400).json({ error: 'closed: true' })
  const season = await prisma.season.findUnique({ where: { id: req.params.id } })
  if (!season) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.season.update({
    where: { id: season.id },
    data: { closed: true },
  })
  res.json(updated)
})

app.post('/api/rating', async (req, res) => {
  const { nick, points, games } = req.body
  const item = await prisma.playerStat.create({
    data: { nick, points: Number(points), games: Number(games) },
  })
  res.status(201).json(item)
})

app.get('/api/members', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'нельзя' })
  }
  const members = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    orderBy: { nick: 'asc' },
    select: { id: true, nick: true, role: true, rank: true },
  })
  res.json(members)
})

app.patch('/api/members/:id/rank', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const rank = req.body.rank || null
  if (rank && !RANKS.includes(rank)) return res.status(400).json({ error: 'неизвестный ранг' })
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { rank },
    select: { id: true, nick: true, role: true, rank: true },
  })
  res.json(updated)
})

app.get('/api/members/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, nick: true, role: true, rank: true },
  })
  if (!user || user.role === 'ADMIN') return res.status(404).json({ error: 'не найдено' })
  const rows = await ratingList()
  const row = rows.find((item) => item.nick === user.nick)
  res.json({
    id: user.id,
    nick: user.nick,
    role: user.role,
    rank: user.rank,
    rating: row ? { points: row.points, games: row.games } : null,
  })
})

app.get('/api/users', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const where = {}
  const role = req.query.role
  if (role) {
    if (!['PLAYER', 'HOST', 'ADMIN'].includes(String(role))) {
      return res.status(400).json({ error: 'роль: PLAYER, HOST или ADMIN' })
    }
    where.role = String(role)
  }
  const q = String(req.query.q || '').trim()
  if (q) {
    where.OR = [
      { nick: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  const users = await prisma.user.findMany({
    where,
    orderBy: { nick: 'asc' },
    select: { id: true, email: true, nick: true, role: true, blocked: true, rank: true },
  })
  res.json(users)
})

app.patch('/api/users/:id/role', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const { role } = req.body
  if (!['PLAYER', 'HOST', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'роль: PLAYER, HOST или ADMIN' })
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, nick: true, role: true, blocked: true },
  })
  res.json(user)
})

app.patch('/api/users/:id/block', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  if (typeof req.body.blocked !== 'boolean') {
    return res.status(400).json({ error: 'blocked: true или false' })
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { blocked: req.body.blocked },
    select: { id: true, email: true, nick: true, role: true, blocked: true },
  })
  res.json(user)
})

async function clubSettings() {
  const existing = await prisma.clubSettings.findFirst()
  if (existing) return existing
  return prisma.clubSettings.create({ data: {} })
}

app.get('/api/settings', async (req, res) => {
  const settings = await clubSettings()
  res.json({
    name: settings.name,
    bookingOpen: settings.bookingOpen,
    waitlistSize: settings.waitlistSize,
  })
})

app.patch('/api/settings', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const { name, bookingOpen, waitlistSize } = req.body
  const data = {}
  if (name !== undefined) data.name = name
  if (typeof bookingOpen === 'boolean') data.bookingOpen = bookingOpen
  if (waitlistSize !== undefined) {
    const size = Number(waitlistSize)
    if (!Number.isInteger(size) || size < 0) {
      return res.status(400).json({ error: 'waitlistSize: целое число' })
    }
    data.waitlistSize = size
  }
  const current = await clubSettings()
  const settings = await prisma.clubSettings.update({ where: { id: current.id }, data })
  res.json({
    name: settings.name,
    bookingOpen: settings.bookingOpen,
    waitlistSize: settings.waitlistSize,
  })
})

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'не вошла' })
  }
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } })
  res.json({
    id: user.id,
    email: user.email,
    nick: user.nick,
    role: user.role,
    rank: user.rank,
    bonus: user.bonus,
  })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.json({ ok: true })
  })
})

app.post('/api/register', async (req, res) => {
  const { email, password, nick } = req.body
  if (!email || !password || !nick) {
    return res.status(400).json({ error: 'email, password, nick обязательны' })
  }
  if (!passwordMeetsRules(password)) {
    return res.status(400).json({
      error: 'Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол',
    })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  try {
    const user = await prisma.user.create({
      data: { email, password: passwordHash, nick },
    })
    res.status(201).json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'email занят' })
    throw err
  }
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email и password обязательны' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'неверный email или пароль' })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    return res.status(401).json({ error: 'неверный email или пароль' })
  }
  if (user.blocked) {
    return res.status(403).json({ error: 'аккаунт заблокирован' })
  }
  req.session.userId = user.id

  res.json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
})

async function meOrNull(req) {
  if (!req.session.userId) return null
  return prisma.user.findUnique({ where: { id: req.session.userId } })
}

app.get('/api/sanctions', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const rows = await prisma.sanction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { nick: true } } },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    nick: row.user.nick,
    kind: row.kind,
    reason: row.reason,
    bonusDelta: row.bonusDelta,
    createdAt: row.createdAt,
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
  const user = await prisma.user.findUnique({ where: { id: req.body.userId } })
  if (!user) return res.status(404).json({ error: 'игрок не найден' })
  const bonusDelta = SANCTION_DELTA[kind]
  const row = await prisma.sanction.create({
    data: { userId: user.id, kind, reason, bonusDelta },
  })
  await prisma.user.update({
    where: { id: user.id },
    data: { bonus: user.bonus + bonusDelta },
  })
  res.status(201).json({ id: row.id, nick: user.nick, kind, reason, bonusDelta })
})

async function ensureCatalog() {
  const count = await prisma.catalogItem.count()
  if (count > 0) return
  await prisma.catalogItem.createMany({ data: CATALOG })
}

app.get('/api/catalog', async (req, res) => {
  await ensureCatalog()
  const items = await prisma.catalogItem.findMany({ orderBy: { price: 'asc' } })
  res.json(items)
})

app.post('/api/news', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const { title, body } = req.body
  const item = await prisma.news.create({ data: { title, body } })
  res.status(201).json(item)
})

const server = http.createServer(app)
const sockets = new WebSocketServer({ server, path: '/ws' })

function broadcastGames(notice = 'Запись на вечер изменилась') {
  const payload = JSON.stringify({ type: 'games', notice })
  for (const client of sockets.clients) {
    if (client.readyState === 1) client.send(payload)
  }
}

server.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})