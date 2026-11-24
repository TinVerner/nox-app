import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const inserted = []
const skipped = []

function note(kind, label) {
  inserted.push({ kind, label })
}

async function userByEmail(email, data) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    skipped.push('user ' + email)
    return existing
  }
  const passwordHash = await bcrypt.hash('secret123', 10)
  const user = await prisma.user.create({ data: { email, passwordHash, status: 'ACTIVE', ...data } })
  note('user', email + ' ' + data.displayName + ' ' + data.role)
  return user
}

async function main() {
  const ranks = [
    { code: 'MASTER', name: 'Мастер ★', criteria: { games: 90 }, benefits: 'Скидка 5 BYN на открытую игру' },
    { code: 'MASTER_PRO', name: 'Мастер Про ★★', criteria: { winrate: 75, games: 50 }, benefits: 'Скидка 10 BYN на открытую игру и 20% на вечеринки' },
    { code: 'LEGEND', name: 'Легенда', criteria: { winrate: 85, games: 50 }, benefits: 'Скидка 15 BYN на открытую игру и 50% на вечеринки' },
  ]
  for (const rank of ranks) {
    const existing = await prisma.rankDefinition.findUnique({ where: { code: rank.code } })
    if (existing) skipped.push('rank ' + rank.code)
    else {
      await prisma.rankDefinition.create({ data: rank })
      note('rank', rank.name)
    }
  }

  const tin = await userByEmail('tin@nox.club', { displayName: 'Tin', role: 'HOST' })
  await userByEmail('tin2@nox.club', { displayName: 'Tin2', role: 'HOST' })
  const qwerty = await userByEmail('tin@nox.app', { displayName: 'qwerty', role: 'PLAYER' })
  await userByEmail('maxx@gmail.com', { displayName: 'maxx', role: 'PLAYER' })
  await userByEmail('admin@nox.club', { displayName: 'Админ', role: 'ADMIN' })
  const dentessa = await userByEmail('dentessa@nox.club', { displayName: 'Дентесса', role: 'PLAYER' })
  const brotuzik = await userByEmail('brotuzik@nox.club', { displayName: 'Бротузик', role: 'PLAYER' })
  const archie = await userByEmail('archie@nox.club', { displayName: 'Арчи', role: 'PLAYER' })

  const rankByCode = new Map((await prisma.rankDefinition.findMany()).map((rank) => [rank.code, rank]))
  const grants = [
    [dentessa, 'LEGEND'],
    [brotuzik, 'MASTER_PRO'],
    [archie, 'MASTER'],
  ]
  for (const [user, code] of grants) {
    const already = await prisma.userRank.findFirst({ where: { userId: user.id, status: 'CONFIRMED' } })
    if (already) {
      skipped.push('user rank ' + user.displayName)
      continue
    }
    await prisma.userRank.create({
      data: {
        userId: user.id,
        rankId: rankByCode.get(code).id,
        status: 'CONFIRMED',
        confirmedBy: tin.id,
        confirmedAt: new Date(),
      },
    })
    note('user rank', user.displayName + ' ' + code)
  }

  let season = await prisma.season.findUnique({ where: { name: 'Осень 2026' } })
  if (season) skipped.push('season Осень 2026')
  else {
    season = await prisma.season.create({
      data: {
        name: 'Осень 2026',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2026-11-30'),
        status: 'OPEN',
      },
    })
    note('season', 'Осень 2026')
  }

  const nights = [
    { title: 'Субботняя мафия', format: 'CLASSIC', capacity: 10, startsAt: new Date('2026-11-21T18:00:00.000Z') },
    { title: 'Пятничная классика', format: 'CLASSIC', capacity: 12, startsAt: new Date('2026-11-27T18:00:00.000Z') },
    { title: 'Вечер новичков', format: 'NOVICE', capacity: 10, startsAt: new Date('2026-11-28T15:00:00.000Z') },
    { title: 'Турнир осени', format: 'TOURNAMENT', capacity: 8, startsAt: new Date('2026-12-05T16:00:00.000Z') },
  ]
  for (const night of nights) {
    const existing = await prisma.gameNight.findFirst({ where: { title: night.title } })
    if (existing) {
      skipped.push('night ' + night.title)
      continue
    }
    await prisma.gameNight.create({
      data: {
        ...night,
        hostId: tin.id,
        seasonId: season.id,
        description: 'клуб NOX',
        status: 'PUBLISHED',
      },
    })
    note('night', night.title + ' ' + night.format)
  }

  const saturday = await prisma.gameNight.findFirst({ where: { title: 'Субботняя мафия' } })
  const tournament = await prisma.gameNight.findFirst({ where: { title: 'Турнир осени' } })
  const novice = await prisma.gameNight.findFirst({ where: { title: 'Вечер новичков' } })

  async function book(user, night) {
    if (!user || !night) return null
    const existing = await prisma.booking.findUnique({
      where: { gameNightId_userId: { gameNightId: night.id, userId: user.id } },
    })
    if (existing) {
      skipped.push('booking ' + user.displayName + ' ' + night.title)
      return existing
    }
    const booking = await prisma.booking.create({
      data: { gameNightId: night.id, userId: user.id, status: 'CONFIRMED' },
    })
    note('booking', user.displayName + ' → ' + night.title)
    return booking
  }

  await book(qwerty, saturday)
  await book(dentessa, tournament)
  await book(brotuzik, novice)

  let news = await prisma.newsPost.findFirst({ where: { title: 'Открытие сезона' } })
  if (news) skipped.push('news Открытие сезона')
  else {
    news = await prisma.newsPost.create({
      data: {
        authorId: tin.id,
        title: 'Открытие сезона',
        content: 'Первая игра клуба NOX в эту субботу.',
        status: 'PUBLISHED',
      },
    })
    note('news', 'Открытие сезона')
  }
  const comments = await prisma.comment.count({ where: { postId: news.id } })
  if (comments === 0) {
    await prisma.comment.create({
      data: { postId: news.id, userId: qwerty.id, content: 'Не прощаемся — до следующей игры!' },
    })
    note('comment', 'qwerty')
  } else skipped.push('comment already')
  const reaction = await prisma.reaction.findUnique({
    where: { postId_userId: { postId: news.id, userId: qwerty.id } },
  })
  if (!reaction) {
    await prisma.reaction.create({ data: { postId: news.id, userId: qwerty.id, reactionType: 'LIKE' } })
    note('reaction', 'qwerty')
  } else skipped.push('reaction already')

  const partyCount = saturday ? await prisma.party.count({ where: { gameNightId: saturday.id } }) : 1
  if (saturday && partyCount === 0) {
    const party = await prisma.party.create({
      data: { gameNightId: saturday.id, partyNumber: 1, createdBy: tin.id, status: 'DONE' },
    })
    await prisma.partyPlayer.createMany({
      data: [
        { partyId: party.id, userId: qwerty.id, playerName: 'qwerty', playerRole: 'Мирный', gameResult: 'Победа', basePoints: 8 },
        { partyId: party.id, userId: dentessa.id, playerName: 'Дентесса', playerRole: 'Дон', gameResult: 'Победа', basePoints: 11 },
      ],
    })
    note('party', 'Субботняя мафия: qwerty 8, Дентесса 11')
  } else skipped.push('party already')

  const sanctions = await prisma.sanction.count()
  if (sanctions === 0) {
    await prisma.sanction.create({
      data: {
        userId: archie.id,
        reportedBy: tin.id,
        approvedBy: tin.id,
        sanctionType: 'LATE_10',
        bonusDelta: -5,
        reason: 'опоздание на 10 минут',
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })
    await prisma.user.update({ where: { id: archie.id }, data: { bonusBalance: { increment: -5 } } })
    note('sanction', 'Арчи LATE_10 −5')
  } else skipped.push('sanction already')

  await seedCrowd(tin, season, rankByCode)

  const byKind = {}
  for (const row of inserted) byKind[row.kind] = (byKind[row.kind] || 0) + 1
  console.log(JSON.stringify({ inserted: inserted.length, byKind, skipped: skipped.length, top: 'Серафима' }, null, 2))
}

const CROWD = [
  ['serafima@nox.club', 'Серафима', 'LEGEND', 0],
  ['markiza@nox.club', 'Маркиза', 'MASTER_PRO', 500],
  ['volk@nox.club', 'Волк', 'LEGEND', 0],
  ['lisa@nox.club', 'Лиса', 'MASTER_PRO', 80],
  ['voron@nox.club', 'Ворон', 'MASTER_PRO', 0],
  ['knyazhna@nox.club', 'Княжна', 'MASTER_PRO', 0],
  ['bars@nox.club', 'Барс', 'LEGEND', 0],
  ['sova@nox.club', 'Сова', 'MASTER_PRO', 0],
  ['iris@nox.club', 'Ирис', 'MASTER', 40],
  ['plut@nox.club', 'Плут', 'MASTER', 0],
  ['nora@nox.club', 'Нора', 'MASTER', 0],
  ['graf@nox.club', 'Граф', 'MASTER', 0],
  ['mira@nox.club', 'Мира', 'MASTER', 20],
  ['ten@nox.club', 'Тень', null, 0],
  ['yantar@nox.club', 'Янтарь', null, 0],
  ['korshun@nox.club', 'Коршун', 'MASTER', 0],
  ['lada@nox.club', 'Лада', 'MASTER', 15],
  ['shut@nox.club', 'Шут', null, 0],
  ['vesta@nox.club', 'Веста', null, 0],
  ['grom@nox.club', 'Гром', null, 0],
  ['nika@nox.club', 'Ника', null, 0],
  ['runa@nox.club', 'Руна', null, 0],
  ['orel@nox.club', 'Орёл', null, 0],
  ['kira@nox.club', 'Кира', null, 0],
  ['dym@nox.club', 'Дым', null, 0],
  ['astra@nox.club', 'Астра', null, 0],
  ['hort@nox.club', 'Хорт', null, 0],
  ['lel@nox.club', 'Лель', null, 0],
  ['iskra@nox.club', 'Искра', null, 0],
  ['borey@nox.club', 'Борей', null, 0],
  ['umka@nox.club', 'Умка', null, 0],
  ['rada@nox.club', 'Рада', null, 0],
  ['skat@nox.club', 'Скат', null, 0],
  ['eva@nox.club', 'Эва', null, 0],
  ['tur@nox.club', 'Тур', null, 0],
  ['zlata@nox.club', 'Злата', null, 0],
  ['pirat@nox.club', 'Пират', null, 0],
  ['morok@nox.club', 'Морок', null, 0],
  ['agata@nox.club', 'Агата', null, 0],
  ['filin@nox.club', 'Филин', null, 0],
  ['rosa@nox.club', 'Роса', null, 0],
  ['krot@nox.club', 'Крот', null, 0],
  ['neya@nox.club', 'Нея', null, 0],
  ['bulat@nox.club', 'Булат', null, 0],
  ['sima@nox.club', 'Сима', null, 0],
  ['eger@nox.club', 'Егерь', null, 0],
  ['lana@nox.club', 'Лана', null, 0],
  ['tish@nox.club', 'Тишь', null, 0],
  ['yurok@nox.club', 'Юрок', null, 0],
  ['tihon@nox.club', 'Тихон', null, 0],
]

const ROLES = ['Мирный', 'Мафия', 'Шериф', 'Дон']
const PENDING = [
  [20, 'MASTER'],
  [21, 'MASTER_PRO'],
  [22, 'LEGEND'],
  [25, 'MASTER'],
  [28, 'MASTER_PRO'],
]

function crowdShape(index) {
  if (index >= 40) return { games: 0, perGame: 0 }
  const games = 18 - Math.floor((index * 17) / 39)
  const perGame = Math.max(1, 10 - Math.floor(index / 5))
  return { games, perGame }
}

async function seedCrowd(tin, season, rankByCode) {
  const players = []
  for (const [email, displayName] of CROWD) {
    players.push(await userByEmail(email, {
      displayName,
      role: 'PLAYER',
    }))
  }

  for (let index = 0; index < CROWD.length; index += 1) {
    const code = CROWD[index][2]
    if (!code) continue
    const user = players[index]
    const already = await prisma.userRank.findFirst({ where: { userId: user.id, status: 'CONFIRMED' } })
    if (already) {
      skipped.push('user rank ' + user.displayName)
      continue
    }
    await prisma.userRank.create({
      data: {
        userId: user.id,
        rankId: rankByCode.get(code).id,
        status: 'CONFIRMED',
        confirmedBy: tin.id,
        confirmedAt: new Date(),
      },
    })
    note('user rank', user.displayName + ' ' + code)
  }

  for (const [index, code] of PENDING) {
    const user = players[index]
    const rankId = rankByCode.get(code).id
    const already = await prisma.userRank.findFirst({ where: { userId: user.id, rankId, status: 'PENDING' } })
    if (already) {
      skipped.push('pending ' + user.displayName)
      continue
    }
    await prisma.userRank.create({ data: { userId: user.id, rankId, status: 'PENDING' } })
    note('pending rank', user.displayName + ' ' + code)
  }

  const extraNights = [
    { title: 'Таблица сезона', format: 'CLASSIC', capacity: 20, startsAt: new Date('2026-10-18T16:00:00.000Z'), description: 'Игры, из которых собрана таблица рейтинга.' },
    { title: 'Воскресный круг', format: 'CLASSIC', capacity: 12, startsAt: new Date('2026-11-22T16:00:00.000Z'), description: 'Открытый стол, гости приветствуются.' },
    { title: 'Среда в NOX', format: 'NOVICE', capacity: 10, startsAt: new Date('2026-12-02T17:00:00.000Z'), description: 'Вечер для тех, кто только садится за стол.' },
    { title: 'Декабрьская классика', format: 'CLASSIC', capacity: 10, startsAt: new Date('2026-12-12T16:00:00.000Z'), description: 'Обычная суббота клуба.' },
    { title: 'Новогодний стол', format: 'TOURNAMENT', capacity: 14, startsAt: new Date('2026-12-26T17:00:00.000Z'), description: 'Турнир перед новым годом.' },
  ]
  for (const night of extraNights) {
    const existing = await prisma.gameNight.findFirst({ where: { title: night.title } })
    if (existing) {
      skipped.push('night ' + night.title)
      continue
    }
    await prisma.gameNight.create({
      data: {
        ...night,
        hostId: tin.id,
        seasonId: season.id,
        status: 'PUBLISHED',
        registrationDeadlineAt: new Date(night.startsAt.getTime() - 3 * 60 * 60 * 1000),
      },
    })
    note('night', night.title)
  }

  const table = await prisma.gameNight.findFirst({ where: { title: 'Таблица сезона' } })
  const sunday = await prisma.gameNight.findFirst({ where: { title: 'Воскресный круг' } })
  const wednesday = await prisma.gameNight.findFirst({ where: { title: 'Среда в NOX' } })
  const december = await prisma.gameNight.findFirst({ where: { title: 'Декабрьская классика' } })

  async function bookNamed(user, night) {
    if (!user || !night) return null
    const existing = await prisma.booking.findUnique({
      where: { gameNightId_userId: { gameNightId: night.id, userId: user.id } },
    })
    if (existing) {
      skipped.push('booking ' + user.displayName + ' ' + night.title)
      return existing
    }
    const booking = await prisma.booking.create({
      data: { gameNightId: night.id, userId: user.id, status: 'CONFIRMED' },
    })
    note('booking', user.displayName + ' → ' + night.title)
    return booking
  }

  await bookNamed(players[0], sunday)
  await bookNamed(players[1], sunday)
  await bookNamed(players[2], sunday)
  await bookNamed(players[3], sunday)
  await bookNamed(players[4], sunday)
  await bookNamed(players[7], wednesday)
  await bookNamed(players[8], wednesday)
  await bookNamed(players[9], wednesday)
  await bookNamed(players[5], december)
  await bookNamed(players[6], december)

  if (table) {
    const shapes = CROWD.map((_, index) => crowdShape(index))
    const maxGames = Math.max(...shapes.map((shape) => shape.games))
    for (let number = 1; number <= maxGames; number += 1) {
      let party = await prisma.party.findUnique({
        where: { gameNightId_partyNumber: { gameNightId: table.id, partyNumber: number } },
      })
      if (!party) {
        party = await prisma.party.create({
          data: {
            gameNightId: table.id,
            partyNumber: number,
            createdBy: tin.id,
            status: 'DONE',
            finalizedAt: new Date('2026-10-18T20:00:00.000Z'),
          },
        })
        note('party', 'Таблица сезона ' + number)
      } else skipped.push('party Таблица сезона ' + number)
      const seated = await prisma.partyPlayer.findMany({ where: { partyId: party.id }, select: { userId: true } })
      const seatedIds = new Set(seated.map((row) => row.userId))
      const fresh = []
      shapes.forEach((shape, index) => {
        if (shape.games < number || seatedIds.has(players[index].id)) return
        fresh.push({
          partyId: party.id,
          userId: players[index].id,
          playerName: players[index].displayName,
          playerRole: ROLES[(index + number) % ROLES.length],
          gameResult: shape.perGame >= 4 ? 'Победа' : 'Поражение',
          basePoints: shape.perGame,
        })
      })
      if (fresh.length) {
        await prisma.partyPlayer.createMany({ data: fresh })
        note('party players', 'партия ' + number + ': ' + fresh.length)
      }
    }
  }

  const posts = [
    {
      title: 'Итоги октября',
      content: 'Таблица сезона собрана: впереди Серафима, за ней плотная группа мастеров.',
      comments: [
        [0, 'До следующей таблицы не прощаемся.'],
        [1, 'Красивый стол был.'],
        [2, 'Шериф в третьей партии решил игру.'],
      ],
      likes: [0, 1, 2, 3],
    },
    {
      title: 'Набор на турнир города',
      content: '19 декабря клубный турнир. Мест немного.',
      comments: [[3, 'Я уже в списке.']],
      likes: [1, 5],
    },
  ]
  for (const post of posts) {
    let news = await prisma.newsPost.findFirst({ where: { title: post.title } })
    if (news) skipped.push('news ' + post.title)
    else {
      news = await prisma.newsPost.create({
        data: { authorId: tin.id, title: post.title, content: post.content, status: 'PUBLISHED' },
      })
      note('news', post.title)
    }
    for (const [index, content] of post.comments) {
      const existing = await prisma.comment.findFirst({ where: { postId: news.id, userId: players[index].id, content } })
      if (existing) {
        skipped.push('comment ' + players[index].displayName)
        continue
      }
      await prisma.comment.create({ data: { postId: news.id, userId: players[index].id, content } })
      note('comment', players[index].displayName + ' / ' + post.title)
    }
    for (const index of post.likes) {
      const existing = await prisma.reaction.findUnique({
        where: { postId_userId: { postId: news.id, userId: players[index].id } },
      })
      if (existing) {
        skipped.push('reaction ' + players[index].displayName)
        continue
      }
      await prisma.reaction.create({ data: { postId: news.id, userId: players[index].id, reactionType: 'LIKE' } })
      note('reaction', players[index].displayName + ' / ' + post.title)
    }
  }

  const notices = [
    [0, 'Вас ждут на таблице сезона', false],
    [2, 'Ранг подтверждён: Легенда', true],
    [20, 'Заявка на ранг на рассмотрении', false],
    [3, 'Запись на воскресный круг подтверждена', true],
  ]
  for (const [index, message, isRead] of notices) {
    const user = players[index]
    const existing = await prisma.notification.findFirst({ where: { userId: user.id, message } })
    if (existing) {
      skipped.push('notice ' + user.displayName)
      continue
    }
    await prisma.notification.create({
      data: { userId: user.id, notificationType: 'CLUB', message, targetPath: '/notices', isRead },
    })
    note('notice', user.displayName)
  }
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
