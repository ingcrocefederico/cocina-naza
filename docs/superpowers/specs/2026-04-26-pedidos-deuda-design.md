# Deuda en Pedidos

**Fecha:** 2026-04-26

## Objetivo

Mostrar el total de deuda del día en la fila de totalizadores de Pedidos: suma de `sale_price` de todos los pedidos con estado distinto a "cobrado".

## Datos

```
deuda = orders
  .filter(o => o.status !== 'cobrado')
  .reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)
```

- Se calcula en el frontend con los `orders` ya disponibles
- Sin nuevos endpoints ni queries

## Cambio

### Solo frontend — `frontend/src/pages/Pedidos.tsx`

Agregar la variable `deuda` junto a `totalBudines` y `totalVenta` (líneas 70-71), y agregar un nuevo `<span>` al final de la fila de totalizadores.

**Variable nueva** (línea ~72):
```typescript
const deuda = orders
  .filter(o => o.status !== 'cobrado')
  .reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)
```

**Span nuevo** en la fila de totalizadores, al final (después de Gan.):
```tsx
<span>Deuda: <strong className="text-amber-500">${deuda.toLocaleString('es-AR')}</strong></span>
```

## Comportamiento

- Siempre visible cuando hay pedidos (aunque sea $0)
- Color amber (`text-amber-500`) para distinguirla de venta (primary) y ganancia (verde/rojo)
- Sin cambios en el resto de la página
