// backend/src/routes/common-recipe.ts
import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { CommonRecipeItem } from '../types'

export const commonRecipeRouter = Router()

commonRecipeRouter.use(requireAuth)

commonRecipeRouter.get('/', async (_req, res) => {
  const result = await query<CommonRecipeItem>(
    `SELECT cri.id, cri.ingredient_id, i.name AS ingredient_name, i.unit,
            ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
     FROM common_recipe_items cri
     JOIN ingredients i ON i.id = cri.ingredient_id
     ORDER BY i.name`
  )
  res.json(result.rows)
})

commonRecipeRouter.put('/', async (req, res) => {
  const items = req.body as { ingredient_id: string; quantity_per_budin: number }[]
  await query('DELETE FROM common_recipe_items')
  if (items.length > 0) {
    const values = items.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
    const params = items.flatMap(item => [item.ingredient_id, item.quantity_per_budin])
    await query(
      `INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin) VALUES ${values}`,
      params
    )
  }
  const result = await query<CommonRecipeItem>(
    `SELECT cri.id, cri.ingredient_id, i.name AS ingredient_name, i.unit,
            ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
     FROM common_recipe_items cri
     JOIN ingredients i ON i.id = cri.ingredient_id
     ORDER BY i.name`
  )
  res.json(result.rows)
})
