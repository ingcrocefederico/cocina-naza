import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Client, ClientWithStats } from '../types'

export const clientsRouter = Router()

clientsRouter.use(requireAuth)

clientsRouter.get('/', async (_req, res) => {
  const [clientsRes, flavorsRes] = await Promise.all([
    query<Client & { debt: string; total_budines: string }>(
      `SELECT
         c.*,
         COALESCE(d.debt, 0) AS debt,
         COALESCE(tb.total_budines, 0) AS total_budines
       FROM clients c
       LEFT JOIN (
         SELECT client_id, SUM(COALESCE(sale_price, 0)) AS debt
         FROM orders
         WHERE status NOT IN ('cobrado', 'cobrado_efectivo', 'cobrado_transf') AND client_id IS NOT NULL
         GROUP BY client_id
       ) d ON d.client_id = c.id
       LEFT JOIN (
         SELECT o.client_id, SUM(oi.quantity) AS total_budines
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.client_id IS NOT NULL
         GROUP BY o.client_id
       ) tb ON tb.client_id = c.id
       ORDER BY c.name`
    ),
    query<{ client_id: string; flavor_name: string; emoji: string; quantity: string }>(
      `SELECT o.client_id, f.name AS flavor_name, f.emoji, SUM(oi.quantity) AS quantity
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN flavors f ON f.id = oi.flavor_id
       WHERE o.client_id IS NOT NULL
       GROUP BY o.client_id, f.id, f.name, f.emoji`
    ),
  ])

  const flavorsByClient: Record<string, { flavor_name: string; emoji: string; quantity: number }[]> = {}
  for (const row of flavorsRes.rows) {
    if (!flavorsByClient[row.client_id]) flavorsByClient[row.client_id] = []
    flavorsByClient[row.client_id].push({
      flavor_name: row.flavor_name,
      emoji: row.emoji,
      quantity: Number(row.quantity),
    })
  }

  const result: ClientWithStats[] = clientsRes.rows.map(c => ({
    ...c,
    debt: Number(c.debt),
    total_budines: Number(c.total_budines),
    budines_by_flavor: flavorsByClient[c.id] ?? [],
    estado: Number(c.debt) > 0 ? 'deudor' : 'al_dia',
  }))

  res.json(result)
})

clientsRouter.post('/', async (req, res) => {
  const { name, address, phone, notes } = req.body as {
    name?: string; address?: string; phone?: string; notes?: string
  }
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  const result = await query<Client>(
    `INSERT INTO clients (name, address, phone, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name.trim(), address || null, phone || null, notes || null]
  )
  res.status(201).json(result.rows[0])
})

clientsRouter.put('/:id', async (req, res) => {
  const { name, address, phone, notes } = req.body as {
    name?: string; address?: string; phone?: string; notes?: string
  }
  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: 'name cannot be empty' })
    return
  }
  const result = await query<Client>(
    `UPDATE clients SET
       name       = COALESCE($1, name),
       address    = $2,
       phone      = $3,
       notes      = $4,
       updated_at = now()
     WHERE id = $5 RETURNING *`,
    [name?.trim() ?? null, address || null, phone || null, notes || null, req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json(result.rows[0])
})

clientsRouter.delete('/:id', async (req, res) => {
  const result = await query<{ id: string }>('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id])
  if (!result.rows.length) {
    res.status(404).json({ error: 'Client not found' })
    return
  }
  res.json({ ok: true })
})
