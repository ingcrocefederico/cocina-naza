import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Order, OrderWithItems } from '../types'

export const ordersRouter = Router()

ordersRouter.use(requireAuth)

type ItemRow = { id: string; order_id: string; flavor_id: string; flavor_name: string; flavor_emoji: string; quantity: number; price_per_budin: string }

async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const orderRes = await query<Order>('SELECT * FROM orders WHERE id = $1', [orderId])
  if (!orderRes.rows.length) return null
  const itemsRes = await query<ItemRow>(
    `SELECT oi.id, oi.order_id, oi.flavor_id, f.name AS flavor_name, f.emoji AS flavor_emoji,
            oi.quantity, f.price_per_budin
     FROM order_items oi
     JOIN flavors f ON f.id = oi.flavor_id
     WHERE oi.order_id = $1`,
    [orderId]
  )
  return { ...orderRes.rows[0], items: itemsRes.rows }
}

ordersRouter.get('/latest-date', async (_req, res) => {
  const result = await query<{ date: string }>(
    `SELECT date::text FROM orders ORDER BY date DESC, created_at DESC LIMIT 1`
  )
  res.json({ date: result.rows[0]?.date ?? null })
})

ordersRouter.get('/by-client/:clientId', async (req, res) => {
  const ordersRes = await query<Order>(
    `SELECT * FROM orders WHERE client_id = $1 ORDER BY date DESC, created_at DESC`,
    [req.params.clientId]
  )
  const ordersWithItems = await Promise.all(
    ordersRes.rows.map(async (order) => {
      const itemsRes = await query<ItemRow>(
        `SELECT oi.id, oi.order_id, oi.flavor_id, f.name AS flavor_name, f.emoji AS flavor_emoji,
                oi.quantity, f.price_per_budin
         FROM order_items oi
         JOIN flavors f ON f.id = oi.flavor_id
         WHERE oi.order_id = $1`,
        [order.id]
      )
      return { ...order, items: itemsRes.rows }
    })
  )
  res.json(ordersWithItems)
})

ordersRouter.get('/', async (req, res) => {
  const { date } = req.query
  if (!date) {
    res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    return
  }
  const ordersRes = await query<Order>('SELECT * FROM orders WHERE date = $1 ORDER BY created_at', [date as string])
  const ordersWithItems = await Promise.all(
    ordersRes.rows.map(async (order) => {
      const itemsRes = await query<ItemRow>(
        `SELECT oi.id, oi.order_id, oi.flavor_id, f.name AS flavor_name, f.emoji AS flavor_emoji,
                oi.quantity, f.price_per_budin
         FROM order_items oi
         JOIN flavors f ON f.id = oi.flavor_id
         WHERE oi.order_id = $1`,
        [order.id]
      )
      return { ...order, items: itemsRes.rows }
    })
  )
  res.json(ordersWithItems)
})

ordersRouter.get('/counts', async (req, res) => {
  const month = req.query.month as string | undefined
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'month query param required (YYYY-MM)' })
    return
  }
  const result = await query<{ date: string; count: number }>(
    `SELECT date::text AS date, COUNT(*)::int AS count
     FROM orders
     WHERE date >= ($1 || '-01')::date AND date < ($1 || '-01')::date + INTERVAL '1 month'
     GROUP BY date`,
    [month]
  )
  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    counts[row.date] = row.count
  }
  res.json(counts)
})

ordersRouter.post('/', async (req, res) => {
  const { client_id, client_name: bodyClientName, address, date, status = 'pedido', sale_price, notes, items = [] } = req.body as {
    client_id?: string; client_name?: string; address?: string; date?: string; status?: string;
    sale_price?: number; notes?: string; items?: { flavor_id: string; quantity: number }[]
  }
  if (!date) {
    res.status(400).json({ error: 'date is required' })
    return
  }

  let client_name = bodyClientName ?? null
  if (client_id) {
    const clientRes = await query<{ name: string }>('SELECT name FROM clients WHERE id = $1', [client_id])
    if (!clientRes.rows.length) {
      res.status(400).json({ error: 'Client not found' })
      return
    }
    client_name = clientRes.rows[0].name
  }
  if (!client_name) {
    res.status(400).json({ error: 'client_id or client_name is required' })
    return
  }

  const orderRes = await query<{ id: string }>(
    `INSERT INTO orders (client_name, client_id, address, date, status, sale_price, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [client_name, client_id ?? null, address ?? null, date, status, sale_price ?? null, notes ?? null]
  )
  const order = orderRes.rows[0]

  if (items.length > 0) {
    const values = items.map((_: unknown, i: number) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
    const params = items.flatMap((item) => [order.id, item.flavor_id, item.quantity])
    await query(`INSERT INTO order_items (order_id, flavor_id, quantity) VALUES ${values}`, params)
  }

  const result = await fetchOrderWithItems(order.id)
  res.status(201).json(result)
})

ordersRouter.put('/:id', async (req, res) => {
  const { client_id, client_name: bodyClientName, address, date, status, sale_price, notes, items } = req.body as {
    client_id?: string; client_name?: string; address?: string; date?: string; status?: string;
    sale_price?: number; notes?: string; items?: { flavor_id: string; quantity: number }[]
  }

  let resolvedClientName: string | null = bodyClientName ?? null
  if (client_id) {
    const clientRes = await query<{ name: string }>('SELECT name FROM clients WHERE id = $1', [client_id])
    if (!clientRes.rows.length) {
      res.status(400).json({ error: 'Client not found' })
      return
    }
    resolvedClientName = clientRes.rows[0].name
  }

  const orderRes = await query<{ id: string }>(
    `UPDATE orders SET
       client_name = COALESCE($1, client_name),
       client_id   = COALESCE($2, client_id),
       address     = COALESCE($3, address),
       date        = COALESCE($4, date),
       status      = COALESCE($5, status),
       sale_price  = COALESCE($6, sale_price),
       notes       = COALESCE($7, notes),
       updated_at  = now()
     WHERE id = $8 RETURNING id`,
    [resolvedClientName, client_id ?? null, address ?? null, date ?? null, status ?? null, sale_price ?? null, notes ?? null, req.params.id]
  )
  if (!orderRes.rows.length) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  if (Array.isArray(items)) {
    await query('DELETE FROM order_items WHERE order_id = $1', [req.params.id])
    if (items.length > 0) {
      const values = items.map((_: unknown, i: number) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
      const params = items.flatMap((item) => [req.params.id, item.flavor_id, item.quantity])
      await query(`INSERT INTO order_items (order_id, flavor_id, quantity) VALUES ${values}`, params)
    }
  }

  const result = await fetchOrderWithItems(req.params.id)
  res.json(result)
})

ordersRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM orders WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})
