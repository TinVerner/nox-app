import { Router } from 'express'
import multer from 'multer'
import { meOrNull } from '../auth/session.js'
import { buildClubWorkbook, importClubWorkbook } from './workbook.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

async function requireAdmin(req, res) {
  const me = await meOrNull(req)
  if (!me || me.role !== 'ADMIN') {
    res.status(403).json({ error: 'только админ' })
    return null
  }
  return me
}

router.get('/excel/export', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return
    const buffer = await buildClubWorkbook()
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader('Content-Disposition', `attachment; filename="nox-club-${stamp}.xlsx"`)
    res.send(Buffer.from(buffer))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'не вышло выгрузить' })
  }
})

router.post('/excel/import', upload.single('file'), async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'нужен файл .xlsx' })
    }
    const name = String(req.file.originalname || '').toLowerCase()
    if (!name.endsWith('.xlsx')) {
      return res.status(400).json({ error: 'только .xlsx' })
    }
    const summary = await importClubWorkbook(req.file.buffer)
    res.json(summary)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'не вышло загрузить' })
  }
})

export default router
