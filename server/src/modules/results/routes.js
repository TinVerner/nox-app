import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { isStaff, meOrNull } from '../auth/session.js'
import { ensurePointRules, findActivePointRule } from '../point-rules/rules.js'
import { scoreOf } from './score.js'

const router = Router()

router.get('/games/:id/parties', async (req, res) => {
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

router.post('/games/:id/parties', async (req, res) => {
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

router.post('/parties/:id/players', async (req, res) => {
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
  const rule = await findActivePointRule(party.night.format, playerRole, gameResult)
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

export default router
