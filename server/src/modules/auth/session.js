import crypto from 'crypto'
import { prisma } from '../../shared/prisma.js'

const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

function setSessionCookie(res, id) {
  res.setHeader('Set-Cookie', `nox.sid=${encodeURIComponent(id)}; HttpOnly; Path=/; SameSite=Lax`)
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'nox.sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
}

export async function sessionMiddleware(req, res, next) {
  try {
    const sid = readCookie(req, 'nox.sid')
    if (!sid) return next()
    const row = await prisma.session.findUnique({ where: { id: sid } })
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) await prisma.session.delete({ where: { id: row.id } }).catch(() => {})
      return next()
    }
    req.sessionId = row.id
    req.userId = row.userId
    next()
  } catch (error) {
    next(error)
  }
}

export function isStaff(user) {
  return user && (user.role === 'HOST' || user.role === 'ADMIN')
}

export function isAdmin(user) {
  return user && user.role === 'ADMIN'
}

export async function meOrNull(req) {
  if (!req.userId) return null
  return prisma.user.findUnique({ where: { id: req.userId } })
}

export function passwordMeetsRules(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /\d/.test(password) &&
    /[A-ZА-ЯЁ]/.test(password) &&
    /[^0-9A-Za-zА-Яа-яЁё]/.test(password)
  )
}

export async function openSession(res, userId) {
  const id = crypto.randomBytes(32).toString('hex')
  await prisma.session.create({
    data: { id, userId, expiresAt: new Date(Date.now() + SESSION_MS) },
  })
  setSessionCookie(res, id)
}
