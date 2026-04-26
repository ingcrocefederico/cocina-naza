# Resumen Financiero en Pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar Costo y Ganancia del día en la fila de totalizadores de la página de Pedidos, junto al total de ventas ya existente.

**Architecture:** Cambio puramente frontend en un solo archivo. Los datos ya están disponibles via `useCalculator(date)` (hook ya presente). Se extiende el bloque `Totalizadores` existente con dos spans adicionales condicionales a que `calc?.financials` esté cargado.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Extender Totalizadores en Pedidos.tsx

**Files:**
- Modify: `frontend/src/pages/Pedidos.tsx:97-103`

- [ ] **Step 1: Leer el estado actual del bloque Totalizadores**

Leer `frontend/src/pages/Pedidos.tsx` líneas 96-103 para confirmar el estado actual:

```tsx
{/* Totalizadores */}
{orders.length > 0 && (
  <div className="flex gap-6 text-sm text-muted-foreground border-b border-border pb-3">
    <span><strong className="text-foreground">{orders.length}</strong> pedidos</span>
    <span><strong className="text-foreground">{totalBudines}</strong> budines</span>
    <span>Venta: <strong className="text-primary">${totalVenta.toLocaleString('es-AR')}</strong></span>
  </div>
)}
```

- [ ] **Step 2: Reemplazar el bloque Totalizadores**

Reemplazar las líneas 96-103 por:

```tsx
{/* Totalizadores */}
{orders.length > 0 && (
  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-b border-border pb-3">
    <span><strong className="text-foreground">{orders.length}</strong> pedidos</span>
    <span><strong className="text-foreground">{totalBudines}</strong> budines</span>
    <span>Venta: <strong className="text-primary">${totalVenta.toLocaleString('es-AR')}</strong></span>
    {calc?.financials && (
      <>
        <span>Costo: <strong className="text-foreground">${calc.financials.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></span>
        <span>Gan.: <strong className={totalVenta - calc.financials.totalCost >= 0 ? 'text-green-500' : 'text-destructive'}>
          ${(totalVenta - calc.financials.totalCost).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </strong></span>
      </>
    )}
  </div>
)}
```

Nota: `totalVenta` está definido en línea 71 como `orders.reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)`. `calc` viene de `const { data: calc } = useCalculator(date)` en línea 60. Ambas variables ya existen — no hay nada nuevo que declarar.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/federicocroce/Documents/Naza/cocina/frontend && npx tsc --noEmit
```

Expected: solo el warning pre-existente TS5101 sobre `baseUrl`, cero errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Pedidos.tsx
git commit -m "feat: show daily cost and profit in Pedidos summary row"
```
