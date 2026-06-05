// backend/src/routes/common-recipe.ts
import { Router } from 'express'
import { query, withTransaction } from '../db/client'
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

  // Dedupe by (ingredient_id, applies_to) — the table's unique constraint would
  // otherwise abort the INSERT after the DELETE already wiped the whole table.
  const byKey = new Map<string, { ingredient_id: string; quantity_per_budin: number; applies_to: string }>()
  for (const item of items) byKey.set(`${item.ingredient_id}|${item.applies_to}`, item)
  const deduped = [...byKey.values()]

  // DELETE + INSERT in one transaction so a failed INSERT can never leave the
  // common recipe empty.
  await withTransaction(async (q) => {
    await q('DELETE FROM common_recipe_items')
    if (deduped.length > 0) {
      const values = deduped.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
      const params = deduped.flatMap(item => [item.ingredient_id, item.quantity_per_budin, item.applies_to])
      await q(
        `INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to) VALUES ${values}`,
        params
      )
    }
  })
  const result = await query<CommonRecipeItem>(SELECT_COMMON)
  res.json(result.rows)
})
