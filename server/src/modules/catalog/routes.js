import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam, num } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'

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

router.get('/catalog', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const where = me.role === 'ADMIN' ? {} : { isActive: true }
  const items = await prisma.catalogItem.findMany({ where, orderBy: { name: 'asc' } })
  res.json(items.map(itemJson))
})

router.post('/catalog', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
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
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
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

router.post('/catalog/:id/buy', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  if (me.role !== 'PLAYER') return res.status(403).json({ error: 'покупка только для игроков' })
  if (me.status === 'BLOCKED') return res.status(403).json({ error: 'аккаунт заблокирован' })
  const id = idParam(req.params.id)
  const item = id ? await prisma.catalogItem.findUnique({ where: { id } }) : null
  if (!item || !item.isActive) return res.status(404).json({ error: 'услуга не найдена' })
  if (item.bonusPrice == null) return res.status(400).json({ error: 'нет цены в бонусах' })
  const price = num(item.bonusPrice)
  const outcome = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: me.id } })
    if (num(user.bonusBalance) < price) return { error: 'не хватает бонусов', status: 409 }
    const updated = await tx.user.update({
      where: { id: me.id },
      data: { bonusBalance: { decrement: price } },
    })
    return { bonus: num(updated.bonusBalance) }
  })
  if (outcome.error) return res.status(outcome.status).json({ error: outcome.error })
  res.json({ item: itemJson(item), bonus: outcome.bonus })
})

export default router
