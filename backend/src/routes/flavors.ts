import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Flavor } from '../types'

export const flavorsRouter = Router()

flavorsRouter.use(requireAuth)

flavorsRouter.get('/', async (_req, res) => {
  const result = await query<Flavor>(
    `SELECT
       f.id,
       f.name,
       f.emoji,
       f.price_per_budin,
       f.active,
       f.created_at,
       COALESCE(SUM(ri.quantity_per_budin * i.price_per_unit), 0) AS cost_per_budin,
       f.price_per_budin - COALESCE(SUM(ri.quantity_per_budin * i.price_per_unit), 0) AS profit_per_budin
     FROM flavors f
     LEFT JOIN recipe_items ri ON ri.flavor_id = f.id
     LEFT JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE f.active = true
     GROUP BY f.id, f.name, f.emoji, f.price_per_budin, f.active, f.created_at
     ORDER BY f.name`
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

flavorsRouter.get('/:id/recipe', async (req, res) => {
  const result = await query<{
    id: string
    ingredient_id: string
    ingredient_name: string
    unit: string
    quantity_per_budin: number
  }>(
    `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ri.quantity_per_budin
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.flavor_id = $1
     ORDER BY i.name`,
    [req.params.id]
  )
  res.json(result.rows)
})

flavorsRouter.put('/:id/recipe', async (req, res) => {
  const items = req.body as { ingredient_id: string; quantity_per_budin: number }[]
  await query('DELETE FROM recipe_items WHERE flavor_id = $1', [req.params.id])
  if (items.length > 0) {
    const values = items.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
    const params = items.flatMap(item => [req.params.id, item.ingredient_id, item.quantity_per_budin])
    await query(
      `INSERT INTO recipe_items (flavor_id, ingredient_id, quantity_per_budin) VALUES ${values}`,
      params
    )
  }
  const result = await query(
    `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ri.quantity_per_budin
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.flavor_id = $1
     ORDER BY i.name`,
    [req.params.id]
  )
  res.json(result.rows)
})
