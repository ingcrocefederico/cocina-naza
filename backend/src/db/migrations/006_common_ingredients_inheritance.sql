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
