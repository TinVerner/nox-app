import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { ensureAutumn } from './ensure-autumn.js'
import { ratingList } from '../rating/list.js'

const router = Router()

router.get('/seasons', async (req, res) => {
  const seasons = await ensureAutumn(prisma)
  res.json(seasons.map(seasonJson))
})

router.get('/seasons/:id/rating', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const season = id ? await prisma.season.findUnique({ where: { id } }) : null
  if (!season) return res.status(404).json({ error: 'не найдено' })
  const rows = await ratingList(season.id)
  res.json(rows.filter((row) => Number(row.points) !== 0 || row.games > 0))
})

function seasonJson(season) {
  return {
    id: season.id,
    name: season.name,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    status: season.status,
    closed: season.status === 'CLOSED',
  }
}

router.post('/seasons', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const name = String(req.body.name || '').trim()
  const startsOn = req.body.startsOn
  const endsOn = req.body.endsOn
  if (!name || !startsOn || !endsOn) {
    return res.status(400).json({ error: 'нужны название и даты' })
  }
  const start = new Date(startsOn)
  const end = new Date(endsOn)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ error: 'даты неверны' })
  }
  if (end.getTime() < start.getTime()) {
    return res.status(400).json({ error: 'дата окончания раньше начала' })
  }
  const existing = await prisma.season.findUnique({ where: { name } })
  if (existing) return res.status(409).json({ error: 'сезон с таким названием уже есть' })
  // Новый сезон создаётся открытым; текущие открытые сезоны не закрываются.
  const created = await prisma.season.create({
    data: {
      name,
      startsOn: start,
      endsOn: end,
      status: 'OPEN',
    },
  })
  res.status(201).json(seasonJson(created))
})

router.patch('/seasons/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  if (req.body.closed !== true) return res.status(400).json({ error: 'closed: true' })
  const id = idParam(req.params.id)
  const season = id ? await prisma.season.findUnique({ where: { id } }) : null
  if (!season) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.season.update({ where: { id }, data: { status: 'CLOSED' } })
  res.json(seasonJson(updated))
})

export default router
