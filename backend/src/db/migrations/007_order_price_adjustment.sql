-- 007_order_price_adjustment.sql
-- Add optional base price + percent adjustment columns to orders.
-- sale_price keeps storing the effective (final) price used by all downstream
-- reads (totals, calculator, PDFs). The new columns let the form reload the
-- original base + pct so the user can edit them.

BEGIN;

ALTER TABLE orders
  ADD COLUMN base_sale_price       NUMERIC(10,2),
  ADD COLUMN price_adjustment_pct  NUMERIC(6,2);

COMMIT;
