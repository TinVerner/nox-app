import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { ensureAutumn } from './season.js'

const prisma = new PrismaClient()

try {
  await ensureAutumn(prisma)
} finally {
  await prisma.$disconnect()
}
