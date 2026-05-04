# Common Ingredients for Budines

## Overview

Extract ingredients that appear in all budines with the same quantity into a shared `common_recipe_items` table. Each budin can opt into inheriting these common ingredients, override individual ones with a different quantity, and still maintain its own exclusive ingredients.

## Database Schema

### New migration: `004_common_ingredients.sql`

```sql
CREATE TABLE common_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_budin NUMERIC(10,4) NOT NULL,
  UNIQUE(ingredient_id)
);

ALTER TABLE flavors ADD COLUMN uses_common_ingredients BOOLEAN NOT NULL DEFAULT false;
```

### Existing tables (unchanged)

- `recipe_items`: remains as-is; when a budin has `uses_common_ingredients = true`, its rows here are treated as overrides only.
- `ingredients`: unchanged.
- `flavors`: gains `uses_common_ingredients` column.

### Data migration (one-time script)

1. Find all ingredients present in every active flavor with the same `quantity_per_budin`.
2. Insert those into `common_recipe_items`.
3. Delete their `recipe_items` rows from budines that had the exact common quantity (no override needed).
4. Set `uses_common_ingredients = true` on every active flavor that had the full set of common ingredients.

## Backend API

### New: `GET /api/common-recipe`
Returns all rows in `common_recipe_items` joined with ingredient details.

### New: `PUT /api/common-recipe`
Replaces all common recipe items (same pattern as flavor recipe PUT). Updates propagate to all budines automatically on the next recipe fetch.

### Modified: `GET /api/flavors/:id/recipe`

When `uses_common_ingredients = true`:
1. Fetch all `common_recipe_items`.
2. Fetch the budin's own `recipe_items` (overrides + exclusive ingredients).
3. Merge: for each common ingredient, if a matching `recipe_items` row exists → use override; otherwise use common value.
4. Each item in the response includes:
   - `is_common: boolean` — ingredient comes from `common_recipe_items`
   - `is_overridden: boolean` — budin has its own quantity for this common ingredient

### Modified: `PUT /api/flavors/:id/recipe`

Accepts the same payload as today but only persists non-common ingredients and overrides. Pure common items (unchanged quantity) are not stored in `recipe_items`.

### Modified: `GET /api/flavors` (cost calculation)

`cost_per_budin` must apply the same merge logic: sum common ingredients (with override if present) + exclusive `recipe_items`.

## Frontend UI

### Recipe editor (`Sabores.tsx`)

**"Ingredientes comunes" section (top)**
- Only shown when `uses_common_ingredients = true`.
- Each row displays ingredient name, unit, quantity, and a lock icon.
- Lock closed → quantity is the common value (read-only).
- Click lock → opens to override mode: input pre-filled with common quantity, lock shows open.
- Saving an override writes a `recipe_items` row for that budin.
- Removing an override deletes that `recipe_items` row and reverts to the common value.

**"Ingredientes propios" section (bottom)**
- Unchanged from current behavior.
- Shows ingredients not present in `common_recipe_items`.

**Toggle: "Usar ingredientes comunes"**
- Checkbox/switch in the recipe header.
- Toggling on sets `uses_common_ingredients = true` and displays the common section.
- Toggling off hides the section but does not delete any overrides (so re-enabling restores them).

### Common ingredients management

A dedicated section in the `Ingredientes` page to view and edit `common_recipe_items`. Uses the same recipe-item editor component, sourced from `/api/common-recipe`. Changes here propagate instantly to all budines that use them.

## Data Flow

```
Edit common quantity
  → PUT /api/common-recipe
  → All budines using common ingredients reflect new value immediately (no recipe_items rows updated)

Edit budin recipe (override)
  → PUT /api/flavors/:id/recipe
  → Saves only overrides + exclusive items

Create new budin
  → uses_common_ingredients = false by default
  → User can toggle on to inherit common ingredients
  → Can then override individual ones or add exclusive ones

GET /api/flavors/:id/recipe
  → merge(common_recipe_items, recipe_items overrides) + exclusive recipe_items
```

## Cost Calculation Impact

`cost_per_budin` for flavors that use common ingredients:

```
cost = SUM(
  merged_recipe_items.quantity_per_budin * ingredients.price_per_unit
)
```

Where `merged_recipe_items` = common items (overridden where applicable) + exclusive items.

## Out of Scope

- Auto-promoting an ingredient to "common" if it's later added to all budines manually (manual management only via the common recipe editor).
- Partial common sets (an ingredient is either common to all or not common at all).
