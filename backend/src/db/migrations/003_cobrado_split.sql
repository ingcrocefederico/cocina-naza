-- Split 'cobrado' into 'cobrado_efectivo' and 'cobrado_transf'
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status IN%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pedido','preparado','entregado','cobrado','cobrado_efectivo','cobrado_transf'));
