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
  const tin = await userByEmail('tin@nox.club', { displayName: 'Tin', role: 'HOST' })
  await userByEmail('tin2@nox.club', { displayName: 'Tin2', role: 'HOST' })
  const qwerty = await userByEmail('tin@nox.app', { displayName: 'qwerty', role: 'PLAYER' })
  await userByEmail('maxx@gmail.com', { displayName: 'maxx', role: 'PLAYER' })
  await userByEmail('admin@nox.club', { displayName: 'Админ', role: 'ADMIN' })
  const dentessa = await userByEmail('dentessa@nox.club', { displayName: 'Дентесса', role: 'PLAYER' })
  const brotuzik = await userByEmail('brotuzik@nox.club', { displayName: 'Бротузик', role: 'PLAYER' })
  await userByEmail('archie@nox.club', { displayName: 'Арчи', role: 'PLAYER' })

  const nights = [
    { title: 'Субботняя мафия', format: 'CLASSIC', capacity: 10, startsAt: new Date('2026-11-21T18:00:00.000Z') },
    { title: 'Пятничная классика', format: 'CLASSIC', capacity: 12, startsAt: new Date('2026-11-27T18:00:00.000Z') },
    { title: 'Вечер новичков', format: 'NOVICE', capacity: 10, startsAt: new Date('2026-11-28T15:00:00.000Z') },
    { title: 'Декабрьский стол', format: 'CLASSIC', capacity: 8, startsAt: new Date('2026-12-05T16:00:00.000Z') },
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
        description: 'клуб NOX',
        status: 'PUBLISHED',
      },
    })
    note('night', night.title + ' ' + night.format)
  }

  const saturday = await prisma.gameNight.findFirst({ where: { title: 'Субботняя мафия' } })
  const december = await prisma.gameNight.findFirst({ where: { title: 'Декабрьский стол' } })
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
  await book(dentessa, december)
  await book(brotuzik, novice)

  let news = await prisma.newsPost.findFirst({ where: { title: 'Открытие клуба' } })
  if (news) skipped.push('news Открытие клуба')
  else {
    news = await prisma.newsPost.create({
      data: {
        authorId: tin.id,
        title: 'Открытие клуба',
        content: 'Первая игра клуба NOX в эту субботу.',
        status: 'PUBLISHED',
      },
    })
    note('news', 'Открытие клуба')
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

  await seedCrowd(tin)

  const byKind = {}
  for (const row of inserted) byKind[row.kind] = (byKind[row.kind] || 0) + 1
  console.log(JSON.stringify({ inserted: inserted.length, byKind, skipped: skipped.length, top: 'Серафима' }, null, 2))
}

const CROWD = [
  ['serafima@nox.club', 'Серафима', 0],
  ['markiza@nox.club', 'Маркиза', 500],
  ['volk@nox.club', 'Волк', 0],
  ['lisa@nox.club', 'Лиса', 80],
  ['voron@nox.club', 'Ворон', 0],
  ['knyazhna@nox.club', 'Княжна', 0],
  ['bars@nox.club', 'Барс', 0],
  ['sova@nox.club', 'Сова', 0],
  ['iris@nox.club', 'Ирис', 40],
  ['plut@nox.club', 'Плут', 0],
  ['nora@nox.club', 'Нора', 0],
  ['graf@nox.club', 'Граф', 0],
  ['mira@nox.club', 'Мира', 20],
  ['ten@nox.club', 'Тень', 0],
  ['yantar@nox.club', 'Янтарь', 0],
  ['korshun@nox.club', 'Коршун', 0],
  ['lada@nox.club', 'Лада', 15],
  ['shut@nox.club', 'Шут', 0],
  ['vesta@nox.club', 'Веста', 0],
  ['grom@nox.club', 'Гром', 0],
  ['nika@nox.club', 'Ника', 0],
  ['runa@nox.club', 'Руна', 0],
  ['orel@nox.club', 'Орёл', 0],
  ['kira@nox.club', 'Кира', 0],
  ['dym@nox.club', 'Дым', 0],
  ['astra@nox.club', 'Астра', 0],
  ['hort@nox.club', 'Хорт', 0],
  ['lel@nox.club', 'Лель', 0],
  ['iskra@nox.club', 'Искра', 0],
  ['borey@nox.club', 'Борей', 0],
  ['umka@nox.club', 'Умка', 0],
  ['rada@nox.club', 'Рада', 0],
  ['skat@nox.club', 'Скат', 0],
  ['eva@nox.club', 'Эва', 0],
  ['tur@nox.club', 'Тур', 0],
  ['zlata@nox.club', 'Злата', 0],
  ['pirat@nox.club', 'Пират', 0],
  ['morok@nox.club', 'Морок', 0],
  ['agata@nox.club', 'Агата', 0],
  ['filin@nox.club', 'Филин', 0],
  ['rosa@nox.club', 'Роса', 0],
  ['krot@nox.club', 'Крот', 0],
  ['neya@nox.club', 'Нея', 0],
  ['bulat@nox.club', 'Булат', 0],
  ['sima@nox.club', 'Сима', 0],
  ['eger@nox.club', 'Егерь', 0],
  ['lana@nox.club', 'Лана', 0],
  ['tish@nox.club', 'Тишь', 0],
  ['yurok@nox.club', 'Юрок', 0],
  ['tihon@nox.club', 'Тихон', 0],
]

const ROLES = ['Мирный', 'Мафия', 'Шериф', 'Дон']

function crowdShape(index) {
  if (index >= 40) return { games: 0, perGame: 0 }
  const games = 18 - Math.floor((index * 17) / 39)
  const perGame = Math.max(1, 10 - Math.floor(index / 5))
  return { games, perGame }
}

async function seedCrowd(tin) {
  const players = []
  for (const [email, displayName, bonus] of CROWD) {
    const user = await userByEmail(email, {
      displayName,
      role: 'PLAYER',
    })
    if (bonus && Number(user.bonusBalance) === 0) {
      await prisma.user.update({ where: { id: user.id }, data: { bonusBalance: bonus } })
    }
    players.push(user)
  }

  const extraNights = [
    { title: 'Таблица рейтинга', format: 'CLASSIC', capacity: 20, startsAt: new Date('2026-10-18T16:00:00.000Z'), description: 'Игры, из которых собрана таблица рейтинга.' },
    { title: 'Воскресный круг', format: 'CLASSIC', capacity: 12, startsAt: new Date('2026-11-22T16:00:00.000Z'), description: 'Открытый стол, гости приветствуются.' },
    { title: 'Среда в NOX', format: 'NOVICE', capacity: 10, startsAt: new Date('2026-12-02T17:00:00.000Z'), description: 'Вечер для тех, кто только садится за стол.' },
    { title: 'Декабрьская классика', format: 'CLASSIC', capacity: 10, startsAt: new Date('2026-12-12T16:00:00.000Z'), description: 'Обычная суббота клуба.' },
    { title: 'Новогодний стол', format: 'CLASSIC', capacity: 14, startsAt: new Date('2026-12-26T17:00:00.000Z'), description: 'Праздничный вечер перед новым годом.' },
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
        status: 'PUBLISHED',
        registrationDeadlineAt: new Date(night.startsAt.getTime() - 3 * 60 * 60 * 1000),
      },
    })
    note('night', night.title)
  }

  const table = await prisma.gameNight.findFirst({ where: { title: 'Таблица рейтинга' } })
  const sunday = await prisma.gameNight.findFirst({ where: { title: 'Воскресный круг' } })
  const wednesday = await prisma.gameNight.findFirst({ where: { title: 'Среда в NOX' } })
  const decemberClassic = await prisma.gameNight.findFirst({ where: { title: 'Декабрьская классика' } })

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
  await bookNamed(players[5], decemberClassic)
  await bookNamed(players[6], decemberClassic)

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
        note('party', 'Таблица рейтинга ' + number)
      } else skipped.push('party Таблица рейтинга ' + number)
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
      content: 'Таблица рейтинга собрана: впереди Серафима, за ней плотная группа игроков.',
      comments: [
        [0, 'До следующей таблицы не прощаемся.'],
        [1, 'Красивый стол был.'],
        [2, 'Шериф в третьей партии решил игру.'],
      ],
      likes: [0, 1, 2, 3],
    },
    {
      title: 'Набор на декабрьский стол',
      content: '19 декабря клубный вечер. Мест немного.',
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
    [0, 'Вас ждут на таблице рейтинга', false],
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
