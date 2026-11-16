import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import session from 'express-session'
import { ensureAutumn } from './season.js'

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('Не задан SESSION_SECRET')
}

const GAME_STATUS = ['DRAFT', 'PUBLISHED', 'DONE']

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
  const items = await prisma.news.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(items)
})

app.post('/api/news', async (req, res) => {
  const { title, body } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title и body обязательны' })
  const item = await prisma.news.create({ data: { title, body } })
  res.status(201).json(item)
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
  res.json(visible.map(({ season, ...game }) => game))
})

app.post('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const { title, startsAt, place, seats, status } = req.body
  if (!title || !startsAt || !place || !seats) {
    return res.status(400).json({ error: 'title, startsAt, place, seats обязательны' })
  }
  if (status && !GAME_STATUS.includes(status)) {
    return res.status(400).json({ error: 'статус: DRAFT, PUBLISHED или DONE' })
  }
  const item = await prisma.game.create({
    data: {
      title,
      startsAt: new Date(startsAt),
      place,
      seats: Number(seats),
      status: status || 'PUBLISHED',
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
  const { title, startsAt, place, seats, status } = req.body
  if (status !== undefined && !GAME_STATUS.includes(status)) {
    return res.status(400).json({ error: 'статус: DRAFT, PUBLISHED или DONE' })
  }
  const data = {}
  if (title !== undefined) data.title = title
  if (startsAt !== undefined) data.startsAt = new Date(startsAt)
  if (place !== undefined) data.place = place
  if (seats !== undefined) data.seats = Number(seats)
  if (status !== undefined) data.status = status
  const item = await prisma.game.update({ where: { id: game.id }, data })
  res.json(item)
})

app.post('/api/games/:id/book', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const game = await prisma.game.findUnique({ where: { id: req.params.id } })
  if (!game) return res.status(404).json({ error: 'игра не найдена' })
  const settings = await clubSettings()
  if (!settings.bookingOpen) return res.status(403).json({ error: 'запись закрыта' })
  const already = await prisma.booking.findFirst({
    where: { userId: req.session.userId, gameId: game.id },
  })
  if (already) return res.status(409).json({ error: 'уже записана' })
  const confirmed = await prisma.booking.count({ where: { gameId: game.id, status: 'CONFIRMED' } })
  const waiting = await prisma.booking.count({ where: { gameId: game.id, status: 'WAITING' } })
  let status = 'CONFIRMED'
  if (confirmed >= game.seats) {
    if (waiting >= settings.waitlistSize) {
      return res.status(409).json({ error: 'лист ожидания полон' })
    }
    status = 'WAITING'
  }
  try {
    const booking = await prisma.booking.create({
      data: { userId: req.session.userId, gameId: game.id, status },
    })
    res.status(201).json(booking)
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
  })
  const games = await prisma.game.findMany({
    where: { id: { in: bookings.map((booking) => booking.gameId) } },
  })
  const byId = new Map(games.map((game) => [game.id, game]))
  res.json(bookings.map((booking) => {
    const game = byId.get(booking.gameId)
    return {
      id: booking.id,
      status: booking.status,
      title: game?.title ?? null,
      startsAt: game?.startsAt ?? null,
      place: game?.place ?? null,
      seats: game?.seats ?? null,
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
})

app.get('/api/rating', async (req, res) => {
  const grouped = await prisma.result.groupBy({
    by: ['nick'],
    _sum: { points: true },
    _count: { nick: true },
    orderBy: { _sum: { points: 'desc' } },
  })
  if (grouped.length === 0) {
    const items = await prisma.playerStat.findMany({ orderBy: { points: 'desc' } })
    return res.json(items)
  }
  res.json(grouped.map((row) => ({
    id: row.nick,
    nick: row.nick,
    points: row._sum.points ?? 0,
    games: row._count.nick,
  })))
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
  const members = await prisma.user.findMany({
    orderBy: { nick: 'asc' },
    select: { id: true, nick: true, role: true },
  })
  res.json(members)
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
    select: { id: true, email: true, nick: true, role: true, blocked: true },
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
  res.json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
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

app.post('/api/news', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const { title, body } = req.body
  const item = await prisma.news.create({ data: { title, body } })
  res.status(201).json(item)
})

app.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})