import crypto from 'crypto'
import ExcelJS from 'exceljs'
import bcrypt from 'bcryptjs'
import { prisma } from '../../shared/prisma.js'
import { findUserByEmail, normalizeEmail } from '../auth/session.js'

const ROLES = new Set(['PLAYER', 'HOST', 'ADMIN'])
const USER_STATUSES = new Set(['ACTIVE', 'BLOCKED'])
const NIGHT_STATUSES = new Set(['PLANNED', 'PUBLISHED', 'OPEN', 'CANCELLED', 'DONE'])
const BOOKING_STATUSES = new Set(['CONFIRMED', 'CANCELLED', 'WAITING'])

function rawCell(value) {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim()
    if (value.result != null) return String(value.result).trim()
    if (value instanceof Date) return value
  }
  return typeof value === 'string' ? value.trim() : value
}

function cell(row, headers, key) {
  const index = headers[key]
  if (!index) return ''
  return rawCell(row.getCell(index).value)
}

function asText(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function asInt(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function asDecimal(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asBool(value) {
  if (value === true || value === false) return value
  const text = asText(value).toLowerCase()
  if (text === 'true' || text === '1' || text === 'yes' || text === 'да') return true
  if (text === 'false' || text === '0' || text === 'no' || text === 'нет') return false
  return null
}

function asDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(asText(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Одна плохая строка не должна обрывать импорт на середине.
function rowError(error) {
  console.error(error)
  if (error?.code === 'P2002') return 'такая запись уже есть'
  return 'не удалось сохранить строку'
}

function sheetData(workbook, name) {
  const sheet = workbook.getWorksheet(name)
  if (!sheet) return { headers: {}, rows: [] }
  const headerRow = sheet.getRow(1)
  const headers = {}
  headerRow.eachCell((c, index) => {
    const key = asText(rawCell(c.value))
    if (key) headers[key] = index
  })
  const rows = []
  sheet.eachRow((row, index) => {
    if (index === 1) return
    rows.push(row)
  })
  return { headers, rows }
}

export async function buildClubWorkbook() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NOX'
  workbook.created = new Date()

  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  const nights = await prisma.gameNight.findMany({
    orderBy: { id: 'asc' },
    include: { host: { select: { email: true } } },
  })
  const bookings = await prisma.booking.findMany({
    orderBy: { id: 'asc' },
    include: { user: { select: { email: true } } },
  })

  const usersSheet = workbook.addWorksheet('users')
  usersSheet.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'email', key: 'email', width: 28 },
    { header: 'displayName', key: 'displayName', width: 20 },
    { header: 'phone', key: 'phone', width: 16 },
    { header: 'role', key: 'role', width: 10 },
    { header: 'status', key: 'status', width: 10 },
    { header: 'bonusBalance', key: 'bonusBalance', width: 14 },
  ]
  for (const user of users) {
    usersSheet.addRow({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      bonusBalance: Number(user.bonusBalance),
    })
  }

  const nightsSheet = workbook.addWorksheet('game_nights')
  nightsSheet.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'hostEmail', key: 'hostEmail', width: 28 },
    { header: 'format', key: 'format', width: 16 },
    { header: 'seasonId', key: 'seasonId', width: 10 },
    { header: 'title', key: 'title', width: 28 },
    { header: 'description', key: 'description', width: 28 },
    { header: 'startsAt', key: 'startsAt', width: 24 },
    { header: 'endsAt', key: 'endsAt', width: 24 },
    { header: 'registrationDeadlineAt', key: 'registrationDeadlineAt', width: 24 },
    { header: 'capacity', key: 'capacity', width: 10 },
    { header: 'status', key: 'status', width: 12 },
  ]
  for (const night of nights) {
    nightsSheet.addRow({
      id: night.id,
      hostEmail: night.host.email,
      format: night.format,
      seasonId: night.seasonId ?? '',
      title: night.title,
      description: night.description || '',
      startsAt: night.startsAt.toISOString(),
      endsAt: night.endsAt ? night.endsAt.toISOString() : '',
      registrationDeadlineAt: night.registrationDeadlineAt
        ? night.registrationDeadlineAt.toISOString()
        : '',
      capacity: night.capacity,
      status: night.status,
    })
  }

  const bookingsSheet = workbook.addWorksheet('bookings')
  bookingsSheet.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'gameNightId', key: 'gameNightId', width: 12 },
    { header: 'userEmail', key: 'userEmail', width: 28 },
    { header: 'status', key: 'status', width: 12 },
    { header: 'cancellationReason', key: 'cancellationReason', width: 28 },
    { header: 'cancelledAt', key: 'cancelledAt', width: 24 },
    { header: 'overCapacityOverride', key: 'overCapacityOverride', width: 18 },
  ]
  for (const booking of bookings) {
    bookingsSheet.addRow({
      id: booking.id,
      gameNightId: booking.gameNightId,
      userEmail: booking.user.email,
      status: booking.status,
      cancellationReason: booking.cancellationReason || '',
      cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : '',
      overCapacityOverride: booking.overCapacityOverride,
    })
  }

  return workbook.xlsx.writeBuffer()
}

export async function importClubWorkbook(buffer, adminId) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const summary = {
    users: { created: 0, updated: 0, skipped: 0 },
    game_nights: { created: 0, updated: 0, skipped: 0 },
    bookings: { created: 0, updated: 0, skipped: 0 },
    errors: [],
    // Новым аккаунтам выдаётся случайный пароль; админ передаёт его игроку один раз.
    passwords: [],
  }

  const usersSheet = sheetData(workbook, 'users')
  for (const row of usersSheet.rows) {
    const email = normalizeEmail(asText(cell(row, usersSheet.headers, 'email')))
    if (!email) {
      summary.users.skipped += 1
      continue
    }
    const displayName = asText(cell(row, usersSheet.headers, 'displayName')) || email.split('@')[0]
    const phone = asText(cell(row, usersSheet.headers, 'phone')) || null
    const roleRaw = asText(cell(row, usersSheet.headers, 'role')).toUpperCase() || 'PLAYER'
    const statusRaw = asText(cell(row, usersSheet.headers, 'status')).toUpperCase() || 'ACTIVE'
    const role = ROLES.has(roleRaw) ? roleRaw : null
    const status = USER_STATUSES.has(statusRaw) ? statusRaw : null
    const bonus = asDecimal(cell(row, usersSheet.headers, 'bonusBalance'))
    if (!role || !status) {
      summary.errors.push(`users ${email}: неверная роль или статус`)
      summary.users.skipped += 1
      continue
    }
    const data = { displayName, phone, role, status }
    // Пустая ячейка не обнуляет баланс существующего игрока.
    if (bonus != null) data.bonusBalance = bonus
    try {
      const existing = await findUserByEmail(email)
      if (existing) {
        // Как и в /users/:id/role: файл не должен снять с админа роль или заблокировать его.
        if (existing.id === adminId && (role !== existing.role || status !== existing.status)) {
          summary.errors.push(`users ${email}: свою роль и статус через файл не меняем`)
          delete data.role
          delete data.status
        }
        await prisma.user.update({ where: { id: existing.id }, data })
        summary.users.updated += 1
      } else {
        const password = crypto.randomBytes(9).toString('base64url')
        const passwordHash = await bcrypt.hash(password, 10)
        await prisma.user.create({ data: { email, passwordHash, ...data } })
        summary.passwords.push({ email, password })
        summary.users.created += 1
      }
    } catch (error) {
      summary.errors.push(`users ${email}: ${rowError(error)}`)
      summary.users.skipped += 1
    }
  }

  const usersByEmail = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map((u) => [
      u.email.toLowerCase(),
      u.id,
    ]),
  )

  const nightsSheet = sheetData(workbook, 'game_nights')
  for (const row of nightsSheet.rows) {
    const title = asText(cell(row, nightsSheet.headers, 'title'))
    const format = asText(cell(row, nightsSheet.headers, 'format'))
    const hostEmail = asText(cell(row, nightsSheet.headers, 'hostEmail')).toLowerCase()
    const startsAt = asDate(cell(row, nightsSheet.headers, 'startsAt'))
    const capacity = asInt(cell(row, nightsSheet.headers, 'capacity'))
    const statusRaw = asText(cell(row, nightsSheet.headers, 'status')).toUpperCase() || 'PLANNED'
    const status = NIGHT_STATUSES.has(statusRaw) ? statusRaw : null
    const id = asInt(cell(row, nightsSheet.headers, 'id'))
    if (!title || !format || !hostEmail || !startsAt || capacity == null || capacity < 1 || !status) {
      summary.errors.push(`game_nights ${title || id || '?'}: неполные данные`)
      summary.game_nights.skipped += 1
      continue
    }
    const hostId = usersByEmail.get(hostEmail)
    if (!hostId) {
      summary.errors.push(`game_nights ${title}: хост ${hostEmail} не найден`)
      summary.game_nights.skipped += 1
      continue
    }
    const seasonId = asInt(cell(row, nightsSheet.headers, 'seasonId'))
    if (seasonId != null) {
      const season = await prisma.season.findUnique({ where: { id: seasonId } })
      if (!season) {
        summary.errors.push(`game_nights ${title}: сезон ${seasonId} не найден`)
        summary.game_nights.skipped += 1
        continue
      }
    }
    const data = {
      hostId,
      format,
      seasonId: seasonId ?? null,
      title,
      description: asText(cell(row, nightsSheet.headers, 'description')) || null,
      startsAt,
      endsAt: asDate(cell(row, nightsSheet.headers, 'endsAt')),
      registrationDeadlineAt: asDate(cell(row, nightsSheet.headers, 'registrationDeadlineAt')),
      capacity,
      status,
    }
    try {
      const existing = id ? await prisma.gameNight.findUnique({ where: { id } }) : null
      if (existing) {
        await prisma.gameNight.update({ where: { id: existing.id }, data })
        summary.game_nights.updated += 1
      } else {
        await prisma.gameNight.create({ data })
        summary.game_nights.created += 1
      }
    } catch (error) {
      summary.errors.push(`game_nights ${title}: ${rowError(error)}`)
      summary.game_nights.skipped += 1
    }
  }

  const bookingsSheet = sheetData(workbook, 'bookings')
  for (const row of bookingsSheet.rows) {
    const gameNightId = asInt(cell(row, bookingsSheet.headers, 'gameNightId'))
    const userEmail = asText(cell(row, bookingsSheet.headers, 'userEmail')).toLowerCase()
    const statusRaw = asText(cell(row, bookingsSheet.headers, 'status')).toUpperCase() || 'CONFIRMED'
    const status = BOOKING_STATUSES.has(statusRaw) ? statusRaw : null
    if (!gameNightId || !userEmail || !status) {
      summary.bookings.skipped += 1
      continue
    }
    const userId = usersByEmail.get(userEmail)
    if (!userId) {
      summary.errors.push(`bookings: пользователь ${userEmail} не найден`)
      summary.bookings.skipped += 1
      continue
    }
    const night = await prisma.gameNight.findUnique({ where: { id: gameNightId } })
    if (!night) {
      summary.errors.push(`bookings: вечер ${gameNightId} не найден`)
      summary.bookings.skipped += 1
      continue
    }
    const override = asBool(cell(row, bookingsSheet.headers, 'overCapacityOverride'))
    const data = {
      status,
      cancellationReason: asText(cell(row, bookingsSheet.headers, 'cancellationReason')) || null,
      cancelledAt: asDate(cell(row, bookingsSheet.headers, 'cancelledAt')),
      overCapacityOverride: override == null ? false : override,
    }
    try {
      const existing = await prisma.booking.findUnique({
        where: { gameNightId_userId: { gameNightId, userId } },
      })
      if (existing) {
        await prisma.booking.update({ where: { id: existing.id }, data })
        summary.bookings.updated += 1
      } else {
        await prisma.booking.create({
          data: { gameNightId, userId, ...data },
        })
        summary.bookings.created += 1
      }
    } catch (error) {
      summary.errors.push(`bookings ${userEmail} / ${gameNightId}: ${rowError(error)}`)
      summary.bookings.skipped += 1
    }
  }

  return summary
}
