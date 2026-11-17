import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const inserted = []
const skipped = []

function note(kind, label) {
  inserted.push({ kind, label })
}

async function main() {
  const password = await bcrypt.hash('secret123', 10)

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (admin) skipped.push('admin ' + admin.email)
  else {
    await prisma.user.create({
      data: { email: 'admin@nox.club', password, nick: 'Админ', role: 'ADMIN' },
    })
    note('user', 'admin@nox.club Админ ADMIN')
  }

  const players = [
    { email: 'dentessa@nox.club', nick: 'Дентесса', rank: 'LEGEND' },
    { email: 'brotuzik@nox.club', nick: 'Бротузик', rank: 'MASTER_PRO' },
    { email: 'archie@nox.club', nick: 'Арчи', rank: 'MASTER' },
  ]
  for (const player of players) {
    const existing = await prisma.user.findUnique({ where: { email: player.email } })
    if (existing) {
      skipped.push('user ' + player.email)
      continue
    }
    await prisma.user.create({
      data: { ...player, password, role: 'PLAYER' },
    })
    note('user', player.email + ' ' + player.nick + ' ' + player.rank)
  }

  const hosts = await prisma.user.count({ where: { role: 'HOST' } })
  skipped.push('host already ' + hosts)

  const season = await prisma.season.findFirst({ where: { name: 'Осень 2026' } })
  const games = [
    { title: 'Пятничная классика', kind: 'CLASSIC', seats: 12, price: 35, startsAt: new Date('2026-11-27T18:00:00.000Z') },
    { title: 'Турнир осени', kind: 'TOURNAMENT', seats: 8, price: 40, startsAt: new Date('2026-12-05T16:00:00.000Z') },
    { title: 'Вечер новичков', kind: 'NOVICE', seats: 10, price: 15, startsAt: new Date('2026-11-28T15:00:00.000Z') },
  ]
  for (const game of games) {
    const existing = await prisma.game.findFirst({ where: { title: game.title } })
    if (existing) {
      skipped.push('game ' + game.title)
      continue
    }
    await prisma.game.create({
      data: {
        ...game,
        place: 'клуб NOX',
        status: 'PUBLISHED',
        seasonId: season?.id,
      },
    })
    note('game', game.title + ' ' + game.kind + ' ' + game.seats + ' мест ' + game.price + ' BYN')
  }

  const saturday = await prisma.game.findFirst({ where: { title: 'Субботняя мафия' } })
  const qwerty = await prisma.user.findUnique({ where: { email: 'tin@nox.app' } })
  if (saturday && qwerty) {
    const booking = await prisma.booking.findFirst({
      where: { userId: qwerty.id, gameId: saturday.id },
      include: { guests: true },
    })
    if (booking && booking.guests.length === 0) {
      await prisma.bookingGuest.create({
        data: { bookingId: booking.id, displayName: 'Грейс' },
      })
      note('guest', 'Грейс на записи qwerty, Субботняя мафия')
    } else if (booking) skipped.push('guest already')
  }

  const dentessa = await prisma.user.findUnique({ where: { email: 'dentessa@nox.club' } })
  const brotuzik = await prisma.user.findUnique({ where: { email: 'brotuzik@nox.club' } })
  const tournament = await prisma.game.findFirst({ where: { title: 'Турнир осени' } })
  const novice = await prisma.game.findFirst({ where: { title: 'Вечер новичков' } })
  const extraBookings = [
    [dentessa, tournament],
    [brotuzik, novice],
  ]
  for (const [user, game] of extraBookings) {
    if (!user || !game) continue
    const existing = await prisma.booking.findFirst({ where: { userId: user.id, gameId: game.id } })
    if (existing) {
      skipped.push('booking ' + user.nick + ' ' + game.title)
      continue
    }
    await prisma.booking.create({
      data: { userId: user.id, gameId: game.id, status: 'CONFIRMED' },
    })
    note('booking', user.nick + ' → ' + game.title)
  }

  const news = await prisma.news.findFirst({ where: { title: 'Открытие сезона' } })
  if (news && qwerty) {
    const comments = await prisma.comment.count({ where: { newsId: news.id } })
    if (comments === 0) {
      await prisma.comment.create({
        data: { newsId: news.id, userId: qwerty.id, body: 'Не прощаемся — до следующей игры!' },
      })
      note('comment', 'qwerty на «Открытие сезона»')
    } else skipped.push('comment already')
    const reaction = await prisma.reaction.findUnique({
      where: { newsId_userId: { newsId: news.id, userId: qwerty.id } },
    })
    if (!reaction) {
      await prisma.reaction.create({ data: { newsId: news.id, userId: qwerty.id } })
      note('reaction', 'qwerty на «Открытие сезона»')
    } else skipped.push('reaction already')
  }

  const resultCount = await prisma.result.count()
  if (resultCount === 0 && saturday) {
    await prisma.result.createMany({
      data: [
        { gameId: saturday.id, nick: 'qwerty', points: 8 },
        { gameId: saturday.id, nick: 'Дентесса', points: 11 },
      ],
    })
    note('result', 'qwerty 8 и Дентесса 11, Субботняя мафия')
  } else skipped.push('results already ' + resultCount)

  const sanctionCount = await prisma.sanction.count()
  const archie = await prisma.user.findUnique({ where: { email: 'archie@nox.club' } })
  if (sanctionCount === 0 && archie) {
    await prisma.sanction.create({
      data: {
        userId: archie.id,
        kind: 'LATE_10',
        reason: 'опоздание на 10 минут',
        bonusDelta: -5,
      },
    })
    await prisma.user.update({
      where: { id: archie.id },
      data: { bonus: archie.bonus + -5 },
    })
    note('sanction', 'Арчи LATE_10 −5')
  } else skipped.push('sanction already ' + sanctionCount)

  console.log(JSON.stringify({ inserted, skipped }, null, 2))
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
