import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'

const router = Router()

router.get('/notifications', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json(rows.map((row) => ({
    id: row.id,
    type: row.notificationType,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt,
  })))
})

router.patch('/notifications/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const id = idParam(req.params.id)
  const row = id ? await prisma.notification.findUnique({ where: { id } }) : null
  if (!row || row.userId !== me.id) return res.status(404).json({ error: 'не найдено' })
  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } })
  res.json({ id: updated.id, isRead: updated.isRead })
})

export default router
