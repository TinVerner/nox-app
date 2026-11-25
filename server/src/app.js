import express from 'express'
import cors from 'cors'
import { sessionMiddleware } from './modules/auth/session.js'
import authRoutes from './modules/auth/routes.js'
import usersRoutes from './modules/users/routes.js'
import newsRoutes from './modules/news/routes.js'
import gameNightRoutes from './modules/game-nights/routes.js'
import bookingRoutes from './modules/bookings/routes.js'
import resultRoutes from './modules/results/routes.js'
import pointRuleRoutes from './modules/point-rules/routes.js'
import ratingRoutes from './modules/rating/routes.js'
import memberRoutes from './modules/members/routes.js'
import notificationRoutes from './modules/notifications/routes.js'
import excelRoutes from './modules/excel/routes.js'

export function createApp() {
  const app = express()
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:8081', 'http://localhost:8081'],
    credentials: true,
  }))
  app.use(express.json())
  app.use(sessionMiddleware)
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'NOX API hello' })
  })
  app.use('/api', authRoutes)
  app.use('/api', usersRoutes)
  app.use('/api', newsRoutes)
  app.use('/api', gameNightRoutes)
  app.use('/api', bookingRoutes)
  app.use('/api', resultRoutes)
  app.use('/api', pointRuleRoutes)
  app.use('/api', ratingRoutes)
  app.use('/api', memberRoutes)
  app.use('/api', notificationRoutes)
  app.use('/api', excelRoutes)
  return app
}
