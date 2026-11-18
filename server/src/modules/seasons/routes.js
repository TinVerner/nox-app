import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { isStaff, meOrNull } from '../auth/session.js'
import { ensureAutumn } from './ensure-autumn.js'

const router = Router()

router.get('/seasons', async (req, res) => {
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

router.patch('/seasons/:id', async (req, res) => {
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

export default router
