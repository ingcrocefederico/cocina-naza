# Diseño: Módulo de Clientes

**Fecha:** 2026-04-27  
**Estado:** Aprobado

---

## Resumen

Agregar un módulo de gestión de clientes (Clientes) accesible desde la pestaña Pedidos. Los clientes tienen datos básicos, estado de deuda calculado automáticamente desde sus pedidos, y estadísticas de compras por sabor. El formulario de nuevo pedido reemplaza el campo de texto libre por un selector de cliente.

---

## 1. Base de Datos

### Nueva tabla `clients`

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migración en `orders`

```sql
ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
```

`client_name` permanece en `orders` para compatibilidad con pedidos históricos. Al crear/editar un pedido con `client_id`, el backend auto-popula `client_name` desde el cliente.

---

## 2. Backend

### Nuevo archivo: `backend/src/routes/clients.ts`

Endpoints bajo `/api/clients`, todos protegidos con `requireAuth`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista todos los clientes con stats calculadas |
| POST | `/` | Crear cliente |
| PUT | `/:id` | Editar cliente |
| DELETE | `/:id` | Eliminar cliente |

### Stats calculadas en GET /api/clients

Para cada cliente se calcula via JOIN:
- `debt`: `SUM(sale_price)` de órdenes donde `status != 'cobrado'` y `client_id = X`
- `total_budines`: suma total de `order_items.quantity` de órdenes del cliente
- `budines_by_flavor`: `[{ flavor_name, emoji, quantity }]` agrupado por sabor (de todas las órdenes, no solo deudoras)
- `estado`: `'deudor'` si `debt > 0`, `'al_dia'` si `debt = 0`

### Tipos TypeScript nuevos (`backend/src/types.ts`)

```typescript
interface Client {
  id: string
  name: string
  address?: string
  phone?: string
  notes?: string
  created_at: string
}

interface ClientWithStats extends Client {
  debt: number
  total_budines: number
  budines_by_flavor: { flavor_name: string; emoji: string; quantity: number }[]
  estado: 'deudor' | 'al_dia'
}
```

### Cambios en `backend/src/routes/orders.ts`

- `POST` y `PUT` aceptan `client_id` (opcional por compatibilidad)
- Si `client_id` presente: backend busca cliente y popula `client_name` automáticamente
- `client_name` sigue siendo requerido en DB; se resuelve desde el cliente o del body

---

## 3. Frontend

### Routing (`frontend/src/App.tsx`)

Nueva ruta protegida: `/clientes` → `<Clientes />`

### Navegación desde Pedidos

Botón "Clientes" en el header de la página Pedidos (junto al ícono de ingredientes existente). Usa `navigate('/clientes')`.

### Nueva página: `frontend/src/pages/Clientes.tsx`

**Header:** flecha back + título "Clientes" + botón "+" (abre bottom sheet de alta)

**Controles:**
- Search input: filtra por nombre o teléfono (client-side)
- Filter chips: `Todos` | `Deudores` | `Al día`

**Lista de cards:** cada card muestra:
- Nombre + teléfono (si tiene)
- Badge de estado: `Deudor` (rojo) | `Al día` (verde)
- Monto adeudado si `estado === 'deudor'` (ej: `$3.500 adeudado`)
- Desglose de budines por sabor (ej: `🍫 ×4 · 🍋 ×2`)
- Botones: Editar (abre bottom sheet) | Eliminar (AlertDialog de confirmación)

**Bottom Sheet (alta y edición):**
- Nombre y apellido * (requerido)
- Teléfono (opcional)
- Dirección (opcional)
- Notas (opcional, textarea)

### Nuevo hook: `frontend/src/hooks/useClients.ts`

Mismo patrón que `useOrders`/`useFlavors`:
- `useQuery` para lista de clientes
- `useMutation` para create, update, delete con invalidación de caché

### Cambios en `frontend/src/pages/PedidoForm.tsx`

**Reemplazo del campo cliente:**
- `<Input client_name>` → `<SelectSheet>` searchable con lista de clientes
- Cada opción muestra: nombre + teléfono
- `onCreate` abre bottom sheet de nuevo cliente inline; al guardar selecciona el cliente recién creado
- Al seleccionar cliente: auto-completa el campo `address` del pedido si el cliente tiene dirección

**Schema Zod:**
- `client_name: z.string().min(1)` → `client_id: z.string().min(1, 'Cliente requerido')`

**API call:**
- Envía `client_id` en lugar de `client_name`

### Tipos frontend (`frontend/src/types.ts`)

Agregar `Client` y `ClientWithStats` equivalentes a los del backend.

---

## 4. Criterio de deuda

Un cliente es **deudor** cuando tiene al menos un pedido con `status` distinto de `'cobrado'` y `sale_price > 0`. La deuda es la suma de `sale_price` de esos pedidos.

---

## 5. Compatibilidad con datos históricos

- Pedidos existentes mantienen `client_name` como texto libre y `client_id = NULL`
- No se migran pedidos históricos a clientes
- El buscador en Pedidos.tsx sigue funcionando con `client_name`
