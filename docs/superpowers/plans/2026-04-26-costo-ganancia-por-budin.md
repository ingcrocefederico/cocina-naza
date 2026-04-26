# Costo y Ganancia por Budín — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar costo de producción y ganancia por budín en la página de Sabores (cards y sheet de edición), calculados en el backend via SQL JOIN.

**Architecture:** El query `GET /api/flavors` se extiende con un LEFT JOIN a `recipe_items` e `ingredients` para calcular `cost_per_budin` y `profit_per_budin` en SQL. Los tipos en backend y frontend reciben los nuevos campos. Sabores.tsx muestra los 3 valores (venta, costo, ganancia) en cada card y en el sheet de edición.

**Tech Stack:** PostgreSQL (SQL JOIN + COALESCE), Express/TypeScript (backend), React + TanStack Query (frontend), Tailwind CSS + shadcn/ui.

---

### Task 1: Actualizar tipos Flavor (backend + frontend)

**Files:**
- Modify: `backend/src/types.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Agregar campos al tipo Flavor en backend**

En `backend/src/types.ts`, línea 17 (después de `created_at`), agregar:

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
}
```

- [ ] **Step 2: Agregar campos al tipo Flavor en frontend**

En `frontend/src/types.ts`, línea 17 (después de `active`), agregar:

```typescript
export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  cost_per_budin: string
  profit_per_budin: string
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/types.ts frontend/src/types.ts
git commit -m "feat: add cost_per_budin and profit_per_budin to Flavor type"
```

---

### Task 2: Actualizar query GET /api/flavors con JOIN

**Files:**
- Modify: `backend/src/routes/flavors.ts`
- Modify: `backend/src/routes/flavors.test.ts`

- [ ] **Step 1: Actualizar test existente para incluir nuevos campos**

En `backend/src/routes/flavors.test.ts`, el fixture del test "returns list of flavors" debe incluir los nuevos campos:

```typescript
it('returns list of flavors', async () => {
  const flavor = {
    id: 'f-1',
    name: 'Vainilla',
    emoji: '🍦',
    price_per_budin: '1500.00',
    active: true,
    cost_per_budin: '480.00',
    profit_per_budin: '1020.00',
  }
  mockQuery.mockResolvedValue({ rows: [flavor] })
  const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
  expect(res.status).toBe(200)
  expect(res.body[0].cost_per_budin).toBe('480.00')
  expect(res.body[0].profit_per_budin).toBe('1020.00')
})
```

- [ ] **Step 2: Agregar test para sabor sin receta**

En `backend/src/routes/flavors.test.ts`, dentro del bloque `describe('GET /api/flavors', ...)`:

```typescript
it('returns cost 0 and profit equal to price when no recipe', async () => {
  const flavor = {
    id: 'f-2',
    name: 'Sin receta',
    emoji: '🍰',
    price_per_budin: '1000.00',
    active: true,
    cost_per_budin: '0.0000',
    profit_per_budin: '1000.0000',
  }
  mockQuery.mockResolvedValue({ rows: [flavor] })
  const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
  expect(res.body[0].cost_per_budin).toBe('0.0000')
  expect(res.body[0].profit_per_budin).toBe('1000.0000')
})
```

- [ ] **Step 3: Correr tests — verificar que fallan por razón correcta**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run src/routes/flavors.test.ts
```

Los tests pueden pasar igual porque el mock no valida el SQL. Si pasan, continuar.

- [ ] **Step 4: Reemplazar query en flavors.ts GET /**

En `backend/src/routes/flavors.ts`, reemplazar líneas 10-15:

```typescript
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
```

- [ ] **Step 5: Correr todos los tests del backend**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/backend && npx vitest run
```

Expected: todos pasan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/flavors.ts backend/src/routes/flavors.test.ts
git commit -m "feat: compute cost_per_budin and profit_per_budin in GET /api/flavors"
```

---

### Task 3: Actualizar Sabores.tsx — card y sheet

**Files:**
- Modify: `frontend/src/pages/Sabores.tsx`

- [ ] **Step 1: Agregar helper formatARS**

Al principio de `frontend/src/pages/Sabores.tsx`, después de los imports, agregar:

```typescript
function formatARS(value: string) {
  return `$${parseFloat(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
```

- [ ] **Step 2: Reemplazar CardContent de cada card**

Reemplazar las líneas del `<CardContent ...>` (líneas 129-142) por:

```tsx
<CardContent className="pt-0">
  <div className="flex items-center justify-between gap-2">
    <div className="flex gap-3 text-xs">
      <span className="text-muted-foreground">
        Venta <span className="text-foreground font-semibold">{formatARS(flavor.price_per_budin)}</span>
      </span>
      <span className="text-muted-foreground">
        Costo{' '}
        {parseFloat(flavor.cost_per_budin) > 0
          ? <span className="text-foreground font-medium">{formatARS(flavor.cost_per_budin)}</span>
          : <span className="text-muted-foreground/60">—</span>
        }
      </span>
      <span className="text-muted-foreground">
        Gan.{' '}
        <span className={parseFloat(flavor.profit_per_budin) >= 0 ? 'font-semibold text-green-500' : 'font-semibold text-destructive'}>
          {formatARS(flavor.profit_per_budin)}
        </span>
      </span>
    </div>
    <Button
      variant="ghost"
      size="sm"
      className="cursor-pointer shrink-0"
      onClick={e => { e.stopPropagation(); deleteFlavor.mutate(flavor.id) }}
    >
      <Trash2 className="w-3.5 h-3.5 text-destructive" />
    </Button>
  </div>
</CardContent>
```

- [ ] **Step 3: Agregar bloque de costos en el sheet de edición**

En el sheet, dentro de `<div className="space-y-4 py-4">`, agregar ANTES del grid de nombre/emoji (antes del `<div className="grid grid-cols-[1fr_80px] ...`):

```tsx
{editing && (
  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 bg-muted/30 text-center">
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">Venta</p>
      <p className="text-sm font-semibold text-foreground">{formatARS(editing.price_per_budin)}</p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">Costo</p>
      <p className="text-sm font-medium text-foreground">
        {parseFloat(editing.cost_per_budin) > 0 ? formatARS(editing.cost_per_budin) : '—'}
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">Ganancia</p>
      <p className={`text-sm font-semibold ${parseFloat(editing.profit_per_budin) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
        {formatARS(editing.profit_per_budin)}
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verificar TypeScript compila sin errores**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/frontend && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Levantar dev server y verificar manualmente**

```bash
cd /Users/federicocroce/Documents/Naza/cocina && npm run dev
```

Verificar en http://localhost:5173:
- Cada card de sabor muestra Venta, Costo y Ganancia
- Sabor sin receta muestra "—" en Costo
- Ganancia negativa aparece en rojo
- Ganancia positiva aparece en verde
- Al editar un sabor, el sheet muestra el bloque de 3 valores arriba del form
- Solo el campo Precio por budín es editable

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Sabores.tsx
git commit -m "feat: show cost and profit per budin in Sabores cards and edit sheet"
```
