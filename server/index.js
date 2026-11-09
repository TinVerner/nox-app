import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'NOX API hello' })
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

  res.json({ id: user.id, email: user.email, nick: user.nick, role: user.role })
})

app.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})