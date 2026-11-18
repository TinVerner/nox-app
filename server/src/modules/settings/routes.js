import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { meOrNull } from '../auth/session.js'
import { clubSettings } from './club.js'

const router = Router()

router.get('/settings', async (req, res) => {
  res.json(await clubSettings())
})

router.patch('/settings', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const current = await clubSettings()
  const name = req.body.name !== undefined ? String(req.body.name) : current.name
  const bookingOpen = req.body.bookingOpen !== undefined ? Boolean(req.body.bookingOpen) : current.bookingOpen
  const waitlistSize = req.body.waitlistSize !== undefined ? Number(req.body.waitlistSize) : current.waitlistSize
  if (!Number.isInteger(waitlistSize) || waitlistSize < 0) {
    return res.status(400).json({ error: 'лист ожидания должен быть числом' })
  }
  await prisma.appSetting.update({ where: { settingKey: 'club_name' }, data: { settingValue: name } })
  await prisma.appSetting.update({ where: { settingKey: 'booking_open' }, data: { settingValue: bookingOpen } })
  await prisma.appSetting.update({ where: { settingKey: 'waitlist_size' }, data: { settingValue: waitlistSize } })
  res.json(await clubSettings())
})

export default router
