-- 004_common_ingredients.sql

-- Schema changes
CREATE TABLE common_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_budin NUMERIC(10,4) NOT NULL,
  UNIQUE(ingredient_id)
);

ALTER TABLE flavors ADD COLUMN uses_common_ingredients BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN flavors.uses_common_ingredients IS
  'When true, this flavor inherits common_recipe_items and only stores overrides/exclusives in recipe_items.';

-- Data migration: auto-detect common ingredients from existing active flavors
-- An ingredient is "common" if it appears in ALL active flavors with the SAME quantity.

BEGIN;

WITH flavor_count AS (
  SELECT COUNT(*) AS total FROM flavors WHERE active = true
),
common_candidates AS (
  SELECT
    ri.ingredient_id,
    ri.quantity_per_budin,
    COUNT(DISTINCT ri.flavor_id) AS occurrences
  FROM recipe_items ri
  JOIN flavors f ON f.id = ri.flavor_id AND f.active = true
  GROUP BY ri.ingredient_id, ri.quantity_per_budin
),
detected AS (
  SELECT cc.ingredient_id, cc.quantity_per_budin
  FROM common_candidates cc
  CROSS JOIN flavor_count fc
  WHERE cc.occurrences = fc.total AND fc.total > 0
)
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin)
SELECT ingredient_id, quantity_per_budin FROM detected;

-- Remove those rows from recipe_items for active flavors (they are now in common_recipe_items)
DELETE FROM recipe_items
WHERE ingredient_id IN (SELECT ingredient_id FROM common_recipe_items)
  AND flavor_id IN (SELECT id FROM flavors WHERE active = true);

-- All active flavors had the full set of common ingredients by construction (occurrences = total above),
-- so flagging all active flavors is safe as long as common_recipe_items is non-empty.
UPDATE flavors SET uses_common_ingredients = true
WHERE active = true
  AND EXISTS (SELECT 1 FROM common_recipe_items);

COMMIT;
