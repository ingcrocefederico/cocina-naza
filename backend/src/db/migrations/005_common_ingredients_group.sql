-- 005_common_ingredients_group.sql

BEGIN;

-- Add applies_to column; existing rows (Descartables, Huevos) default to 'all'
ALTER TABLE common_recipe_items
  ADD COLUMN applies_to TEXT NOT NULL DEFAULT 'all'
  CHECK (applies_to IN ('all', 'integral'));

-- ─── New 'all' common items ────────────────────────────────────────────────
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 70, 'all' FROM ingredients i WHERE i.name = 'Manteca';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 60, 'all' FROM ingredients i WHERE i.name = 'Leche';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 5, 'all' FROM ingredients i WHERE i.name = 'Polvo de hornear';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 140, 'all' FROM ingredients i WHERE i.name = 'Azúcar';

-- ─── New 'integral' common items ──────────────────────────────────────────
INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 100, 'integral' FROM ingredients i WHERE i.name = 'Harina 0000';

INSERT INTO common_recipe_items (ingredient_id, quantity_per_budin, applies_to)
SELECT i.id, 100, 'integral' FROM ingredients i WHERE i.name = 'Harina integral';

-- ─── Remove recipe_items rows now covered by 'all' common items ───────────
-- Affects any active budin that had Manteca 70, Leche 60, Polvo 5, Azúcar 140
-- (those rows are now inherited; Coco's Azúcar 120 differs → stays as override)
DELETE FROM recipe_items ri
USING flavors f, common_recipe_items cri
WHERE ri.flavor_id = f.id
  AND f.active = true
  AND f.uses_common_ingredients = true
  AND ri.ingredient_id = cri.ingredient_id
  AND cri.applies_to = 'all'
  AND ri.quantity_per_budin = cri.quantity_per_budin;

-- ─── Remove recipe_items rows now covered by 'integral' common items ──────
-- Affects integral budines with Harina 0000 = 100 or Harina integral = 100
-- ((Int) Carrot Cake 70g and (Int) Coco 60g are different → stay as overrides)
DELETE FROM recipe_items ri
USING flavors f, common_recipe_items cri
WHERE ri.flavor_id = f.id
  AND f.active = true
  AND f.uses_common_ingredients = true
  AND f.name LIKE '(Int)%'
  AND ri.ingredient_id = cri.ingredient_id
  AND cri.applies_to = 'integral'
  AND ri.quantity_per_budin = cri.quantity_per_budin;

-- ─── Exclusion markers for Carrot Cake ────────────────────────────────────
-- Carrot Cake uses Aceite, NOT Manteca/Leche/Polvo de hornear.
-- Without these markers it would incorrectly inherit those from the 'all' set.
INSERT INTO recipe_items (flavor_id, ingredient_id, quantity_per_budin)
SELECT f.id, i.id, 0
FROM flavors f
CROSS JOIN ingredients i
WHERE f.name IN ('Carrot Cake', '(Int) Carrot Cake')
  AND i.name IN ('Manteca', 'Leche', 'Polvo de hornear')
ON CONFLICT (flavor_id, ingredient_id) DO NOTHING;

COMMIT;
