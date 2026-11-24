import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { isHost, meOrNull } from '../auth/session.js'
import { CATALOG_DEFAULTS } from './defaults.js'

const router = Router()

function priceOrNull(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

function itemJson(item) {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    cashPrice: item.cashPrice == null ? null : num(item.cashPrice),
    bonusPrice: item.bonusPrice == null ? null : num(item.bonusPrice),
    active: item.isActive,
  }
}

async function ensureCatalogDefaults() {
  for (const item of CATALOG_DEFAULTS) {
    const existing = await prisma.catalogItem.findFirst({ where: { name: item.name } })
    if (existing) continue
    await prisma.catalogItem.create({
      data: {
        name: item.name,
        description: item.description,
        cashPrice: item.cashPrice,
        bonusPrice: null,
        isActive: true,
      },
    })
  }
}

router.get('/catalog', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  await ensureCatalogDefaults()
  const where = isHost(me) ? {} : { isActive: true }
  const items = await prisma.catalogItem.findMany({ where, orderBy: [{ cashPrice: 'asc' }, { name: 'asc' }] })
  res.json(items.map(itemJson))
})

router.post('/catalog', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: 'нужно название' })
  const cashPrice = priceOrNull(req.body.cashPrice)
  const bonusPrice = priceOrNull(req.body.bonusPrice)
  if (cashPrice === undefined || bonusPrice === undefined) {
    return res.status(400).json({ error: 'цена должна быть числом' })
  }
  const item = await prisma.catalogItem.create({
    data: {
      name,
      description: String(req.body.description || '').trim() || null,
      cashPrice,
      bonusPrice,
      isActive: req.body.active !== false,
    },
  })
  res.status(201).json(itemJson(item))
})

router.patch('/catalog/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const item = id ? await prisma.catalogItem.findUnique({ where: { id } }) : null
  if (!item) return res.status(404).json({ error: 'не найдено' })
  const data = {}
  if (req.body.name !== undefined) {
    const name = String(req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'нужно название' })
    data.name = name
  }
  if (req.body.description !== undefined) {
    data.description = String(req.body.description || '').trim() || null
  }
  if (req.body.cashPrice !== undefined) {
    const cashPrice = priceOrNull(req.body.cashPrice)
    if (cashPrice === undefined) return res.status(400).json({ error: 'цена должна быть числом' })
    data.cashPrice = cashPrice
  }
  if (req.body.bonusPrice !== undefined) {
    const bonusPrice = priceOrNull(req.body.bonusPrice)
    if (bonusPrice === undefined) return res.status(400).json({ error: 'цена должна быть числом' })
    data.bonusPrice = bonusPrice
  }
  if (req.body.active !== undefined) data.isActive = Boolean(req.body.active)
  const updated = await prisma.catalogItem.update({ where: { id }, data })
  res.json(itemJson(updated))
})

router.delete('/catalog/:id', async (req, res) => {
  const me = await meOrNull(req)
  if (!isHost(me)) return res.status(403).json({ error: 'только ведущий' })
  const id = idParam(req.params.id)
  const item = id ? await prisma.catalogItem.findUnique({ where: { id } }) : null
  if (!item) return res.status(404).json({ error: 'не найдено' })
  await prisma.catalogItem.delete({ where: { id } })
  res.json({ ok: true })
})

router.post('/catalog/:id/buy', async (_req, res) => {
  res.status(400).json({ error: 'заказ через сайт недоступен — свяжитесь с ведущим' })
})

export default router
