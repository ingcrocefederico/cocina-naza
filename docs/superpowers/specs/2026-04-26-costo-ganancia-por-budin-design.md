# Costo y Ganancia por Budín

**Fecha:** 2026-04-26

## Objetivo

Mostrar en la página de Sabores el costo de producción y la ganancia por budín, calculados automáticamente en base a la receta (ingredientes y cantidades) y sus precios. Solo el precio de venta es editable.

## Datos

- `price_per_budin`: precio de venta (ya existe, editable)
- `cost_per_budin`: costo de producción = SUM(quantity_per_budin × price_per_unit) por receta
- `profit_per_budin`: ganancia = price_per_budin - cost_per_budin

Si el sabor no tiene receta cargada → cost_per_budin = 0, profit_per_budin = price_per_budin.

## Backend

### Cambios en `GET /api/flavors`

Modificar la query SQL para incluir LEFT JOIN con `recipe_items` e `ingredients` y calcular costo y ganancia:

```sql
SELECT
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
GROUP BY f.id, f.price_per_budin
ORDER BY f.created_at DESC
```

### Cambios en tipos (`backend/src/types.ts`)

Agregar a la interfaz `Flavor`:
- `cost_per_budin: string`
- `profit_per_budin: string`

## Frontend

### Tipos (`frontend/src/types.ts`)

Agregar a la interfaz `Flavor`:
- `cost_per_budin: string`
- `profit_per_budin: string`

### Card de sabor (`Sabores.tsx`)

Agregar fila de 3 valores debajo del nombre/emoji:

| Campo | Valor | Editable |
|-------|-------|----------|
| Venta | `price_per_budin` formateado en ARS | No (solo en form) |
| Costo | `cost_per_budin` formateado en ARS | No |
| Ganancia | `profit_per_budin` formateado en ARS | No |

- Ganancia positiva → texto verde
- Ganancia negativa → texto rojo
- Costo = 0 (sin receta) → mostrar "—" en gris

### Sheet de edición (`Sabores.tsx`)

Mostrar los 3 valores como read-only arriba del formulario de edición. Solo el campo de precio de venta permanece editable (comportamiento actual sin cambios).

## Alcance

- Sin nuevos endpoints
- Sin nuevas páginas
- Sin cambios en la lógica de pedidos ni del calculador existente
