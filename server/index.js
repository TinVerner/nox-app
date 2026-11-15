import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import session from 'express-session'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use(session({
  secret: 'nox-dev-secret',
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
  const items = await prisma.game.findMany({ orderBy: { startsAt: 'asc' } })
  res.json(items)
})

app.post('/api/games', async (req, res) => {
  const { title, startsAt, place, seats } = req.body
  if (!title || !startsAt || !place || !seats) {
    return res.status(400).json({ error: 'title, startsAt, place, seats обязательны' })
  }
  const item = await prisma.game.create({
    data: { title, startsAt: new Date(startsAt), place, seats: Number(seats) },
  })
  res.status(201).json(item)
})

app.post('/api/games/:id/book', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  try {
    const booking = await prisma.booking.create({
      data: { userId: req.session.userId, gameId: req.params.id },
    })
    res.status(201).json(booking)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'уже записана' })
    throw err
  }
})

app.get('/api/rating', async (req, res) => {
  const items = await prisma.playerStat.findMany({ orderBy: { points: 'desc' } })
  res.json(items)
})

app.post('/api/rating', async (req, res) => {
  const { nick, points, games } = req.body
  const item = await prisma.playerStat.create({
    data: { nick, points: Number(points), games: Number(games) },
  })
  res.status(201).json(item)
})

app.get('/api/users', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'сначала войди' })
  const me = await prisma.user.findUnique({ where: { id: req.session.userId } })
  if (me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const users = await prisma.user.findMany({
    select: { id: true, email: true, nick: true, role: true },
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
    select: { id: true, email: true, nick: true, role: true },
  })
  res.json(user)
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
  const user = await prisma.user.create({
    data: { email, password: passwordHash, nick },
  })
  res.status(201).json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
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
  req.session.userId = user.id

  res.json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
})

async function meOrNull(req) {
  if (!req.session.userId) return null
  return prisma.user.findUnique({ where: { id: req.session.userId } })
}

app.post('/api/games', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || (me.role !== 'HOST' && me.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'только ведущий' })
  }
  const { title, startsAt, place, seats } = req.body
  const item = await prisma.game.create({
    data: { title, startsAt: new Date(startsAt), place, seats: Number(seats) },
  })
  res.status(201).json(item)
})

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