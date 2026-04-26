# Cocina — Diseño del sistema de pedidos

**Fecha:** 2026-04-26
**Proyecto:** Naza / Cocina — gestión de pedidos de budines

---

## Contexto

App de gestión interna para un negocio de repostería (budines artesanales). Permite registrar pedidos por fecha, calcular ingredientes necesarios y estimar costos y ganancias.

---

## Stack

| Capa | Tecnología | Hosting |
|------|-----------|---------|
| Frontend | React + Vite + TypeScript + Tailwind + Shadcn + TanStack Query | Vercel (free) |
| Backend | Node.js + Express + TypeScript | Render (free) |
| Base de datos | PostgreSQL | Neon (free) |

**Estructura de repositorio:**
```
cocina/
├── frontend/   → deploy a Vercel
└── backend/    → deploy a Render
```

---

## Autenticación

- Google OAuth via Passport.js en el backend
- Al completar OAuth, el servidor emite un JWT en **httpOnly cookie** (no localStorage)
- El frontend detecta si hay sesión activa con un endpoint `GET /api/auth/me`
- Si no hay sesión → redirect a `/login`

---

## Modelo de datos

```sql
-- Usuarios
users (
  id          UUID PK,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  google_id   TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- Sabores de budín
flavors (
  id              UUID PK,
  name            TEXT NOT NULL,
  emoji           TEXT,
  price_per_budin NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
)

-- Ingredientes con precio
ingredients (
  id             UUID PK,
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK (unit IN ('kg','g','L','ml','unidad')),
  price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now()
)

-- Receta: cantidad de ingrediente por budín de X sabor
recipe_items (
  id                 UUID PK,
  flavor_id          UUID FK → flavors,
  ingredient_id      UUID FK → ingredients,
  quantity_per_budin NUMERIC(10,4) NOT NULL
)

-- Pedidos
orders (
  id           UUID PK,
  client_name  TEXT NOT NULL,
  address      TEXT,
  date         DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pedido','preparado','entregado','cobrado')) DEFAULT 'pedido',
  sale_price   NUMERIC(10,2),  -- pre-llenado automático, editable
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
)

-- Items del pedido
order_items (
  id        UUID PK,
  order_id  UUID FK → orders ON DELETE CASCADE,
  flavor_id UUID FK → flavors,
  quantity  INTEGER NOT NULL CHECK (quantity > 0)
)
```

**Cálculo del precio de venta por defecto:**
```
sale_price = SUM(order_items.quantity × flavors.price_per_budin)
```
El usuario puede editar `sale_price` libremente (descuentos, acuerdos).

**Cálculo de ingredientes para fecha X:**
```
total_ingrediente = SUM(order_items.quantity × recipe_items.quantity_per_budin)
  WHERE orders.date = X
  GROUP BY ingredient_id
```

---

## API REST (backend)

### Auth
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/auth/google` | Inicia OAuth con Google |
| GET | `/api/auth/google/callback` | Callback OAuth |
| GET | `/api/auth/me` | Devuelve usuario autenticado |
| POST | `/api/auth/logout` | Cierra sesión |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders?date=YYYY-MM-DD` | Lista pedidos por fecha |
| POST | `/api/orders` | Crear pedido (con items) |
| PUT | `/api/orders/:id` | Editar pedido |
| DELETE | `/api/orders/:id` | Eliminar pedido |

### Ingredientes (calculadora)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders/ingredients?date=YYYY-MM-DD` | Total + desglose por sabor |

### Ingredientes (precios)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/ingredients` | Lista ingredientes |
| PUT | `/api/ingredients/:id` | Actualizar precio |

### Sabores
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/flavors` | Lista sabores activos |
| POST | `/api/flavors` | Crear sabor |
| PUT | `/api/flavors/:id` | Editar sabor (nombre, emoji, precio) |
| DELETE | `/api/flavors/:id` | Eliminar sabor |

---

## Rutas del frontend

| Ruta | Descripción |
|------|-------------|
| `/login` | Pantalla Google OAuth |
| `/pedidos` | Lista de pedidos por fecha (default: hoy) |
| `/pedidos/nuevo` | Crear pedido |
| `/pedidos/:id` | Editar pedido |
| `/ingredientes` | Calculadora + precios |
| `/sabores` | CRUD de sabores (nombre, emoji, precio por budín) — necesario para pedidos |
| `/recetas` | Gestión de ingredientes y recetas por sabor (sección futura) |

---

## Pantallas detalladas

### `/pedidos`
- Date picker en el header (default = hoy)
- Lista de pedidos del día seleccionado
- Chips de estado con colores:
  - `pedido` → gris
  - `preparado` → amarillo
  - `entregado` → azul
  - `cobrado` → verde
- Click en chip → cambia estado inline (dropdown rápido)
- Botón "Nuevo pedido" → lleva a `/pedidos/nuevo` con la fecha actual seleccionada

### `/pedidos/nuevo` y `/pedidos/:id`
Formulario:
- **Nombre del cliente** — requerido
- **Dirección** — opcional
- **Fecha** — default = fecha seleccionada en `/pedidos`; editable
- **Estado** — default = `pedido`; dropdown
- **Tabla de budines** — filas dinámicas: sabor (select) + cantidad (número)
  - "Agregar sabor" suma una fila
  - Cada fila muestra el subtotal (cantidad × price_per_budin)
- **Precio de venta** — pre-llenado con suma de subtotales; siempre editable
- **Notas** — opcional

### `/sabores`
- Tabla de sabores: nombre, emoji, precio por budín
- Agregar / editar / eliminar sabores
- Sin sabores cargados, el formulario de pedidos no puede seleccionar budines

### `/ingredientes` — Tab "Calculadora"
- Date picker → carga pedidos del día
- **Total general:** lista de ingredientes con cantidad total (ej: "Harina: 2.5 kg")
- **Desglose por sabor:** por cada sabor, cuánto de cada ingrediente (ej: "Vainilla ×3 → Harina 750g, Huevos 6")
- **Resumen financiero del día:**
  - Costo total (suma de ingredientes × precios)
  - Venta total (suma de sale_price de pedidos del día)
  - Ganancia = venta - costo

### `/ingredientes` — Tab "Precios"
- Tabla de ingredientes con campos editables de precio/unidad
- Botón "Guardar" por fila o guardado automático al perder foco

---

## Estado global (frontend)

- **Fecha seleccionada** — almacenada en URL (`?date=YYYY-MM-DD`) para que sea compartible y persistente en navegación

---

## Fuera de scope (por ahora)

- Gestión de ingredientes y recetas por sabor (`/recetas` — segunda etapa)
- Sin recetas cargadas, la calculadora de ingredientes muestra totales vacíos (esperado hasta que se implemente `/recetas`)
- Notificaciones / alertas por pedido
- Exportar a PDF o WhatsApp
- Multi-usuario con roles
