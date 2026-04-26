import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))
vi.mock('../db/client', () => ({ query: mockQuery }))

import { ordersRouter } from './orders'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/orders', ordersRouter)
  return app
}

function authCookie() {
  return `token=${jwt.sign({ userId: 'user-1' }, 'test-secret')}`
}

const sampleOrder = {
  id: 'o-1', client_name: 'María', address: null, date: '2026-04-26',
  status: 'pedido', sale_price: '1500.00', notes: null,
  created_at: '2026-04-26T00:00:00Z', updated_at: '2026-04-26T00:00:00Z',
}

const sampleItems = [{ flavor_id: 'f-1', flavor_name: 'Vainilla', flavor_emoji: '🍦', quantity: 2, price_per_budin: '1500.00' }]

describe('GET /api/orders', () => {
  beforeEach(() => mockQuery.mockReset())

  it('requires auth', async () => {
    const res = await request(makeApp()).get('/api/orders')
    expect(res.status).toBe(401)
  })

  it('requires date param', async () => {
    const res = await request(makeApp()).get('/api/orders').set('Cookie', authCookie())
    expect(res.status).toBe(400)
  })

  it('returns orders for a date with items', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleOrder] })       // SELECT orders
      .mockResolvedValueOnce({ rows: sampleItems })          // SELECT items for order
    const res = await request(makeApp()).get('/api/orders?date=2026-04-26').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].items).toHaveLength(1)
  })
})

describe('POST /api/orders', () => {
  beforeEach(() => mockQuery.mockReset())

  it('creates order with items', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleOrder] })   // INSERT order
      .mockResolvedValueOnce({ rows: [] })               // INSERT items
      .mockResolvedValueOnce({ rows: [sampleOrder] })   // SELECT order for fetchWithItems
      .mockResolvedValueOnce({ rows: sampleItems })      // SELECT items
    const res = await request(makeApp())
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ client_name: 'María', date: '2026-04-26', items: [{ flavor_id: 'f-1', quantity: 2 }] })
    expect(res.status).toBe(201)
    expect(res.body.client_name).toBe('María')
  })

  it('returns 400 if client_name missing', async () => {
    const res = await request(makeApp())
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ date: '2026-04-26', items: [] })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/orders/:id', () => {
  beforeEach(() => mockQuery.mockReset())

  it('updates order status', async () => {
    const updated = { ...sampleOrder, status: 'preparado' }
    mockQuery
      .mockResolvedValueOnce({ rows: [updated] })  // UPDATE order
      .mockResolvedValueOnce({ rows: [] })          // DELETE old items
      .mockResolvedValueOnce({ rows: [] })          // INSERT new items
      .mockResolvedValueOnce({ rows: [updated] })  // SELECT order for fetchWithItems
      .mockResolvedValueOnce({ rows: sampleItems }) // SELECT items
    const res = await request(makeApp())
      .put('/api/orders/o-1')
      .set('Cookie', authCookie())
      .send({ status: 'preparado', items: [{ flavor_id: 'f-1', quantity: 2 }] })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/orders/:id', () => {
  beforeEach(() => mockQuery.mockReset())

  it('deletes an order', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/orders/o-1')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
  })
})
