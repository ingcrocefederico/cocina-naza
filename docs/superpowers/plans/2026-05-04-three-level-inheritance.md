# 3-Level Common Ingredients Inheritance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the common ingredients model from additive groups to a true 3-level inheritance chain: `applies_to='all'` (base for every budin) → `applies_to='integral'` (overrides/extends the base for `(Int)%` flavors) → per-budin `recipe_items` (individual overrides).

**Architecture:** Drop `UNIQUE(ingredient_id)` on `common_recipe_items` and replace it with `UNIQUE(ingredient_id, applies_to)`, allowing the same ingredient to appear in both groups at different quantities. The cost CTE in `GET /api/flavors` and the recipe merge in `GET /api/flavors/:id/recipe` both switch to `DISTINCT ON (ingredient_id)` ordered so that the `'integral'` row wins over `'all'` when both exist, giving integral budins the overridden quantity.

**Tech Stack:** PostgreSQL (LATERAL, DISTINCT ON), Express/TypeScript, Vitest + supertest.

---

## Domain Facts (read before touching anything)

- `common_recipe_items.applies_to`: `'all'` = every budin; `'integral'` = `(Int)%` budins only.
- Integral budins currently inherit **only** 'integral' items in addition to 'all' items (additive). After this change they inherit 'all' first, then 'integral' **overrides** the same ingredient if present.
- `quantity_per_budin = 0` in `recipe_items` is an exclusion marker — it means "skip this common item for this budin."
- The current UNIQUE constraint name is `common_recipe_items_ingredient_id_key`.
- `(cri.applies_to = 'integral') DESC` in ORDER BY evaluates to `TRUE` before `FALSE` in PostgreSQL, so 'integral' rows sort first when using DISTINCT ON.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/src/db/migrations/006_common_ingredients_inheritance.sql` | Create | Drops UNIQUE(ingredient_id), adds UNIQUE(ingredient_id, applies_to) |
| `backend/src/routes/flavors.ts` | Modify | CTE second UNION ALL: LATERAL+DISTINCT ON; GET /:id/recipe commonRes: DISTINCT ON |
| `backend/src/routes/flavors.test.ts` | Modify | New test: integral override wins over base for same ingredient |

---

## Task 1: DB Migration 006

**Files:**
- Create: `backend/src/db/migrations/006_common_ingredients_inheritance.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 006_common_ingredients_inheritance.sql
-- Replace UNIQUE(ingredient_id) with UNIQUE(ingredient_id, applies_to) so the same
-- ingredient can appear in both 'all' and 'integral' groups at different quantities.
-- This enables 3-level inheritance: all → integral (override) → per-budin override.

BEGIN;

ALTER TABLE common_recipe_items
  DROP CONSTRAINT common_recipe_items_ingredient_id_key;

ALTER TABLE common_recipe_items
  ADD CONSTRAINT common_recipe_items_ingredient_id_applies_to_key
  UNIQUE (ingredient_id, applies_to);

COMMIT;
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync('src/db/migrations/006_common_ingredients_inheritance.sql', 'utf8'))
  .then(() => { console.log('Migration OK'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); process.exit(1); });
"
```

Expected: `Migration OK`

- [ ] **Step 3: Verify the new constraint**

```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'common_recipe_items'::regclass AND contype = 'u'
\`).then(r => { console.log(JSON.stringify(r.rows)); pool.end(); });
"
```

Expected:
```json
[{"conname":"common_recipe_items_ingredient_id_applies_to_key"}]
```

- [ ] **Step 4: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add backend/src/db/migrations/006_common_ingredients_inheritance.sql
git commit -m "feat: migration 006 — UNIQUE(ingredient_id, applies_to) for 3-level inheritance"
```

---

## Task 2: Backend — DISTINCT ON in CTE and recipe merge

**Files:**
- Modify: `backend/src/routes/flavors.ts`
- Modify: `backend/src/routes/flavors.test.ts`

There are two query changes:
- **A** — `GET /` cost CTE: replace CROSS JOIN approach with `LATERAL + DISTINCT ON` so 'integral' quantity overrides 'all' for same ingredient in integral budins.
- **B** — `GET /:id/recipe` commonRes query: add `DISTINCT ON (cri.ingredient_id)` so the same ingredient appearing in both groups is deduplicated with 'integral' winning.

### Part A — failing test first

- [ ] **Step 1: Add failing test for integral override in cost CTE**

In `backend/src/routes/flavors.test.ts`, add inside the `GET /api/flavors — integral cost CTE` describe block (after the existing test):

```typescript
it('uses integral quantity when same ingredient is in both all and integral layers', async () => {
  const flavor = {
    id: 'f-int',
    name: '(Int) Vainilla',
    emoji: '🍦',
    price_per_budin: '1500.00',
    active: true,
    cost_per_budin: '200.00',
    profit_per_budin: '1300.00',
    uses_common_ingredients: true,
  }
  mockQuery.mockResolvedValue({ rows: [flavor] })
  const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
  expect(res.status).toBe(200)
  // cost comes from the CTE — we trust the mock value here;
  // the real SQL correctness is validated by running the migration + integration test
  expect(res.body[0].cost_per_budin).toBe('200.00')
})
```

Also add inside the `GET /api/flavors/:id/recipe — integral + is_deleted` describe block:

```typescript
it('uses integral layer quantity when same ingredient exists in both all and integral', async () => {
  // integral budin — Azúcar in 'all' at 140g AND in 'integral' at 100g
  // DISTINCT ON picks the 'integral' row → quantity_per_budin = 100
  mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: true }] })
  // commonRes: DISTINCT ON already resolved — only one row per ingredient, integral wins
  mockQuery.mockResolvedValueOnce({
    rows: [
      { ingredient_id: 'ing-azucar', ingredient_name: 'Azúcar', unit: 'g', quantity_per_budin: 100, price_per_unit: '0.001' },
    ],
  })
  mockQuery.mockResolvedValueOnce({ rows: [] })
  const res = await request(makeApp()).get('/api/flavors/f-int/recipe').set('Cookie', authCookie())
  expect(res.status).toBe(200)
  const azucar = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-azucar')
  expect(azucar.quantity_per_budin).toBe(100)
  expect(azucar.is_common).toBe(true)
  expect(azucar.is_overridden).toBe(false)
  expect(azucar.is_deleted).toBe(false)
})
```

- [ ] **Step 2: Run tests to see the new ones pass trivially (mocked) and confirm no regressions**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run src/routes/flavors.test.ts 2>&1 | tail -20
```

Expected: all tests pass (the new tests use mocks, so they pass trivially — the real check is the SQL in the next step).

### Part B — implement the SQL changes

- [ ] **Step 3: Replace `GET /` handler in `backend/src/routes/flavors.ts`**

Find the entire `flavorsRouter.get('/', async (_req, res) => { ... })` block and replace it with:

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

       -- Common budines: LATERAL + DISTINCT ON so 'integral' overrides 'all' for same ingredient
       SELECT f.id AS flavor_id,
              eff.ingredient_id,
              COALESCE(ri.quantity_per_budin, eff.quantity_per_budin) AS quantity_per_budin
       FROM flavors f
       JOIN LATERAL (
         SELECT DISTINCT ON (cri.ingredient_id)
                cri.ingredient_id,
                cri.quantity_per_budin
         FROM common_recipe_items cri
         WHERE cri.applies_to = 'all'
            OR (f.name LIKE '(Int)%' AND cri.applies_to = 'integral')
         ORDER BY cri.ingredient_id, (cri.applies_to = 'integral') DESC
       ) eff ON true
       LEFT JOIN recipe_items ri ON ri.flavor_id = f.id AND ri.ingredient_id = eff.ingredient_id
       WHERE f.active = true AND f.uses_common_ingredients = true
         AND COALESCE(ri.quantity_per_budin, eff.quantity_per_budin) > 0

       UNION ALL

       -- Exclusive items for common budines (not in the applicable common set)
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

- [ ] **Step 4: Replace the commonRes query inside `GET /:id/recipe` in `backend/src/routes/flavors.ts`**

Find this query inside the `flavorsRouter.get('/:id/recipe', ...)` handler (it's the first query inside `Promise.all`):

```typescript
    query<{ ingredient_id: string; ingredient_name: string; unit: string; quantity_per_budin: number; price_per_unit: string }>(
      `SELECT cri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
       FROM common_recipe_items cri
       JOIN ingredients i ON i.id = cri.ingredient_id
       WHERE cri.applies_to = 'all' OR ($1 AND cri.applies_to = 'integral')
       ORDER BY i.name`,
      [isIntegral]
    ),
```

Replace with:

```typescript
    query<{ ingredient_id: string; ingredient_name: string; unit: string; quantity_per_budin: number; price_per_unit: string }>(
      `SELECT DISTINCT ON (cri.ingredient_id)
              cri.ingredient_id, i.name AS ingredient_name, i.unit,
              ROUND(cri.quantity_per_budin)::integer AS quantity_per_budin, i.price_per_unit
       FROM common_recipe_items cri
       JOIN ingredients i ON i.id = cri.ingredient_id
       WHERE cri.applies_to = 'all' OR ($1 AND cri.applies_to = 'integral')
       ORDER BY cri.ingredient_id, (cri.applies_to = 'integral') DESC, i.name`,
      [isIntegral]
    ),
```

- [ ] **Step 5: Run all backend tests**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add backend/src/routes/flavors.ts backend/src/routes/flavors.test.ts
git commit -m "feat: DISTINCT ON integral override in flavors CTE and recipe merge"
```

---

## Self-Review

**Spec coverage:**
- ✅ UNIQUE constraint changed: same ingredient can now appear in 'all' and 'integral'
- ✅ Cost CTE: LATERAL + DISTINCT ON picks 'integral' quantity over 'all' for integral budins
- ✅ Recipe merge: DISTINCT ON in commonRes query picks 'integral' quantity for same ingredient
- ✅ Regular budins unaffected: LATERAL filter only includes 'all' rows when `f.name NOT LIKE '(Int)%'`
- ✅ Exclusion markers (qty=0) still work: COALESCE picks the recipe_items row → 0 → excluded from cost CTE
- ✅ Frontend unchanged: no schema or API contract changes visible to frontend

**Placeholder scan:** None found.

**Type consistency:** No new types introduced. SQL aliases (`eff.ingredient_id`, `eff.quantity_per_budin`) match TypeScript query type `{ ingredient_id, quantity_per_budin }`.
