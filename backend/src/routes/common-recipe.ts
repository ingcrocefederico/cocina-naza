// backend/src/routes/common-recipe.ts
import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { CommonRecipeItem } from '../types'

export const commonRecipeRouter = Router()

commonRecipeRouter.use(requireAuth)

const SELECT_COMMON = `
  SELECT cri.id, cri.ingredient_id, i.name AS ingredient_name, i.unit,
         ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin,
         i.price_per_unit, cri.applies_to
  FROM common_recipe_items cri
  JOIN ingredients i ON i.id = cri.ingredient_id
  ORDER BY cri.applies_to, i.name`

commonRecipeRouter.get('/', async (_req, res) => {
  const result = await query<CommonRecipeItem>(SELECT_COMMON)
  res.json(result.rows)
})

commonRecipeRouter.put('/', async (req, res) => {
  const items = req.body as { ingredient_id: string; quantity_per_budin: number; applies_to: string }[]
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'body must be an array' })
    return
  }
  const valid = new Set(['all', 'integral'])
  if (items.some(item => !valid.has(item.applies_to))) {
    res.status(400).json({ error: 'applies_to must be "all" or "integral"' })
    return
  }
  await query('DELETE FROM common_recipe_items')
  if (items.length > 0) {
    const values = items.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
    const params = items.flatMap(item => [item.ingredient_id, item.quantity_per_budin, item.applies_to])
    await query(
      `INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to) VALUES ${values}`,
      params
    )
  }
  const result = await query<CommonRecipeItem>(SELECT_COMMON)
  res.json(result.rows)
})
