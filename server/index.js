import 'dotenv/config'
import http from 'http'

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('Не задан SESSION_SECRET')
}

const { createApp } = await import('./src/app.js')
const { attachGamesWs } = await import('./src/realtime/games-ws.js')

const app = createApp()
const server = http.createServer(app)
attachGamesWs(server)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`NOX API http://localhost:${PORT}`)
})
