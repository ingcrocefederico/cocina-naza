# Sheet de Receta por Budín

**Fecha:** 2026-04-26

## Objetivo

Agregar un botón "Receta" en cada card de la página de Sabores que abra un Sheet de solo lectura mostrando los ingredientes, cantidades y costos de la receta cargada para ese budín.

## Botón en la Card

- Ícono `ChefHat` (lucide-react) en `CardContent`, junto al botón de eliminar (Trash2)
- Click en el botón abre el Sheet de receta con `e.stopPropagation()` para no activar el click de edición de la card
- El botón siempre está visible (independiente del estado active de la row)

## Sheet de Receta (solo lectura)

**Header:** emoji + nombre del sabor

**Cuerpo:** tabla con columnas Ingrediente / Cantidad / Costo

- Cantidad: `quantity_per_budin` + `formatUnit(unit)`
- Costo por ítem: `quantity_per_budin × parseFloat(price_per_unit)` formateado en ARS
- Si `price_per_unit` es 0 → mostrar "—" en Costo
- Separador visual (Separator) entre lista e ítem de totales
- Fila total: Costo total (sum de costos), Precio de venta, Ganancia (venta - costo), con ganancia en verde/rojo

**Empty state:** si `recipe` está vacío → "Sin receta cargada aún."

**Footer:** ninguno (solo lectura, sin botones de acción)

## Datos

- Receta: `useFlavorRecipe(flavor.id)` — ya existe, devuelve `RecipeItem[]` con `ingredient_name`, `unit`, `quantity_per_budin`, y necesita `price_per_unit`
- **Problema:** `RecipeItem` actual NO incluye `price_per_unit`. El endpoint `GET /api/flavors/:id/recipe` no retorna el precio del ingrediente.
- **Solución:** Modificar la query SQL del endpoint de receta para incluir `i.price_per_unit` en el JOIN con `ingredients`.
- Tipos: agregar `price_per_unit: string` a `RecipeItem` en frontend y backend.
- `price_per_budin` y `cost_per_budin` ya vienen en el objeto `Flavor` (de la feature anterior).

## Estado del Sheet

- `recipeFlavorId: string | null` en el componente `Sabores` — el flavor cuya receta se está viendo
- `recipeOpen: boolean` para controlar visibilidad del Sheet
- Al abrir: `setRecipeFlavorId(flavor.id)`, `setRecipeOpen(true)`
- Al cerrar: `setRecipeOpen(false)`, `setRecipeFlavorId(null)`
- El hook `useFlavorRecipe(recipeFlavorId)` se activa solo cuando `recipeFlavorId` es no-null

## Archivos

- `backend/src/routes/flavors.ts` — agregar `i.price_per_unit` al SELECT del endpoint `GET /:id/recipe`
- `backend/src/types.ts` — agregar `price_per_unit: string` a `RecipeItem`
- `frontend/src/types.ts` — agregar `price_per_unit: string` a `RecipeItem`
- `frontend/src/pages/Sabores.tsx` — botón en card + Sheet de receta + estado

## Alcance

- Sin nuevas páginas ni hooks nuevos
- Sin edición desde el Sheet de receta
- Sin cambios en Pedidos, Ingredientes ni otros archivos
