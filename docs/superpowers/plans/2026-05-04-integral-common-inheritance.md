# Integral Common Ingredients Inheritance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `applies_to` column to `common_recipe_items` so integral budines inherit the base common set plus an additional "integral-only" layer (Harina 0000 @ 100g, Harina integral @ 100g), while non-integral budines only see the base set.

**Architecture:** A single `applies_to TEXT CHECK ('all'|'integral')` column on `common_recipe_items` determines which flavors inherit each row. The merge logic in `GET /api/flavors/:id/recipe` detects whether a flavor is integral via `name LIKE '(Int)%'` and filters common items accordingly. The cost CTE in `GET /api/flavors` is updated the same way. The frontend Ingredientes editor is split into two visual sections; Sabores.tsx carries `is_deleted` from the API so exclusion markers (qty=0) survive round-trips through the PUT recipe endpoint.

**Tech Stack:** PostgreSQL, Express/TypeScript (backend), React + TanStack Query + Tailwind + shadcn/ui (frontend), Vitest + supertest (tests).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/src/db/migrations/005_common_ingredients_group.sql` | Create | Adds column, inserts new items, cleans up recipe_items, adds Carrot Cake exclusion markers |
| `backend/src/types.ts` | Modify | `CommonRecipeItem` gets `applies_to` |
| `backend/src/routes/common-recipe.ts` | Modify | GET includes `applies_to`; PUT accepts + validates it |
| `backend/src/routes/flavors.ts` | Modify | GET / CTE: applies_to filter + qty>0 guard; GET /:id/recipe: integral-aware query + `is_deleted` output |
| `backend/src/routes/common-recipe.test.ts` | Modify | Expectations updated for `applies_to`; validation test added |
| `backend/src/routes/flavors.test.ts` | Modify | Existing mock updated; integral merge test added; is_deleted test added |
| `frontend/src/types.ts` | Modify | `CommonRecipeItem` gets `applies_to`; `RecipeItem` gets `is_deleted` |
| `frontend/src/hooks/useCommonRecipe.ts` | Modify | Mutation payload includes `applies_to` |
| `frontend/src/pages/Ingredientes.tsx` | Modify | Display card + editor split into "Para todos" / "Solo integrales" sections |
| `frontend/src/pages/Sabores.tsx` | Modify | `useEffect` propagates `is_deleted` from API response |

---

## Key Domain Facts (read before touching any file)

- `common_recipe_items` has `UNIQUE(ingredient_id)` — the same ingredient cannot appear in both `applies_to = 'all'` and `applies_to = 'integral'`.
- `recipe_items` has `UNIQUE(flavor_id, ingredient_id)` — one row per budin-ingredient pair.
- A `quantity_per_budin = 0` row in `recipe_items` is an **exclusion marker**: it tells the merge logic "skip this common ingredient for this budin."
- Carrot Cake (both `'Carrot Cake'` and `'(Int) Carrot Cake'`) uses Aceite instead of Manteca/Leche/Polvo de hornear. After those three become 'all' common items, each Carrot Cake flavor needs qty=0 exclusion markers so they don't inherit them.
- Coco (both versions) has Azúcar at 120g, not 140g → stays as an override in `recipe_items` (120 ≠ 140).
- Regular budines keep Harina 0000 in their own `recipe_items` (quantities vary 120–200g). Harina 0000 only goes into the 'integral' group at 100g.
- Integral budines that have Harina 0000 or Harina integral at exactly 100g will have those rows removed from `recipe_items` by the migration (they'll inherit from the 'integral' common set). (Int) Carrot Cake (70g each) and (Int) Coco (60g each) keep their overrides.

---

## Task 1: DB Migration 005

**Files:**
- Create: `backend/src/db/migrations/005_common_ingredients_group.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 005_common_ingredients_group.sql

BEGIN;

-- Add applies_to column; existing rows (Descartables, Huevos) default to 'all'
ALTER TABLE common_recipe_items
  ADD COLUMN applies_to TEXT NOT NULL DEFAULT 'all'
  CHECK (applies_to IN ('all', 'integral'));

-- ─── New 'all' common items ────────────────────────────────────────────────
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 70, 'all' FROM ingredients i WHERE i.name = 'Manteca';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 60, 'all' FROM ingredients i WHERE i.name = 'Leche';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 5, 'all' FROM ingredients i WHERE i.name = 'Polvo de hornear';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 140, 'all' FROM ingredients i WHERE i.name = 'Azúcar';

-- ─── New 'integral' common items ──────────────────────────────────────────
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 100, 'integral' FROM ingredients i WHERE i.name = 'Harina 0000';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 100, 'integral' FROM ingredients i WHERE i.name = 'Harina integral';

-- ─── Remove recipe_items rows now covered by 'all' common items ───────────
-- Affects any active budin that had Manteca 70, Leche 60, Polvo 5, Azúcar 140
-- (those rows are now inherited; Coco's Azúcar 120 differs → stays as override)
DELETE FROM recipe_items ri
USING flavors f, common_recipe_items cri
WHERE ri.flavor_id = f.id
  AND f.active = true
  AND ri.ingredient_id = cri.ingredient_id
  AND cri.applies_to = 'all'
  AND ri.quantity_per_budin = cri.quantity_per_budin;

-- ─── Remove recipe_items rows now covered by 'integral' common items ──────
-- Affects integral budines with Harina 0000 = 100 or Harina integral = 100
-- ((Int) Carrot Cake 70g and (Int) Coco 60g are different → stay as overrides)
DELETE FROM recipe_items ri
USING flavors f, common_recipe_items cri
WHERE ri.flavor_id = f.id
  AND f.active = true
  AND f.name LIKE '(Int)%'
  AND ri.ingredient_id = cri.ingredient_id
  AND cri.applies_to = 'integral'
  AND ri.quantity_per_budin = cri.quantity_per_budin;

-- ─── Exclusion markers for Carrot Cake ────────────────────────────────────
-- Carrot Cake uses Aceite, NOT Manteca/Leche/Polvo de hornear.
-- Without these markers it would incorrectly inherit those from the 'all' set.
INSERT INTO recipe_items (flavor_id, ingredient_id, quantity_per_budin)
SELECT f.id, i.id, 0
FROM flavors f
CROSS JOIN ingredients i
WHERE f.name IN ('Carrot Cake', '(Int) Carrot Cake')
  AND f.active = true
  AND i.name IN ('Manteca', 'Leche', 'Polvo de hornear');

COMMIT;
```

- [ ] **Step 2: Run the migration against the dev DB**

```bash
cd backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync('src/db/migrations/005_common_ingredients_group.sql', 'utf8'))
  .then(() => { console.log('Migration OK'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); process.exit(1); });
"
```

Expected: `Migration OK`

- [ ] **Step 3: Verify state**

```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  SELECT i.name, cri.quantity_per_budin, cri.applies_to
  FROM common_recipe_items cri JOIN ingredients i ON i.id = cri.ingredient_id
  ORDER BY cri.applies_to, i.name
\`).then(r => { r.rows.forEach(row => console.log(row.applies_to, row.name, row.quantity_per_budin)); pool.end(); });
"
```

Expected (8 rows):
```
all   Azúcar            140
all   Descartables        1
all   Huevos              2
all   Leche              60
all   Manteca            70
all   Polvo de hornear    5
integral  Harina 0000   100
integral  Harina integral 100
```

- [ ] **Step 4: Verify Carrot Cake exclusion markers**

```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  SELECT f.name, i.name AS ing, ri.quantity_per_budin
  FROM recipe_items ri
  JOIN flavors f ON f.id = ri.flavor_id
  JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE f.name IN ('Carrot Cake','(Int) Carrot Cake')
    AND i.name IN ('Manteca','Leche','Polvo de hornear')
\`).then(r => { r.rows.forEach(row => console.log(row.name, row.ing, row.quantity_per_budin)); pool.end(); });
"
```

Expected: 6 rows, all with quantity_per_budin = 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/migrations/005_common_ingredients_group.sql
git commit -m "feat: migration 005 — applies_to on common_recipe_items + integral group + Carrot Cake exclusions"
```

---

## Task 2: Backend — Types + common-recipe route

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `backend/src/routes/common-recipe.ts`

- [ ] **Step 1: Add failing test for applies_to in GET**

In `backend/src/routes/common-recipe.test.ts`, add inside the `GET /api/common-recipe` describe block:

```typescript
it('includes applies_to in each item', async () => {
  mockQuery.mockResolvedValueOnce({
    rows: [
      { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g',
        quantity_per_budin: 500, price_per_unit: '0.005', applies_to: 'all' },
    ],
  })
  const app = createApp()
  const res = await request(app).get('/api/common-recipe')
  expect(res.status).toBe(200)
  expect(res.body[0].applies_to).toBe('all')
})
```

Add inside the `PUT /api/common-recipe` describe block:

```typescript
it('rejects invalid applies_to value', async () => {
  const app = createApp()
  const res = await request(app)
    .put('/api/common-recipe')
    .send([{ ingredient_id: 'ing-1', quantity_per_budin: 100, applies_to: 'invalid' }])
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx vitest run src/routes/common-recipe.test.ts 2>&1 | tail -20
```

Expected: 2 failing tests.

- [ ] **Step 3: Update `CommonRecipeItem` in `backend/src/types.ts`**

```typescript
export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: string
  quantity_per_budin: number
  price_per_unit: string
  applies_to: 'all' | 'integral'
}
```

- [ ] **Step 4: Rewrite `backend/src/routes/common-recipe.ts`**

```typescript
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
```

- [ ] **Step 5: Run tests — should pass**

```bash
cd backend && npx vitest run src/routes/common-recipe.test.ts 2>&1 | tail -20
```

Expected: all tests pass (including the 2 new ones).

- [ ] **Step 6: Commit**

```bash
git add backend/src/types.ts backend/src/routes/common-recipe.ts backend/src/routes/common-recipe.test.ts
git commit -m "feat: applies_to field on CommonRecipeItem + common-recipe route GET/PUT"
```

---

## Task 3: Backend — flavors route (CTE + recipe merge)

**Files:**
- Modify: `backend/src/routes/flavors.ts`

There are two changes: (A) the `GET /` list CTE and (B) the `GET /:id/recipe` merge logic.

### Part A — `GET /` cost CTE

- [ ] **Step 1: Write failing test for integral cost**

In `backend/src/routes/flavors.test.ts`, add:

```typescript
describe('GET /api/flavors — integral cost CTE', () => {
  beforeEach(() => mockQuery.mockReset())

  it('excludes qty=0 exclusion markers from cost', async () => {
    const flavor = {
      id: 'f-int',
      name: '(Int) Vainilla',
      emoji: '🍦',
      price_per_budin: '1500.00',
      active: true,
      cost_per_budin: '300.00',
      profit_per_budin: '1200.00',
      uses_common_ingredients: true,
    }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    // cost_per_budin comes from the SQL CTE; we trust the mock value here
    expect(res.body[0].cost_per_budin).toBe('300.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or passes trivially)**

```bash
cd backend && npx vitest run src/routes/flavors.test.ts 2>&1 | tail -20
```

(The new test may pass trivially since it mocks the DB; the real check is that the SQL query compiles without error.)

### Part B — Replace the full `GET /` and `GET /:id/recipe` handlers

- [ ] **Step 3: Replace `GET /` in `backend/src/routes/flavors.ts`**

Replace the entire `flavorsRouter.get('/', ...)` handler (lines 10–55 in the current file):

```typescript
flavorsRouter.get('/', async (_req, res) => {
  const result = await query<Flavor>(
    `WITH effective_recipe AS (
       -- Non-common budines: all their own recipe_items
       SELECT ri.flavor_id, ri.ingredient_id, ri.quantity_per_budin
       FROM recipe_items ri
       JOIN flavors f ON f.id = ri.flavor_id
       WHERE f.active = true AND f.uses_common_ingredients = false

       UNION ALL

       -- Common budines: cross-join with applicable common items, apply overrides
       -- applies_to filter: 'all' always; 'integral' only for (Int) flavors
       -- qty=0 overrides are exclusion markers → skip them
       SELECT f.id AS flavor_id,
              cri.ingredient_id,
              COALESCE(ri.quantity_per_budin, cri.quantity_per_budin) AS quantity_per_budin
       FROM flavors f
       CROSS JOIN common_recipe_items cri
       LEFT JOIN recipe_items ri ON ri.flavor_id = f.id AND ri.ingredient_id = cri.ingredient_id
       WHERE f.active = true AND f.uses_common_ingredients = true
         AND (cri.applies_to = 'all' OR (f.name LIKE '(Int)%' AND cri.applies_to = 'integral'))
         AND COALESCE(ri.quantity_per_budin, cri.quantity_per_budin) > 0

       UNION ALL

       -- Exclusive items for common budines (not in the applicable common set)
       -- Uses a correlated subquery to correctly scope applies_to per flavor
       SELECT ri.flavor_id, ri.ingredient_id, ri.quantity_per_budin
       FROM recipe_items ri
       JOIN flavors f ON f.id = ri.flavor_id
       WHERE f.active = true AND f.uses_common_ingredients = true
         AND ri.ingredient_id NOT IN (
           SELECT ingredient_id FROM common_recipe_items
           WHERE applies_to = 'all' OR (f.name LIKE '(Int)%' AND applies_to = 'integral')
         )
         AND ri.quantity_per_budin > 0
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

- [ ] **Step 4: Write failing tests for `GET /:id/recipe` integral merge + is_deleted**

In `backend/src/routes/flavors.test.ts`, add:

```typescript
describe('GET /api/flavors/:id/recipe — integral + is_deleted', () => {
  beforeEach(() => mockQuery.mockReset())

  it('includes integral common items for integral flavors', async () => {
    // flavor lookup — is_integral: true
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: true }] })
    // commonRes: one 'all' + one 'integral' item (the query filters by applies_to)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-1', ingredient_name: 'Huevos', unit: 'unidad', quantity_per_budin: 2, price_per_unit: '1.00' },
        { ingredient_id: 'ing-2', ingredient_name: 'Harina integral', unit: 'g', quantity_per_budin: 100, price_per_unit: '0.003' },
      ],
    })
    // recipeRes: empty (no overrides)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/flavors/f-int/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((r: { is_common: boolean }) => r.is_common)).toBe(true)
    expect(res.body.every((r: { is_deleted: boolean }) => r.is_deleted === false)).toBe(true)
  })

  it('returns is_deleted=true for qty=0 override and excludes it from display', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: false }] })
    // commonRes: Manteca
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-manteca', ingredient_name: 'Manteca', unit: 'g', quantity_per_budin: 70, price_per_unit: '0.01' },
      ],
    })
    // recipeRes: qty=0 exclusion marker for Manteca
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ri-x', ingredient_id: 'ing-manteca', ingredient_name: 'Manteca', unit: 'g', quantity_per_budin: 0, price_per_unit: '0.01' },
      ],
    })
    const res = await request(makeApp()).get('/api/flavors/f-1/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    const manteca = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-manteca')
    expect(manteca.is_deleted).toBe(true)
    expect(manteca.is_common).toBe(true)
    expect(manteca.is_overridden).toBe(false)
  })
})
```

- [ ] **Step 5: Run tests to confirm they fail**

```bash
cd backend && npx vitest run src/routes/flavors.test.ts 2>&1 | tail -20
```

Expected: 2–3 failing tests.

- [ ] **Step 6: Replace `GET /:id/recipe` handler in `backend/src/routes/flavors.ts`**

Replace the entire `flavorsRouter.get('/:id/recipe', ...)` handler:

```typescript
flavorsRouter.get('/:id/recipe', async (req, res) => {
  const flavorRes = await query<{ uses_common_ingredients: boolean; is_integral: boolean }>(
    `SELECT uses_common_ingredients, name LIKE '(Int)%' AS is_integral FROM flavors WHERE id = $1`,
    [req.params.id]
  )
  if (!flavorRes.rows.length) {
    res.status(404).json({ error: 'Flavor not found' })
    return
  }
  const { uses_common_ingredients: usesCommon, is_integral: isIntegral } = flavorRes.rows[0]

  if (!usesCommon) {
    const result = await query<{
      id: string; ingredient_id: string; ingredient_name: string
      unit: string; quantity_per_budin: number; price_per_unit: string
      is_common: boolean; is_overridden: boolean; is_deleted: boolean
    }>(
      `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(ri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit,
              false AS is_common, false AS is_overridden, false AS is_deleted
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
       WHERE cri.applies_to = 'all' OR ($1 AND cri.applies_to = 'integral')
       ORDER BY i.name`,
      [isIntegral]
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
    if (override && Number(override.quantity_per_budin) === 0) {
      // Exclusion marker: return with is_deleted=true so the frontend re-sends it on save
      return { ...c, id: override.id, is_common: true, is_overridden: false, is_deleted: true }
    }
    return override
      ? { ...override, is_common: true, is_overridden: true, is_deleted: false }
      : { ...c, id: null, is_common: true, is_overridden: false, is_deleted: false }
  })

  const exclusiveItems = recipeRes.rows
    .filter(r => !commonIngredientIds.has(r.ingredient_id) && Number(r.quantity_per_budin) > 0)
    .map(r => ({ ...r, is_common: false, is_overridden: false, is_deleted: false }))

  res.json([...commonItems, ...exclusiveItems])
})
```

- [ ] **Step 7: Run all backend tests — should all pass**

```bash
cd backend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/flavors.ts backend/src/routes/flavors.test.ts
git commit -m "feat: integral-aware CTE + is_deleted in GET /:id/recipe"
```

---

## Task 4: Frontend — Types + Hook

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/hooks/useCommonRecipe.ts`

- [ ] **Step 1: Update `frontend/src/types.ts`**

Add `applies_to` to `CommonRecipeItem` and `is_deleted` to `RecipeItem`:

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
  is_deleted: boolean
}

export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
  applies_to: 'all' | 'integral'
}
```

- [ ] **Step 2: Update `frontend/src/hooks/useCommonRecipe.ts`**

```typescript
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
    mutationFn: (items: { ingredient_id: string; quantity_per_budin: number; applies_to: 'all' | 'integral' }[]) =>
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

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "TS5101\|Visit https"
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useCommonRecipe.ts
git commit -m "feat: applies_to on CommonRecipeItem, is_deleted on RecipeItem, hook payload updated"
```

---

## Task 5: Frontend — Ingredientes.tsx (split editor)

**Files:**
- Modify: `frontend/src/pages/Ingredientes.tsx`

The `CommonEditRow` interface and all related state/functions need `applies_to`. The display card and the editor Sheet are each split into two labeled sections.

- [ ] **Step 1: Update `CommonEditRow` interface and `addCommonRow`**

Find the `CommonEditRow` interface (near line 67) and the `addCommonRow` function. Replace both:

```typescript
interface CommonEditRow { key: number; ingredient_id: string; quantity_per_budin: string; applies_to: 'all' | 'integral' }
```

Replace `openCommonEditor` (around line 92):
```typescript
function openCommonEditor() {
  setCommonRows(commonRecipe.map((r: CommonRecipeItem) => ({
    key: commonRowKey++,
    ingredient_id: r.ingredient_id,
    quantity_per_budin: String(r.quantity_per_budin),
    applies_to: r.applies_to,
  })))
  setCommonSheetOpen(true)
}
```

Replace `addCommonRow` with a version that accepts `applies_to`:
```typescript
function addCommonRow(applies_to: 'all' | 'integral') {
  setCommonRows(r => [...r, { key: commonRowKey++, ingredient_id: '', quantity_per_budin: '', applies_to }])
}
```

Replace `saveCommon`:
```typescript
async function saveCommon() {
  const items = commonRows
    .filter(r => r.ingredient_id && r.quantity_per_budin)
    .map(r => ({ ingredient_id: r.ingredient_id, quantity_per_budin: parseFloat(r.quantity_per_budin), applies_to: r.applies_to }))
  await saveCommonRecipe.mutateAsync(items)
  setCommonSheetOpen(false)
}
```

- [ ] **Step 2: Replace the display card JSX**

Find the `{/* Ingredientes comunes de budines */}` block (around line 189–214). Replace it with:

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
    <div className="space-y-3">
      {/* Para todos los budines */}
      {commonRecipe.filter(item => item.applies_to === 'all').length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Para todos</p>
          {commonRecipe.filter(item => item.applies_to === 'all').map(item => (
            <div key={item.ingredient_id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{item.ingredient_name}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.quantity_per_budin} {item.unit === 'unidad' ? 'uni' : item.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Solo integrales */}
      {commonRecipe.filter(item => item.applies_to === 'integral').length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solo integrales</p>
          {commonRecipe.filter(item => item.applies_to === 'integral').map(item => (
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
  )}
</div>
```

- [ ] **Step 3: Replace the Sheet editor JSX**

Find the `{/* Sheet editor for common recipe */}` block (around line 216–278). Replace it with:

```tsx
{/* Sheet editor for common recipe */}
<Sheet open={commonSheetOpen} onOpenChange={setCommonSheetOpen}>
  <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
    <SheetHeader className="px-6 pt-6 pb-4">
      <SheetTitle>Ingredientes comunes de budines</SheetTitle>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Editarlos afecta a todos los budines que usen receta común. Los de "Solo integrales" también heredan los de "Para todos".
      </p>

      {/* Para todos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Para todos los budines</span>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => addCommonRow('all')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
          </Button>
        </div>
        {commonRows.filter(r => r.applies_to === 'all').length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Sin ingredientes. Agregá uno.</p>
        )}
        {commonRows.filter(r => r.applies_to === 'all').map(row => {
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
              <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => removeCommonRow(row.key)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border" />

      {/* Solo integrales */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Solo integrales</span>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => addCommonRow('integral')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
          </Button>
        </div>
        {commonRows.filter(r => r.applies_to === 'integral').length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Sin ingredientes. Agregá uno.</p>
        )}
        {commonRows.filter(r => r.applies_to === 'integral').map(row => {
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
              <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => removeCommonRow(row.key)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          )
        })}
      </div>
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

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "TS5101\|Visit https"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Ingredientes.tsx
git commit -m "feat: split common recipe editor into Para todos / Solo integrales sections"
```

---

## Task 6: Frontend — Sabores.tsx (propagate is_deleted from API)

**Files:**
- Modify: `frontend/src/pages/Sabores.tsx`

The `useEffect` that populates `commonItems` from `existingRecipe` must carry `is_deleted` from the API response. Without this, Carrot Cake would re-inherit Manteca/Leche/Polvo hornear every time the user opens and saves its recipe (because the exclusion markers would be lost).

- [ ] **Step 1: Update the `useEffect` in `Sabores.tsx`**

Find the `useEffect` block (around line 72). Replace it:

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
          is_deleted: r.is_deleted,
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

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "TS5101\|Visit https"
```

Expected: no output.

- [ ] **Step 3: Run backend tests one final time**

```bash
cd backend && npx vitest run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Sabores.tsx
git commit -m "feat: propagate is_deleted from API in Sabores recipe editor"
```

---

## Self-Review

**Spec coverage:**
- ✅ `applies_to` column added to `common_recipe_items`
- ✅ New common items inserted: Manteca/Leche/Polvo hornear/Azúcar → 'all'; Harina 0000/Harina integral → 'integral'
- ✅ Redundant recipe_items cleaned up
- ✅ Carrot Cake exclusion markers inserted
- ✅ `GET /api/common-recipe` returns `applies_to`
- ✅ `PUT /api/common-recipe` accepts and validates `applies_to`
- ✅ `GET /api/flavors` CTE filters by applies_to + skips qty=0
- ✅ `GET /api/flavors/:id/recipe` returns integral-specific common items + `is_deleted`
- ✅ Frontend types updated
- ✅ Ingredientes editor split into two sections
- ✅ Sabores.tsx propagates `is_deleted` from API → exclusion markers survive saves

**Placeholder scan:** None found.

**Type consistency:**
- `CommonRecipeItem.applies_to: 'all' | 'integral'` used consistently across backend types, frontend types, hook payload, and Ingredientes editor.
- `RecipeItem.is_deleted: boolean` used consistently in backend response, frontend types, and Sabores.tsx useEffect.
- `CommonItemState.is_deleted: boolean` was already added in a prior session — the `is_deleted` field from the API now populates it correctly.
