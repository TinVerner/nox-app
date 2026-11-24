import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { alignClassicRules } from './rules.js'

const router = Router()

router.get('/point-rules', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  await alignClassicRules()
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

router.post('/point-rules', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
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

router.patch('/point-rules/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const rule = id ? await prisma.pointRule.findUnique({ where: { id } }) : null
  if (!rule) return res.status(404).json({ error: 'не найдено' })
  const data = {}
  if (req.body.format !== undefined) {
    const format = String(req.body.format || '').trim()
    if (!format) return res.status(400).json({ error: 'нужен формат' })
    data.format = format
  }
  if (req.body.playerRole !== undefined) {
    const playerRole = String(req.body.playerRole || '').trim()
    if (!playerRole) return res.status(400).json({ error: 'нужна роль' })
    data.playerRole = playerRole
  }
  if (req.body.gameResult !== undefined) {
    const gameResult = String(req.body.gameResult || '').trim()
    if (!gameResult) return res.status(400).json({ error: 'нужен исход' })
    data.gameResult = gameResult
  }
  if (req.body.points !== undefined) data.points = num(req.body.points)
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive)
  try {
    const updated = await prisma.pointRule.update({ where: { id }, data })
    res.json({
      id: updated.id,
      format: updated.format,
      playerRole: updated.playerRole,
      gameResult: updated.gameResult,
      points: num(updated.points),
      isActive: updated.isActive,
    })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'такое правило уже есть' })
    throw error
  }
})

router.delete('/point-rules/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const rule = id ? await prisma.pointRule.findUnique({ where: { id } }) : null
  if (!rule) return res.status(404).json({ error: 'не найдено' })
  await prisma.pointRule.delete({ where: { id } })
  res.json({ ok: true })
})

export default router
