import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))
vi.mock('../db/client', () => ({ query: mockQuery }))

import { ingredientsRouter } from './ingredients'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/ingredients', ingredientsRouter)
  return app
}

function authCookie() {
  return `token=${jwt.sign({ userId: 'user-1' }, 'test-secret')}`
}

describe('GET /api/ingredients', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns ingredient list', async () => {
    const ingredients = [{ id: 'i-1', name: 'Harina', unit: 'kg', price_per_unit: '500.00' }]
    mockQuery.mockResolvedValue({ rows: ingredients })
    const res = await request(makeApp()).get('/api/ingredients').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /api/ingredients/:id', () => {
  beforeEach(() => mockQuery.mockReset())

  it('updates price_per_unit', async () => {
    const updated = { id: 'i-1', name: 'Harina', unit: 'kg', price_per_unit: '600.00' }
    mockQuery.mockResolvedValue({ rows: [updated] })
    const res = await request(makeApp())
      .put('/api/ingredients/i-1')
      .set('Cookie', authCookie())
      .send({ price_per_unit: 600 })
    expect(res.status).toBe(200)
    expect(res.body.price_per_unit).toBe('600.00')
  })
})

describe('GET /api/ingredients/calculator', () => {
  beforeEach(() => mockQuery.mockReset())

  it('requires date param', async () => {
    const res = await request(makeApp()).get('/api/ingredients/calculator').set('Cookie', authCookie())
    expect(res.status).toBe(400)
  })

  it('returns totals, byFlavor, and financials', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'i-1', name: 'Harina', unit: 'kg', price_per_unit: '500.00', total_quantity: '2.5' }] })
      .mockResolvedValueOnce({ rows: [{ flavor_id: 'f-1', flavor_name: 'Vainilla', budin_count: '3', ingredient_id: 'i-1', ingredient_name: 'Harina', unit: 'kg', total_quantity: '2.5' }] })
      .mockResolvedValueOnce({ rows: [{ total_sales: '4500.00' }] })
    const res = await request(makeApp())
      .get('/api/ingredients/calculator?date=2026-04-26')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('totals')
    expect(res.body).toHaveProperty('byFlavor')
    expect(res.body).toHaveProperty('financials')
    expect(res.body.financials.totalSales).toBe(4500)
  })
})
