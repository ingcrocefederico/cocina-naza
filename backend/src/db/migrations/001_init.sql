CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  avatar_url TEXT,
  google_id  TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE flavors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL DEFAULT '',
  price_per_budin NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK (unit IN ('kg','g','L','ml','unidad')),
  price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipe_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flavor_id          UUID NOT NULL REFERENCES flavors(id) ON DELETE CASCADE,
  ingredient_id      UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_budin NUMERIC(10,4) NOT NULL,
  UNIQUE(flavor_id, ingredient_id)
);

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  address     TEXT,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pedido'
                CHECK (status IN ('pedido','preparado','entregado','cobrado')),
  sale_price  NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  flavor_id UUID NOT NULL REFERENCES flavors(id),
  quantity  INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_orders_date ON orders(date);
