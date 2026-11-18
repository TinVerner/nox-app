import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { ensureAutumn } from './src/modules/seasons/ensure-autumn.js'

const prisma = new PrismaClient()

try {
  await ensureAutumn(prisma)
} finally {
  await prisma.$disconnect()
}
