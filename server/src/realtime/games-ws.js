import { WebSocketServer } from 'ws'

let sockets = null

export function attachGamesWs(server) {
  sockets = new WebSocketServer({ server, path: '/ws' })
}

// Плашка на клиенте сама гаснет через несколько секунд, здесь только текст события.
export function broadcastGames(notice = 'Запись на вечер изменилась') {
  if (!sockets) return
  const payload = JSON.stringify({ type: 'games', notice })
  for (const client of sockets.clients) {
    if (client.readyState === 1) client.send(payload)
  }
}
