import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'
import { SANCTION_DELTA } from './policy.js'

const router = Router()

router.get('/sanctions', async (req, res) => {
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

router.post('/sanctions', async (req, res) => {
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

export default router
