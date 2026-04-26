import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Flavor } from '../types'

export const flavorsRouter = Router()

flavorsRouter.use(requireAuth)

flavorsRouter.get('/', async (_req, res) => {
  const result = await query<Flavor>(
    'SELECT * FROM flavors WHERE active = true ORDER BY name'
  )
  res.json(result.rows)
})

flavorsRouter.post('/', async (req, res) => {
  const { name, emoji = '', price_per_budin = 0 } = req.body as Partial<Flavor> & { price_per_budin?: number }
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  const result = await query<Flavor>(
    'INSERT INTO flavors (name, emoji, price_per_budin) VALUES ($1, $2, $3) RETURNING *',
    [name, emoji, price_per_budin]
  )
  res.status(201).json(result.rows[0])
})

flavorsRouter.put('/:id', async (req, res) => {
  const { name, emoji, price_per_budin, active } = req.body as Partial<Flavor>
  const result = await query<Flavor>(
    `UPDATE flavors SET
       name            = COALESCE($1, name),
       emoji           = COALESCE($2, emoji),
       price_per_budin = COALESCE($3, price_per_budin),
       active          = COALESCE($4, active)
     WHERE id = $5 RETURNING *`,
    [name ?? null, emoji ?? null, price_per_budin ?? null, active ?? null, req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Flavor not found' })
    return
  }
  res.json(result.rows[0])
})

flavorsRouter.delete('/:id', async (req, res) => {
  await query('UPDATE flavors SET active = false WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})
