import { prisma } from '../../shared/prisma.js'
import { broadcastGames } from '../../realtime/games-ws.js'

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
