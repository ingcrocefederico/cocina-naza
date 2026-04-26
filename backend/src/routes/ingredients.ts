import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Ingredient } from '../types'

export const ingredientsRouter = Router()

ingredientsRouter.use(requireAuth)

// IMPORTANT: /calculator must be registered before /:id
ingredientsRouter.get('/calculator', async (req, res) => {
  const { date } = req.query
  if (!date) {
    res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    return
  }

  const totalsRes = await query<{ id: string; name: string; unit: string; price_per_unit: string; total_quantity: string }>(
    `SELECT i.id, i.name, i.unit, i.price_per_unit,
            SUM(oi.quantity * ri.quantity_per_budin) AS total_quantity
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN recipe_items ri ON ri.flavor_id = oi.flavor_id
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE o.date = $1
     GROUP BY i.id, i.name, i.unit, i.price_per_unit
     ORDER BY i.name`,
    [date as string]
  )

  const byFlavorRes = await query<{ flavor_id: string; flavor_name: string; budin_count: string; ingredient_id: string; ingredient_name: string; unit: string; total_quantity: string }>(
    `SELECT f.id AS flavor_id, f.name AS flavor_name,
            SUM(oi.quantity) AS budin_count,
            i.id AS ingredient_id, i.name AS ingredient_name, i.unit,
            SUM(oi.quantity * ri.quantity_per_budin) AS total_quantity
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN flavors f ON f.id = oi.flavor_id
     JOIN recipe_items ri ON ri.flavor_id = oi.flavor_id
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE o.date = $1
     GROUP BY f.id, f.name, i.id, i.name, i.unit
     ORDER BY f.name, i.name`,
    [date as string]
  )

  const financialsRes = await query<{ total_sales: string }>(
    `SELECT COALESCE(SUM(sale_price), 0) AS total_sales FROM orders WHERE date = $1`,
    [date as string]
  )

  const totals = totalsRes.rows.map(r => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    totalQuantity: parseFloat(r.total_quantity),
    pricePerUnit: parseFloat(r.price_per_unit),
    totalCost: parseFloat(r.total_quantity) * parseFloat(r.price_per_unit),
  }))

  const totalCost = totals.reduce((sum, t) => sum + t.totalCost, 0)
  const totalSales = parseFloat(financialsRes.rows[0].total_sales)

  const flavorMap = new Map<string, { flavorId: string; flavorName: string; budinCount: number; ingredients: { id: string; name: string; unit: string; totalQuantity: number }[] }>()
  for (const row of byFlavorRes.rows) {
    if (!flavorMap.has(row.flavor_id)) {
      flavorMap.set(row.flavor_id, {
        flavorId: row.flavor_id,
        flavorName: row.flavor_name,
        budinCount: parseInt(row.budin_count),
        ingredients: [],
      })
    }
    flavorMap.get(row.flavor_id)!.ingredients.push({
      id: row.ingredient_id,
      name: row.ingredient_name,
      unit: row.unit,
      totalQuantity: parseFloat(row.total_quantity),
    })
  }

  res.json({
    totals,
    byFlavor: Array.from(flavorMap.values()),
    financials: { totalCost, totalSales, profit: totalSales - totalCost },
  })
})

ingredientsRouter.get('/', async (_req, res) => {
  const result = await query<Ingredient>('SELECT * FROM ingredients ORDER BY name')
  res.json(result.rows)
})

ingredientsRouter.post('/', async (req, res) => {
  const { name, unit, price_per_unit = 0 } = req.body as Partial<Ingredient> & { price_per_unit?: number }
  if (!name || !unit) {
    res.status(400).json({ error: 'name and unit are required' })
    return
  }
  const result = await query<Ingredient>(
    'INSERT INTO ingredients (name, unit, price_per_unit) VALUES ($1, $2, $3) RETURNING *',
    [name, unit, price_per_unit]
  )
  res.status(201).json(result.rows[0])
})

ingredientsRouter.put('/:id', async (req, res) => {
  const { name, unit, price_per_unit } = req.body as Partial<Ingredient>
  const result = await query<Ingredient>(
    `UPDATE ingredients SET
       name           = COALESCE($1, name),
       unit           = COALESCE($2, unit),
       price_per_unit = COALESCE($3, price_per_unit),
       updated_at     = now()
     WHERE id = $4 RETURNING *`,
    [name ?? null, unit ?? null, price_per_unit ?? null, req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Ingredient not found' })
    return
  }
  res.json(result.rows[0])
})

ingredientsRouter.delete('/:id', async (req, res) => {
  const result = await query<Ingredient>(
    'DELETE FROM ingredients WHERE id = $1 RETURNING *',
    [req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Ingredient not found' })
    return
  }
  res.json(result.rows[0])
})
