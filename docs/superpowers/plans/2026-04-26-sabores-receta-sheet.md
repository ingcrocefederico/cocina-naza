# Sheet de Receta por Budín — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ChefHat button on each budín card that opens a read-only Sheet showing the recipe ingredients, quantities, and costs.

**Architecture:** Two tasks — extend the backend recipe endpoint to return `price_per_unit`, then wire up the frontend: ChefHat button on card with stopPropagation, plus a read-only Sheet using the existing `useFlavorRecipe` hook.

**Tech Stack:** Express/PostgreSQL (backend), React + TanStack Query + shadcn/ui Sheet (frontend)

---

### Task 1: Backend — add price_per_unit to recipe endpoints + update frontend type

**Files:**
- Modify: `backend/src/routes/flavors.ts` (lines 67–105)
- Modify: `frontend/src/types.ts` (RecipeItem interface, lines 47–53)
- Test: `backend/src/routes/flavors.test.ts`

- [ ] **Step 1: Write failing test for GET /:id/recipe returning price_per_unit**

Add this describe block to `backend/src/routes/flavors.test.ts` after the existing describe blocks:

```typescript
describe('GET /api/flavors/:id/recipe', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns recipe items with price_per_unit', async () => {
    const item = {
      id: 'ri-1',
      ingredient_id: 'ing-1',
      ingredient_name: 'Harina',
      unit: 'kg',
      quantity_per_budin: 0.5,
      price_per_unit: '1200.00',
    }
    mockQuery.mockResolvedValue({ rows: [item] })
    const res = await request(makeApp())
      .get('/api/flavors/f-1/recipe')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].price_per_unit).toBe('1200.00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run src/routes/flavors.test.ts 2>&1 | tail -20
```

Expected: the new test PASSES (mock returns the fixture directly), confirming the response shape assertion works. The SQL doesn't yet select price_per_unit — proceed to add it.

- [ ] **Step 3: Add i.price_per_unit to GET /:id/recipe**

In `backend/src/routes/flavors.ts`, replace lines 67–83 with:

```typescript
flavorsRouter.get('/:id/recipe', async (req, res) => {
  const result = await query<{
    id: string
    ingredient_id: string
    ingredient_name: string
    unit: string
    quantity_per_budin: number
    price_per_unit: string
  }>(
    `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ri.quantity_per_budin, i.price_per_unit
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.flavor_id = $1
     ORDER BY i.name`,
    [req.params.id]
  )
  res.json(result.rows)
})
```

- [ ] **Step 4: Add i.price_per_unit to PUT /:id/recipe final SELECT**

In `backend/src/routes/flavors.ts`, replace the final SELECT inside `flavorsRouter.put('/:id/recipe', ...)` (lines 96–103) with:

```typescript
  const result = await query(
    `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ri.quantity_per_budin, i.price_per_unit
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.flavor_id = $1
     ORDER BY i.name`,
    [req.params.id]
  )
  res.json(result.rows)
```

- [ ] **Step 5: Add price_per_unit to RecipeItem in frontend/src/types.ts**

Replace lines 47–53 in `frontend/src/types.ts`:

```typescript
export interface RecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
}
```

- [ ] **Step 6: Run backend tests**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run src/routes/flavors.test.ts 2>&1 | tail -30
```

Expected: all tests PASS

- [ ] **Step 7: TypeScript check on frontend**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add backend/src/routes/flavors.ts frontend/src/types.ts backend/src/routes/flavors.test.ts
git commit -m "feat: add price_per_unit to recipe endpoints and RecipeItem type"
```

---

### Task 2: Frontend — ChefHat button + read-only recipe Sheet in Sabores.tsx

**Files:**
- Modify: `frontend/src/pages/Sabores.tsx`

- [ ] **Step 1: Add ChefHat to lucide-react import**

In `frontend/src/pages/Sabores.tsx`, replace line 15:

```typescript
import { Trash2, Plus, ChefHat } from 'lucide-react'
```

- [ ] **Step 2: Add recipeFlavorId and recipeOpen state + hook call**

In `Sabores()`, after line 50 (`const [rows, setRows] = useState<RecipeRow[]>([])`), add:

```typescript
  const [recipeFlavorId, setRecipeFlavorId] = useState<string | null>(null)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const { data: recipe = [] } = useFlavorRecipe(recipeFlavorId)
```

- [ ] **Step 3: Add derived display values before return**

In `Sabores()`, just before the `if (isLoading) return ...` line (line 112), add:

```typescript
  const recipeFlavor = recipeFlavorId ? (flavors.find(f => f.id === recipeFlavorId) ?? null) : null
  const recipeTotalCost = recipe.reduce(
    (sum, item) => sum + item.quantity_per_budin * parseFloat(item.price_per_unit || '0'),
    0
  )
```

- [ ] **Step 4: Add ChefHat button to each card**

In `Sabores.tsx`, inside the card's `CardContent` > `div.flex.items-center.justify-between` (line 137), the current button is:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="cursor-pointer shrink-0"
  onClick={e => { e.stopPropagation(); deleteFlavor.mutate(flavor.id) }}
>
  <Trash2 className="w-3.5 h-3.5 text-destructive" />
</Button>
```

Replace that single button with two buttons (ChefHat first, then Trash2):

```tsx
<div className="flex items-center gap-1 shrink-0">
  <Button
    variant="ghost"
    size="sm"
    className="cursor-pointer"
    onClick={e => {
      e.stopPropagation()
      setRecipeFlavorId(flavor.id)
      setRecipeOpen(true)
    }}
  >
    <ChefHat className="w-3.5 h-3.5 text-muted-foreground" />
  </Button>
  <Button
    variant="ghost"
    size="sm"
    className="cursor-pointer"
    onClick={e => { e.stopPropagation(); deleteFlavor.mutate(flavor.id) }}
  >
    <Trash2 className="w-3.5 h-3.5 text-destructive" />
  </Button>
</div>
```

- [ ] **Step 5: Add read-only recipe Sheet after the edit Sheet**

In `Sabores.tsx`, after the closing `</Sheet>` of the edit sheet (line 265), add:

```tsx
      {/* Sheet de receta — solo lectura */}
      <Sheet
        open={recipeOpen}
        onOpenChange={open => {
          setRecipeOpen(open)
          if (!open) setRecipeFlavorId(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {recipeFlavor && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="text-xl">{recipeFlavor.emoji}</span>
                  {recipeFlavor.name}
                </SheetTitle>
              </SheetHeader>

              <div className="py-4">
                {recipe.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin receta cargada aún.</p>
                ) : (
                  <>
                    {/* Encabezado de columnas */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                      <span>Ingrediente</span>
                      <span className="text-right">Cantidad</span>
                      <span className="text-right w-20">Costo</span>
                    </div>

                    {/* Filas de ingredientes */}
                    {recipe.map(item => {
                      const price = parseFloat(item.price_per_unit || '0')
                      const itemCost = item.quantity_per_budin * price
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 py-2.5 border-b border-border text-sm"
                        >
                          <span className="text-foreground">{item.ingredient_name}</span>
                          <span className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                            {item.quantity_per_budin} {formatUnit(item.unit)}
                          </span>
                          <span className="text-right tabular-nums w-20">
                            {price === 0
                              ? <span className="text-muted-foreground">—</span>
                              : formatARS(String(itemCost))
                            }
                          </span>
                        </div>
                      )
                    })}

                    <Separator className="my-3" />

                    {/* Totales */}
                    <div className="space-y-2 px-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Costo total</span>
                        <span className="font-medium tabular-nums">{formatARS(String(recipeTotalCost))}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio de venta</span>
                        <span className="font-medium tabular-nums">{formatARS(recipeFlavor.price_per_budin)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-muted-foreground">Ganancia</span>
                        <span
                          className={`tabular-nums ${
                            parseFloat(recipeFlavor.price_per_budin) - recipeTotalCost >= 0
                              ? 'text-green-500'
                              : 'text-destructive'
                          }`}
                        >
                          {formatARS(String(parseFloat(recipeFlavor.price_per_budin) - recipeTotalCost))}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/pages/Sabores.tsx
git commit -m "feat: add read-only recipe sheet (ChefHat button) on sabores cards"
```
