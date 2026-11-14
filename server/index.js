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

app.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})