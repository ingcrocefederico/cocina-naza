-- backend/src/db/migrations/002_clients.sql
CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_client_id ON orders(client_id);
