import { prisma } from '../../shared/prisma.js'
import { broadcastGames } from '../../realtime/games-ws.js'

function nightLabel(night) {
  const title = night?.title || 'вечер'
  if (!night?.startsAt) return title
  const when = new Date(night.startsAt).toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${title} (${when})`
}

export async function notifyHost(night, message) {
  if (!night?.hostId) return
  await prisma.notification.create({
    data: {
      userId: night.hostId,
      notificationType: 'BOOKING',
      message,
      targetPath: '/games',
    },
  })
  broadcastGames(message)
}

export function bookingMessage(action, nick, night) {
  const who = nick || 'Игрок'
  const label = nightLabel(night)
  if (action === 'cancel') return `${who} отменил(а) запись на «${label}»`
  if (action === 'wait') return `${who} встал(а) в лист ожидания на «${label}»`
  return `${who} записался(ась) на «${label}»`
}
