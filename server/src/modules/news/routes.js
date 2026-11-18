import { Router } from 'express'
import { prisma } from '../../shared/prisma.js'
import { idParam } from '../../shared/input.js'
import { meOrNull } from '../auth/session.js'

const router = Router()

router.get('/news', async (req, res) => {
  const items = await prisma.newsPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { reactions: true } } },
  })
  const mine = req.userId
    ? new Set((await prisma.reaction.findMany({
      where: { userId: req.userId },
      select: { postId: true },
    })).map((row) => row.postId))
    : new Set()
  res.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.content,
    createdAt: item.createdAt,
    likes: item._count.reactions,
    liked: mine.has(item.id),
  })))
})

router.post('/news', async (req, res) => {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'только админ' })
  const title = String(req.body.title || '').trim()
  const body = String(req.body.body || '').trim()
  if (!title || !body) return res.status(400).json({ error: 'title и body обязательны' })
  const item = await prisma.newsPost.create({
    data: { authorId: me.id, title, content: body, status: 'PUBLISHED' },
  })
  res.status(201).json({ id: item.id, title: item.title, body: item.content, createdAt: item.createdAt })
})

router.get('/news/:id/comments', async (req, res) => {
  const postId = idParam(req.params.id)
  if (!postId) return res.status(404).json({ error: 'новость не найдена' })
  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true } } },
  })
  res.json(comments.map((comment) => ({
    id: comment.id,
    userId: comment.userId,
    body: comment.content,
    createdAt: comment.createdAt,
    nick: comment.user.displayName,
  })))
})

router.post('/news/:id/comments', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const content = String(req.body.body || '').trim()
  if (!postId || !content) return res.status(400).json({ error: 'нужен текст' })
  const post = await prisma.newsPost.findUnique({ where: { id: postId } })
  if (!post) return res.status(404).json({ error: 'новость не найдена' })
  const comment = await prisma.comment.create({
    data: { postId, userId: me.id, content },
  })
  res.status(201).json({ id: comment.id, userId: me.id, body: comment.content, createdAt: comment.createdAt, nick: me.displayName })
})

router.delete('/news/:id/comments/:commentId', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const commentId = idParam(req.params.commentId)
  const comment = postId && commentId
    ? await prisma.comment.findFirst({ where: { id: commentId, postId } })
    : null
  if (!comment) return res.status(404).json({ error: 'не найдено' })
  if (comment.userId !== me.id) return res.status(403).json({ error: 'нельзя' })
  await prisma.comment.delete({ where: { id: comment.id } })
  res.json({ ok: true })
})

router.post('/news/:id/reactions', async (req, res) => {
  const me = await meOrNull(req)
  if (!me) return res.status(401).json({ error: 'сначала войди' })
  const postId = idParam(req.params.id)
  const post = postId ? await prisma.newsPost.findUnique({ where: { id: postId } }) : null
  if (!post) return res.status(404).json({ error: 'новость не найдена' })
  const where = { postId_userId: { postId, userId: me.id } }
  const existing = await prisma.reaction.findUnique({ where })
  if (existing) await prisma.reaction.delete({ where: { id: existing.id } })
  else await prisma.reaction.create({ data: { postId, userId: me.id, reactionType: 'LIKE' } })
  const likes = await prisma.reaction.count({ where: { postId } })
  res.json({ likes, liked: !existing })
})

export default router
