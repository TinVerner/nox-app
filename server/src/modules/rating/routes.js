import { Router } from 'express'
import { ratingList } from './list.js'

const router = Router()

router.get('/rating', async (req, res) => {
  res.json(await ratingList())
})

export default router
