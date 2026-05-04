# Common Ingredients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ingredients shared by all budines into a `common_recipe_items` table; each budin can inherit them, override individual quantities, and add its own exclusive ingredients.

**Architecture:** New `common_recipe_items` table + `uses_common_ingredients` flag on `flavors`. Backend merge logic in `GET /api/flavors/:id/recipe` and `GET /api/flavors` cost calc. New `GET/PUT /api/common-recipe` endpoints. Frontend shows locked common items in the recipe editor with per-item override (open lock) and a toggle to opt in/out.

**Tech Stack:** PostgreSQL, Express/TypeScript, React + TanStack Query, shadcn/ui, lucide-react, Vitest + supertest

---

## File Map

| Action | Path |
|--------|------|
| Create | `backend/src/db/migrations/004_common_ingredients.sql` |
| Create | `backend/src/routes/common-recipe.ts` |
| Create | `backend/src/routes/common-recipe.test.ts` |
| Create | `frontend/src/hooks/useCommonRecipe.ts` |
| Modify | `backend/src/types.ts` |
| Modify | `backend/src/routes/flavors.ts` |
| Modify | `backend/src/app.ts` |
| Modify | `frontend/src/types.ts` |
| Modify | `frontend/src/hooks/useFlavors.ts` |
| Modify | `frontend/src/pages/Sabores.tsx` |
| Modify | `frontend/src/pages/Ingredientes.tsx` |

---

### Task 1: DB Migration — schema + data

**Files:**
- Create: `backend/src/db/migrations/004_common_ingredients.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 004_common_ingredients.sql

-- Schema changes
CREATE TABLE common_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_budin NUMERIC(10,4) NOT NULL,
  UNIQUE(ingredient_id)
);

ALTER TABLE flavors ADD COLUMN uses_common_ingredients BOOLEAN NOT NULL DEFAULT false;

-- Data migration: auto-detect common ingredients from existing active flavors
-- An ingredient is "common" if it appears in ALL active flavors with the SAME quantity.

WITH flavor_count AS (
  SELECT COUNT(*) AS total FROM flavors WHERE active = true
),
common_candidates AS (
  SELECT
    ri.ingredient_id,
    ri.quantity_per_budin,
    COUNT(DISTINCT ri.flavor_id) AS occurrences
  FROM recipe_items ri
  JOIN flavors f ON f.id = ri.flavor_id AND f.active = true
  GROUP BY ri.ingredient_id, ri.quantity_per_budin
),
detected AS (
  SELECT cc.ingredient_id, cc.quantity_per_budin
  FROM common_candidates cc
  CROSS JOIN flavor_count fc
  WHERE cc.occurrences = fc.total AND fc.total > 0
)
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin)
SELECT ingredient_id, quantity_per_budin FROM detected;

-- Remove those rows from recipe_items for active flavors (they are now in common_recipe_items)
DELETE FROM recipe_items
WHERE ingredient_id IN (SELECT ingredient_id FROM common_recipe_items)
  AND flavor_id IN (SELECT id FROM flavors WHERE active = true);

-- Mark all active flavors as using common ingredients (they all had the common set by definition)
UPDATE flavors SET uses_common_ingredients = true
WHERE active = true
  AND EXISTS (SELECT 1 FROM common_recipe_items);
```

- [ ] **Step 2: Run migration against the database**

```bash
psql $DATABASE_URL -f backend/src/db/migrations/004_common_ingredients.sql
```

Expected: `CREATE TABLE`, `ALTER TABLE`, then INSERT/DELETE/UPDATE without error.

- [ ] **Step 3: Verify**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM common_recipe_items;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM flavors WHERE uses_common_ingredients = true;"
```

Expected: counts match the detected common ingredients and active flavors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/004_common_ingredients.sql
git commit -m "feat: add common_recipe_items table and uses_common_ingredients flag"
```

---

### Task 2: Backend Types

**Files:**
- Modify: `backend/src/types.ts`

- [ ] **Step 1: Update `Flavor` interface and add `CommonRecipeItem`**

In `backend/src/types.ts`, replace the `Flavor` interface and add `CommonRecipeItem`:

```typescript
export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  created_at: string
  cost_per_budin: string
  profit_per_budin: string
  preparation: string | null
  uses_common_ingredients: boolean
}

export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: string
  quantity_per_budin: number
  price_per_unit: string
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types.ts
git commit -m "feat: add CommonRecipeItem type and uses_common_ingredients to Flavor"
```

---

### Task 3: Write Failing Tests for common-recipe Routes

**Files:**
- Create: `backend/src/routes/common-recipe.test.ts`

- [ ] **Step 1: Create test file**

```typescript
// backend/src/routes/common-recipe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { query } from '../db/client'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }))
vi.mock('passport-google-oauth20', () => ({
  Strategy: class {
    name = 'google'
    authenticate(_req: unknown, _options?: unknown) {}
  },
}))

import { createApp } from '../app'

const mockQuery = vi.mocked(query)

describe('GET /api/common-recipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns common recipe items', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 500, price_per_unit: '0.005' },
      ],
    })
    const app = createApp()
    const res = await request(app).get('/api/common-recipe')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].ingredient_name).toBe('Harina')
  })
})

describe('PUT /api/common-recipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces all common recipe items and returns updated list', async () => {
    // DELETE call
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // INSERT call
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // SELECT call (return updated list)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 600, price_per_unit: '0.005' },
      ],
    })
    const app = createApp()
    const res = await request(app)
      .put('/api/common-recipe')
      .send([{ ingredient_id: 'ing-1', quantity_per_budin: 600 }])
    expect(res.status).toBe(200)
    expect(res.body[0].quantity_per_budin).toBe(600)
  })

  it('handles empty items array (clears all common items)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // DELETE
    mockQuery.mockResolvedValueOnce({ rows: [] }) // SELECT
    const app = createApp()
    const res = await request(app).put('/api/common-recipe').send([])
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
cd backend && npm test -- common-recipe
```

Expected: FAIL — `common-recipe` route does not exist yet.

---

### Task 4: Implement `routes/common-recipe.ts`

**Files:**
- Create: `backend/src/routes/common-recipe.ts`

- [ ] **Step 1: Create the route file**

```typescript
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
```

- [ ] **Step 2: Register the route in `app.ts` so tests can find it**

In `backend/src/app.ts`, add after the existing imports:

```typescript
import { commonRecipeRouter } from './routes/common-recipe'
```

And after `app.use('/api/clients', clientsRouter)`:

```typescript
app.use('/api/common-recipe', commonRecipeRouter)
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
cd backend && npm test -- common-recipe
```

Expected: PASS — 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/common-recipe.ts backend/src/routes/common-recipe.test.ts backend/src/app.ts
git commit -m "feat: add GET/PUT /api/common-recipe endpoints and register route"
```

---

### Task 6: Update `routes/flavors.ts` — cost calc, recipe merge, uses_common_ingredients toggle

**Files:**
- Modify: `backend/src/routes/flavors.ts`

- [ ] **Step 1: Replace `GET /` with CTE-based cost calculation**

Replace the entire `flavorsRouter.get('/', ...)` handler with:

```typescript
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
```

- [ ] **Step 2: Replace `PUT /:id` to handle `uses_common_ingredients`**

Replace the entire `flavorsRouter.put('/:id', ...)` handler with:

```typescript
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
```

- [ ] **Step 3: Replace `GET /:id/recipe` with merge logic**

Replace the entire `flavorsRouter.get('/:id/recipe', ...)` handler with:

```typescript
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
      : { id: null, ...c, is_common: true, is_overridden: false }
  })

  const exclusiveItems = recipeRes.rows
    .filter(r => !commonIngredientIds.has(r.ingredient_id))
    .map(r => ({ ...r, is_common: false, is_overridden: false }))

  res.json([...commonItems, ...exclusiveItems])
})
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/flavors.ts
git commit -m "feat: update flavor routes for common ingredients merge and cost calc"
```

---

### Task 7: Frontend Types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Update `Flavor`, `RecipeItem`, add `CommonRecipeItem`**

In `frontend/src/types.ts`:

Replace the `Flavor` interface:
```typescript
export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  cost_per_budin: string
  profit_per_budin: string
  preparation: string | null
  uses_common_ingredients: boolean
}
```

Replace the `RecipeItem` interface:
```typescript
export interface RecipeItem {
  id: string | null
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
  is_common: boolean
  is_overridden: boolean
}
```

Add after `RecipeItem`:
```typescript
export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: update frontend types for common ingredients"
```

---

### Task 8: Frontend Hooks

**Files:**
- Create: `frontend/src/hooks/useCommonRecipe.ts`
- Modify: `frontend/src/hooks/useFlavors.ts`

- [ ] **Step 1: Create `useCommonRecipe.ts`**

```typescript
// frontend/src/hooks/useCommonRecipe.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { CommonRecipeItem } from '../types'

export function useCommonRecipe() {
  return useQuery<CommonRecipeItem[]>({
    queryKey: ['common-recipe'],
    queryFn: async () => (await api.get('/api/common-recipe')).data,
  })
}

export function useSaveCommonRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { ingredient_id: string; quantity_per_budin: number }[]) =>
      api.put('/api/common-recipe', items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['common-recipe'] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['flavor-recipe'] })
      toast.success('Ingredientes comunes guardados')
    },
    onError: () => toast.error('Error al guardar los ingredientes comunes'),
  })
}
```

- [ ] **Step 2: Update `useUpdateFlavor` in `useFlavors.ts` to also invalidate flavor-recipe cache**

In `frontend/src/hooks/useFlavors.ts`, replace the `useUpdateFlavor` function:

```typescript
export function useUpdateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Flavor> & { id: string }) =>
      api.put(`/api/flavors/${id}`, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['flavor-recipe', id] })
      toast.success('Sabor actualizado')
    },
    onError: () => toast.error('Error al actualizar el sabor'),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useCommonRecipe.ts frontend/src/hooks/useFlavors.ts
git commit -m "feat: add useCommonRecipe hook and fix useUpdateFlavor cache invalidation"
```

---

### Task 9: Frontend — Sabores.tsx common ingredients UI

**Files:**
- Modify: `frontend/src/pages/Sabores.tsx`

- [ ] **Step 1: Update imports**

At the top of `frontend/src/pages/Sabores.tsx`, update the lucide-react import to include `Lock` and `LockOpen`:

```typescript
import { Trash2, Plus, ChefHat, Lock, LockOpen } from 'lucide-react'
```

- [ ] **Step 2: Add `CommonItemState` interface and update `RecipeRow`**

After the existing `RecipeRow` interface definition, add:

```typescript
interface CommonItemState {
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  override_quantity: string
  is_overridden: boolean
}
```

Also add `Unit` to the import from `'../types'`:
```typescript
import type { Flavor, RecipeItem, Unit } from '../types'
```

- [ ] **Step 3: Add state for common items in the `Sabores` component**

Inside the `Sabores` function, after `const [rows, setRows] = useState<RecipeRow[]>([])`, add:

```typescript
const [commonItems, setCommonItems] = useState<CommonItemState[]>([])
```

- [ ] **Step 4: Update the `useEffect` that loads the existing recipe**

Replace the existing `useEffect` that depends on `existingRecipe`:

```typescript
useEffect(() => {
  if (existingRecipe) {
    setCommonItems(
      existingRecipe
        .filter((r: RecipeItem) => r.is_common)
        .map((r: RecipeItem) => ({
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          unit: r.unit,
          quantity_per_budin: r.quantity_per_budin,
          override_quantity: r.is_overridden ? String(Math.round(Number(r.quantity_per_budin))) : '',
          is_overridden: r.is_overridden,
        }))
    )
    setRows(
      existingRecipe
        .filter((r: RecipeItem) => !r.is_common)
        .map((r: RecipeItem) => ({
          key: rowKey++,
          ingredient_id: r.ingredient_id,
          quantity_per_budin: String(Math.round(Number(r.quantity_per_budin))),
        }))
    )
  }
}, [existingRecipe])
```

- [ ] **Step 5: Add helper functions for common item overrides**

After `function updateRow(...)`, add:

```typescript
function unlockCommon(ingredient_id: string) {
  setCommonItems(items =>
    items.map(item =>
      item.ingredient_id === ingredient_id
        ? { ...item, is_overridden: true, override_quantity: String(item.quantity_per_budin) }
        : item
    )
  )
}

function lockCommon(ingredient_id: string) {
  setCommonItems(items =>
    items.map(item =>
      item.ingredient_id === ingredient_id
        ? { ...item, is_overridden: false, override_quantity: '' }
        : item
    )
  )
}

function updateCommonOverride(ingredient_id: string, value: string) {
  setCommonItems(items =>
    items.map(item =>
      item.ingredient_id === ingredient_id
        ? { ...item, override_quantity: value.replace(/[^0-9]/g, '') }
        : item
    )
  )
}
```

- [ ] **Step 6: Update `handleSave` to include overrides in the recipe payload**

Replace the existing `handleSave` function:

```typescript
async function handleSave() {
  const overrideItems = commonItems
    .filter(c => c.is_overridden && c.override_quantity)
    .map(c => ({ ingredient_id: c.ingredient_id, quantity_per_budin: parseFloat(c.override_quantity) }))

  const exclusiveItems = rows
    .filter(r => r.ingredient_id && r.quantity_per_budin)
    .map(r => ({ ingredient_id: r.ingredient_id, quantity_per_budin: parseFloat(r.quantity_per_budin) }))

  const recipeItems = [...overrideItems, ...exclusiveItems]

  if (editing) {
    await updateFlavor.mutateAsync({ id: editing.id, ...form })
    await saveRecipe.mutateAsync({ id: editing.id, items: recipeItems })
  } else {
    const res = await createFlavor.mutateAsync(form)
    const newId: string = res.data.id
    if (recipeItems.length > 0) {
      await saveRecipe.mutateAsync({ id: newId, items: recipeItems })
    }
  }
  setOpen(false)
}
```

- [ ] **Step 7: Add toggle handler for `uses_common_ingredients`**

After `handleSave`, add:

```typescript
async function handleToggleCommon(value: boolean) {
  if (!editing) return
  await updateFlavor.mutateAsync({ id: editing.id, uses_common_ingredients: value })
  if (!value) setCommonItems([])
}
```

- [ ] **Step 8: Add common ingredients section to the recipe editor in the Sheet**

Inside the Sheet content, find the `<div className="space-y-3">` that contains the recipe section. Replace it with:

```tsx
<div className="space-y-3">
  {editing && (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-semibold text-foreground">Ingredientes comunes</Label>
      <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={editing.uses_common_ingredients}
          onChange={e => handleToggleCommon(e.target.checked)}
          className="cursor-pointer"
        />
        Usar comunes
      </label>
    </div>
  )}

  {editing?.uses_common_ingredients && commonItems.length > 0 && (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
      {commonItems.map(item => (
        <div key={item.ingredient_id} className="flex items-center gap-2">
          <span className="flex-1 min-w-0 text-sm text-foreground truncate">{item.ingredient_name}</span>
          {item.is_overridden ? (
            <Input
              type="text"
              inputMode="numeric"
              className="w-20 shrink-0"
              value={item.override_quantity}
              onChange={e => updateCommonOverride(item.ingredient_id, e.target.value)}
            />
          ) : (
            <span className="w-20 shrink-0 text-sm text-muted-foreground text-right tabular-nums">
              {item.quantity_per_budin}
            </span>
          )}
          <Badge variant="secondary" className="w-10 justify-center shrink-0 text-xs">
            {item.unit === 'unidad' ? 'uni' : item.unit}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer shrink-0"
            onClick={() => item.is_overridden ? lockCommon(item.ingredient_id) : unlockCommon(item.ingredient_id)}
          >
            {item.is_overridden
              ? <LockOpen className="w-3.5 h-3.5 text-amber-500" />
              : <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </Button>
        </div>
      ))}
    </div>
  )}

  <Separator />

  <div className="flex items-center justify-between">
    <Label className="text-sm font-semibold text-foreground">
      {editing?.uses_common_ingredients ? 'Ingredientes propios' : 'Receta'}
    </Label>
    <Button variant="outline" size="sm" className="cursor-pointer" onClick={addRow}>
      <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
    </Button>
  </div>

  {rows.length === 0 && (
    <p className="text-sm text-muted-foreground text-center py-4">
      Sin ingredientes. Agregá uno con el botón.
    </p>
  )}

  {rows.map(row => (
    <IngredientRow
      key={row.key}
      row={row}
      onUpdate={updateRow}
      onRemove={removeRow}
      isActive={activeRowKey === row.key}
      onActivate={() => setActiveRowKey(k => k === row.key ? null : row.key)}
    />
  ))}
</div>
```

- [ ] **Step 9: Run the dev server and manually test the recipe editor**

```bash
cd frontend && npm run dev
```

Open the browser at `http://localhost:5173`. Navigate to Sabores, open a budin, verify:
- Common ingredients section appears with lock icons
- Clicking a lock unlocks it (amber lock icon, editable input appears)
- Clicking the open lock re-locks it (restores to read-only)
- "Usar comunes" checkbox toggle works
- Saving a budin with an override saves correctly

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Sabores.tsx
git commit -m "feat: add common ingredients section with lock/override UI to Sabores"
```

---

### Task 10: Frontend — Ingredientes.tsx common recipe management section

**Files:**
- Modify: `frontend/src/pages/Ingredientes.tsx`

- [ ] **Step 1: Add imports**

In `frontend/src/pages/Ingredientes.tsx`, add to the existing imports:

```typescript
import { useCommonRecipe, useSaveCommonRecipe } from '../hooks/useCommonRecipe'
import { IngredientCombobox } from '@/components/IngredientCombobox'
import { Badge } from '@/components/ui/badge'
import type { CommonRecipeItem } from '../types'
```

And add `Lock` to the lucide-react import:
```typescript
import { Calculator, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Add state for the common recipe editor sheet**

Before the `Ingredientes` function (module level, same pattern as `rowKey` in Sabores.tsx), add:

```typescript
interface CommonEditRow { key: number; ingredient_id: string; quantity_per_budin: string }
let commonRowKey = 0
```

Inside the `Ingredientes` function, after the existing state declarations, add:

```typescript
const { data: commonRecipe = [] } = useCommonRecipe()
const saveCommonRecipe = useSaveCommonRecipe()
const [commonSheetOpen, setCommonSheetOpen] = useState(false)
const [commonRows, setCommonRows] = useState<CommonEditRow[]>([])

function openCommonEditor() {
  setCommonRows(commonRecipe.map((r: CommonRecipeItem) => ({
    key: commonRowKey++,
    ingredient_id: r.ingredient_id,
    quantity_per_budin: String(r.quantity_per_budin),
  })))
  setCommonSheetOpen(true)
}

function addCommonRow() {
  setCommonRows(r => [...r, { key: commonRowKey++, ingredient_id: '', quantity_per_budin: '' }])
}

function removeCommonRow(key: number) {
  setCommonRows(r => r.filter(row => row.key !== key))
}

function updateCommonRow(key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) {
  setCommonRows(r => r.map(row => row.key === key ? { ...row, [field]: value } : row))
}

async function saveCommon() {
  const items = commonRows
    .filter(r => r.ingredient_id && r.quantity_per_budin)
    .map(r => ({ ingredient_id: r.ingredient_id, quantity_per_budin: parseFloat(r.quantity_per_budin) }))
  await saveCommonRecipe.mutateAsync(items)
  setCommonSheetOpen(false)
}
```

- [ ] **Step 3: Add the common recipe section to the JSX**

In the return statement of `Ingredientes`, add this block right before the existing search bar or at the top of the page content (before the `<div className="flex items-center gap-2">` search row):

```tsx
{/* Ingredientes comunes de budines */}
<div className="rounded-lg border border-border p-4 space-y-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Lock className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold text-foreground">Ingredientes comunes de budines</h2>
    </div>
    <Button variant="outline" size="sm" className="cursor-pointer" onClick={openCommonEditor}>
      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
    </Button>
  </div>
  {commonRecipe.length === 0 ? (
    <p className="text-sm text-muted-foreground">Sin ingredientes comunes definidos.</p>
  ) : (
    <div className="space-y-1">
      {commonRecipe.map(item => (
        <div key={item.ingredient_id} className="flex items-center justify-between text-sm">
          <span className="text-foreground">{item.ingredient_name}</span>
          <span className="text-muted-foreground tabular-nums">
            {item.quantity_per_budin} {item.unit === 'unidad' ? 'uni' : item.unit}
          </span>
        </div>
      ))}
    </div>
  )}
</div>

{/* Sheet editor for common recipe */}
<Sheet open={commonSheetOpen} onOpenChange={setCommonSheetOpen}>
  <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
    <SheetHeader className="px-6 pt-6 pb-4">
      <SheetTitle>Ingredientes comunes de budines</SheetTitle>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Estos ingredientes se comparten en todos los budines que usen la receta común. Editarlos afecta a todos.
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Ingredientes</span>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={addCommonRow}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
        </Button>
      </div>
      {commonRows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Sin ingredientes. Agregá uno.</p>
      )}
      {commonRows.map(row => {
        const ing = ingredients.find(i => i.id === row.ingredient_id)
        return (
          <div key={row.key} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <IngredientCombobox
                value={row.ingredient_id}
                onChange={id => updateCommonRow(row.key, 'ingredient_id', id)}
                allowCreate
              />
            </div>
            <Input
              type="text"
              inputMode="numeric"
              className="w-20 shrink-0"
              placeholder="0"
              value={row.quantity_per_budin}
              onChange={e => updateCommonRow(row.key, 'quantity_per_budin', e.target.value.replace(/[^0-9]/g, ''))}
            />
            {ing && (
              <Badge variant="secondary" className="w-10 justify-center shrink-0 text-xs">
                {ing.unit === 'unidad' ? 'uni' : ing.unit}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={() => removeCommonRow(row.key)}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        )
      })}
    </div>
    <SheetFooter className="gap-2 px-6 py-4 border-t border-border">
      <Button variant="outline" className="cursor-pointer" onClick={() => setCommonSheetOpen(false)}>Cancelar</Button>
      <Button className="cursor-pointer" onClick={saveCommon} disabled={saveCommonRecipe.isPending}>
        {saveCommonRecipe.isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

- [ ] **Step 4: Add `SheetFooter` to the Ingredientes imports (if not already imported)**

Check `frontend/src/pages/Ingredientes.tsx` imports for `SheetFooter`. If missing, update the Sheet import line to include it:

```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
```

- [ ] **Step 5: Run the dev server and manually test**

```bash
cd frontend && npm run dev
```

Open Ingredientes page. Verify:
- "Ingredientes comunes de budines" section visible at top
- "Editar" opens a sheet with the current common recipe items
- Can add/remove/edit items
- Saving updates the list and triggers a refetch in Sabores

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Ingredientes.tsx frontend/src/hooks/useCommonRecipe.ts
git commit -m "feat: add common recipe management section to Ingredientes page"
```

---

### Task 11: Final E2E Smoke Test

- [ ] **Step 1: Run backend tests one last time**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Build frontend to check for TypeScript errors**

```bash
cd frontend && npm run build
```

Expected: build completes without type errors.

- [ ] **Step 3: Manual walkthrough**

1. Go to Ingredientes → verify common ingredients section shows detected common items
2. Click "Editar" → modify a quantity → save → verify change reflected
3. Go to Sabores → open a budin with `uses_common_ingredients = true`
4. Verify locked common section shows updated quantity
5. Click a lock icon → input appears with current value → change it → save
6. Re-open the same budin → overridden ingredient shows open lock with custom value
7. Click open lock → reverts to common value
8. Uncheck "Usar comunes" → common section disappears
9. Re-check → common section re-appears (overrides preserved)
10. Create a new budin → no common section by default → works as before
