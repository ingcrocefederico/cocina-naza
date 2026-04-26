# Resumen Financiero en Pedidos

**Fecha:** 2026-04-26

## Objetivo

Agregar costo total y ganancia del día en la fila de totalizadores del tope de la página de Pedidos, junto al total de ventas ya existente.

## Datos

Los valores provienen de `calc?.financials` (hook `useCalculator(date)` ya presente en Pedidos.tsx):

- `totalVenta`: ya calculado localmente en el componente (suma de `sale_price` de órdenes)
- `totalCosto`: `calc?.financials.totalCost` — costo total de ingredientes del día
- `ganancia`: `totalVenta - totalCosto` (calculado en FE para evitar inconsistencias de redondeo entre fuentes)

## Cambio

### Solo frontend — `frontend/src/pages/Pedidos.tsx`

**Antes** (líneas 97-103):
```tsx
{orders.length > 0 && (
  <div className="flex gap-6 text-sm text-muted-foreground border-b border-border pb-3">
    <span><strong className="text-foreground">{orders.length}</strong> pedidos</span>
    <span><strong className="text-foreground">{totalBudines}</strong> budines</span>
    <span>Venta: <strong className="text-primary">${totalVenta.toLocaleString('es-AR')}</strong></span>
  </div>
)}
```

**Después**:
```tsx
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

## Comportamiento

- Costo y Ganancia solo se muestran cuando `calc?.financials` está disponible (no muestra nada mientras carga)
- Ganancia positiva → verde (`text-green-500`), negativa → rojo (`text-destructive`)
- Sin pedidos → no se muestra la fila (comportamiento existente sin cambios)
- Sin recetas cargadas en los sabores → costo = 0, ganancia = venta total

## Alcance

- Un solo archivo modificado: `frontend/src/pages/Pedidos.tsx`
- Sin nuevos endpoints
- Sin nuevas queries
- Sin cambios de tipos
