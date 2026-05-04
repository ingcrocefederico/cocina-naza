import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Flavor } from '../types'

export const flavorsRouter = Router()

flavorsRouter.use(requireAuth)

flavorsRouter.get('/', async (_req, res) => {
  const result = await query<Flavor>(
    `WITH effective_recipe AS (
       SELECT ri.flavor_id, ri.ingredient_id, ri.quantity_per_budin
       FROM recipe_items ri
       JOIN flavors f ON f.id = ri.flavor_id
       WHERE f.active = true AND f.uses_common_ingredients = false

       UNION ALL

       SELECT f.id AS flavor_id,
              cri.ingredient_id,
              COALESCE(ri.quantity_per_budin, cri.quantity_per_budin) AS quantity_per_budin
       FROM flavors f
       CROSS JOIN common_recipe_items cri
       LEFT JOIN recipe_items ri ON ri.flavor_id = f.id AND ri.ingredient_id = cri.ingredient_id
       WHERE f.active = true AND f.uses_common_ingredients = true

       UNION ALL

       SELECT ri.flavor_id, ri.ingredient_id, ri.quantity_per_budin
       FROM recipe_items ri
       JOIN flavors f ON f.id = ri.flavor_id
       WHERE f.active = true AND f.uses_common_ingredients = true
         AND ri.ingredient_id NOT IN (SELECT ingredient_id FROM common_recipe_items)
     )
     SELECT
       f.id,
       f.name,
       f.emoji,
       f.price_per_budin,
       f.active,
       f.created_at,
       f.preparation,
       f.uses_common_ingredients,
       COALESCE(SUM(er.quantity_per_budin * i.price_per_unit), 0) AS cost_per_budin,
       f.price_per_budin - COALESCE(SUM(er.quantity_per_budin * i.price_per_unit), 0) AS profit_per_budin
     FROM flavors f
     LEFT JOIN effective_recipe er ON er.flavor_id = f.id
     LEFT JOIN ingredients i ON i.id = er.ingredient_id
     WHERE f.active = true
     GROUP BY f.id, f.name, f.emoji, f.price_per_budin, f.active, f.created_at, f.preparation, f.uses_common_ingredients
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
  const { name, emoji, price_per_budin, active, uses_common_ingredients } = req.body as Partial<Flavor> & { uses_common_ingredients?: boolean }
  const result = await query<Flavor>(
    `UPDATE flavors SET
       name                    = COALESCE($1, name),
       emoji                   = COALESCE($2, emoji),
       price_per_budin         = COALESCE($3, price_per_budin),
       active                  = COALESCE($4, active),
       uses_common_ingredients = COALESCE($5, uses_common_ingredients)
     WHERE id = $6 RETURNING *`,
    [name ?? null, emoji ?? null, price_per_budin ?? null, active ?? null, uses_common_ingredients ?? null, req.params.id]
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
  const flavorRes = await query<{ uses_common_ingredients: boolean }>(
    'SELECT uses_common_ingredients FROM flavors WHERE id = $1',
    [req.params.id]
  )
  if (!flavorRes.rows.length) {
    res.status(404).json({ error: 'Flavor not found' })
    return
  }
  const usesCommon = flavorRes.rows[0].uses_common_ingredients

  if (!usesCommon) {
    const result = await query<{
      id: string; ingredient_id: string; ingredient_name: string
      unit: string; quantity_per_budin: number; price_per_unit: string
      is_common: boolean; is_overridden: boolean
    }>(
      `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(ri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit,
              false AS is_common, false AS is_overridden
       FROM recipe_items ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.flavor_id = $1
       ORDER BY i.name`,
      [req.params.id]
    )
    res.json(result.rows)
    return
  }

  const [commonRes, recipeRes] = await Promise.all([
    query<{ ingredient_id: string; ingredient_name: string; unit: string; quantity_per_budin: number; price_per_unit: string }>(
      `SELECT cri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
       FROM common_recipe_items cri
       JOIN ingredients i ON i.id = cri.ingredient_id
       ORDER BY i.name`
    ),
    query<{ id: string; ingredient_id: string; ingredient_name: string; unit: string; quantity_per_budin: number; price_per_unit: string }>(
      `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(ri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
       FROM recipe_items ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.flavor_id = $1
       ORDER BY i.name`,
      [req.params.id]
    ),
  ])

  const overrideMap = new Map(recipeRes.rows.map(r => [r.ingredient_id, r]))
  const commonIngredientIds = new Set(commonRes.rows.map(r => r.ingredient_id))

  const commonItems = commonRes.rows.map(c => {
    const override = overrideMap.get(c.ingredient_id)
    return override
      ? { ...override, is_common: true, is_overridden: true }
      : { ...c, id: null, is_common: true, is_overridden: false }
  })

  const exclusiveItems = recipeRes.rows
    .filter(r => !commonIngredientIds.has(r.ingredient_id))
    .map(r => ({ ...r, is_common: false, is_overridden: false }))

  res.json([...commonItems, ...exclusiveItems])
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
    `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ROUND(ri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.flavor_id = $1
     ORDER BY i.name`,
    [req.params.id]
  )
  res.json(result.rows)
})
