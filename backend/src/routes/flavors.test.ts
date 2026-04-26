import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))
vi.mock('../db/client', () => ({ query: mockQuery }))

import { flavorsRouter } from './flavors'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/flavors', flavorsRouter)
  return app
}

function authCookie() {
  const token = jwt.sign({ userId: 'user-1' }, 'test-secret')
  return `token=${token}`
}

describe('GET /api/flavors', () => {
  beforeEach(() => mockQuery.mockReset())

  it('requires auth', async () => {
    const res = await request(makeApp()).get('/api/flavors')
    expect(res.status).toBe(401)
  })

  it('returns list of flavors', async () => {
    const flavor = {
      id: 'f-1',
      name: 'Vainilla',
      emoji: '🍦',
      price_per_budin: '1500.00',
      active: true,
      cost_per_budin: '480.00',
      profit_per_budin: '1020.00',
    }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([flavor])
    expect(res.body[0].cost_per_budin).toBe('480.00')
    expect(res.body[0].profit_per_budin).toBe('1020.00')
  })

  it('returns cost 0 and profit equal to price when no recipe', async () => {
    const flavor = {
      id: 'f-2',
      name: 'Sin receta',
      emoji: '🍰',
      price_per_budin: '1000.00',
      active: true,
      cost_per_budin: '0.0000',
      profit_per_budin: '1000.0000',
    }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].cost_per_budin).toBe('0.0000')
    expect(res.body[0].profit_per_budin).toBe('1000.0000')
  })
})

describe('POST /api/flavors', () => {
  beforeEach(() => mockQuery.mockReset())

  it('creates a flavor and returns it', async () => {
    const created = { id: 'f-new', name: 'Limón', emoji: '🍋', price_per_budin: '1200.00', active: true }
    mockQuery.mockResolvedValue({ rows: [created] })
    const res = await request(makeApp())
      .post('/api/flavors')
      .set('Cookie', authCookie())
      .send({ name: 'Limón', emoji: '🍋', price_per_budin: 1200 })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Limón')
  })

  it('returns 400 if name is missing', async () => {
    const res = await request(makeApp())
      .post('/api/flavors')
      .set('Cookie', authCookie())
      .send({ emoji: '🍋' })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/flavors/:id', () => {
  beforeEach(() => mockQuery.mockReset())

  it('updates a flavor', async () => {
    const updated = { id: 'f-1', name: 'Limón Updated', emoji: '🍋', price_per_budin: '1300.00', active: true }
    mockQuery.mockResolvedValue({ rows: [updated] })
    const res = await request(makeApp())
      .put('/api/flavors/f-1')
      .set('Cookie', authCookie())
      .send({ name: 'Limón Updated', price_per_budin: 1300 })
    expect(res.status).toBe(200)
    expect(res.body.price_per_budin).toBe('1300.00')
  })
})

describe('DELETE /api/flavors/:id', () => {
  beforeEach(() => mockQuery.mockReset())

  it('soft-deletes a flavor', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'f-1' }] })
    const res = await request(makeApp())
      .delete('/api/flavors/f-1')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
  })
})
