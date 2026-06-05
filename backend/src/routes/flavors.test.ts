import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))
vi.mock('../db/client', () => ({
  query: mockQuery,
  // Run the transactional callback against the same mocked query so tests can
  // assert the DELETE/INSERT statements issued inside the transaction.
  withTransaction: (fn: (q: typeof mockQuery) => unknown) => fn(mockQuery),
}))

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

describe('GET /api/flavors — integral cost CTE', () => {
  beforeEach(() => mockQuery.mockReset())

  it('excludes qty=0 exclusion markers from cost', async () => {
    const flavor = {
      id: 'f-int',
      name: '(Int) Vainilla',
      emoji: '🍦',
      price_per_budin: '1500.00',
      active: true,
      cost_per_budin: '300.00',
      profit_per_budin: '1200.00',
      uses_common_ingredients: true,
    }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].cost_per_budin).toBe('300.00')
  })

  it('uses integral quantity when same ingredient is in both all and integral layers', async () => {
    const flavor = {
      id: 'f-int',
      name: '(Int) Vainilla',
      emoji: '🍦',
      price_per_budin: '1500.00',
      active: true,
      cost_per_budin: '200.00',
      profit_per_budin: '1300.00',
      uses_common_ingredients: true,
    }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].cost_per_budin).toBe('200.00')
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

describe('GET /api/flavors/:id/recipe', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns recipe items with price_per_unit', async () => {
    const item = {
      id: 'ri-1',
      ingredient_id: 'ing-1',
      ingredient_name: 'Harina',
      unit: 'kg',
      quantity_per_budin: 0.5,
      price_per_unit: '1200.00',
      is_common: false,
      is_overridden: false,
      is_deleted: false,
    }
    // First query: flavor lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: false, is_integral: false }] })
    // Second query: recipe items
    mockQuery.mockResolvedValueOnce({ rows: [item] })
    const res = await request(makeApp())
      .get('/api/flavors/f-1/recipe')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].price_per_unit).toBe('1200.00')
    expect(res.body[0].is_deleted).toBe(false)
  })

  it('returns own recipe items with is_common=false when uses_common_ingredients=false', async () => {
    // First query: flavor lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: false, is_integral: false }] })
    // Second query: recipe items
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 500, price_per_unit: '0.005', is_common: false, is_overridden: false, is_deleted: false },
      ],
    })
    const app = makeApp()
    const res = await request(app).get('/api/flavors/f-1/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].is_common).toBe(false)
    expect(res.body[0].is_overridden).toBe(false)
  })

  it('returns 404 when flavor not found in GET /:id/recipe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const app = makeApp()
    const res = await request(app).get('/api/flavors/nonexistent/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(404)
  })

  it('merges common and override items when uses_common_ingredients=true', async () => {
    // First query: flavor lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: false }] })
    // commonRes: 2 common ingredients
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 500, price_per_unit: '0.005' },
        { ingredient_id: 'ing-2', ingredient_name: 'Huevos', unit: 'unidad', quantity_per_budin: 2, price_per_unit: '1.00' },
      ],
    })
    // recipeRes: one override for ing-1, one exclusive ing-3
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 600, price_per_unit: '0.005' },
        { id: 'ri-3', ingredient_id: 'ing-3', ingredient_name: 'Vainilla', unit: 'ml', quantity_per_budin: 10, price_per_unit: '2.00' },
      ],
    })
    const app = makeApp()
    const res = await request(app).get('/api/flavors/f-1/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    // ing-1: common with override
    const harina = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-1')
    expect(harina.is_common).toBe(true)
    expect(harina.is_overridden).toBe(true)
    expect(harina.quantity_per_budin).toBe(600)
    // ing-2: common without override
    const huevos = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-2')
    expect(huevos.is_common).toBe(true)
    expect(huevos.is_overridden).toBe(false)
    expect(huevos.id).toBeNull()
    // ing-3: exclusive
    const vainilla = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-3')
    expect(vainilla.is_common).toBe(false)
    expect(vainilla.is_overridden).toBe(false)
    // all items should have is_deleted=false
    expect(res.body.every((r: { is_deleted: boolean }) => !r.is_deleted)).toBe(true)
  })
})

describe('GET /api/flavors/:id/recipe — integral + is_deleted', () => {
  beforeEach(() => mockQuery.mockReset())

  it('includes integral common items for integral flavors', async () => {
    // flavor lookup — is_integral: true
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: true }] })
    // commonRes: one 'all' + one 'integral' item (the query filters by applies_to)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-1', ingredient_name: 'Huevos', unit: 'unidad', quantity_per_budin: 2, price_per_unit: '1.00' },
        { ingredient_id: 'ing-2', ingredient_name: 'Harina integral', unit: 'g', quantity_per_budin: 100, price_per_unit: '0.003' },
      ],
    })
    // recipeRes: empty (no overrides)
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/flavors/f-int/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((r: { is_common: boolean }) => r.is_common)).toBe(true)
    expect(res.body.every((r: { is_deleted: boolean }) => r.is_deleted === false)).toBe(true)
  })

  it('uses integral layer quantity when same ingredient exists in both all and integral', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: true }] })
    // DISTINCT ON already resolved — only one row per ingredient, integral wins
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-azucar', ingredient_name: 'Azúcar', unit: 'g', quantity_per_budin: 100, price_per_unit: '0.001' },
      ],
    })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/flavors/f-int/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    const azucar = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-azucar')
    expect(azucar.quantity_per_budin).toBe(100)
    expect(azucar.is_common).toBe(true)
    expect(azucar.is_overridden).toBe(false)
    expect(azucar.is_deleted).toBe(false)
  })

  it('returns is_deleted=true for qty=0 override and includes it in response', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ uses_common_ingredients: true, is_integral: false }] })
    // commonRes: Manteca
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ingredient_id: 'ing-manteca', ingredient_name: 'Manteca', unit: 'g', quantity_per_budin: 70, price_per_unit: '0.01' },
      ],
    })
    // recipeRes: qty=0 exclusion marker for Manteca
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ri-x', ingredient_id: 'ing-manteca', ingredient_name: 'Manteca', unit: 'g', quantity_per_budin: 0, price_per_unit: '0.01' },
      ],
    })
    const res = await request(makeApp()).get('/api/flavors/f-1/recipe').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    const manteca = res.body.find((r: { ingredient_id: string }) => r.ingredient_id === 'ing-manteca')
    expect(manteca.is_deleted).toBe(true)
    expect(manteca.is_common).toBe(true)
    expect(manteca.is_overridden).toBe(false)
  })
})

describe('PUT /api/flavors/:id/recipe', () => {
  beforeEach(() => mockQuery.mockReset())

  function insertCallParams() {
    const call = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO recipe_items'))
    return call ? (call[1] as unknown[]) : null
  }

  it('saves recipe items (DELETE then INSERT then SELECT)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const res = await request(makeApp())
      .put('/api/flavors/f-1/recipe')
      .set('Cookie', authCookie())
      .send([
        { ingredient_id: 'azucar-imp', quantity_per_budin: 100 },
        { ingredient_id: 'esencia', quantity_per_budin: 5 },
      ])
    expect(res.status).toBe(200)
    const statements = mockQuery.mock.calls.map(c => String(c[0]))
    expect(statements.some(s => s.includes('DELETE FROM recipe_items'))).toBe(true)
    expect(statements.some(s => s.includes('INSERT INTO recipe_items'))).toBe(true)
  })

  it('dedupes duplicate ingredient_ids so the INSERT cannot violate the unique constraint', async () => {
    // Reproduces the data-loss bug: Manteca sent twice (e.g. as common override
    // AND as a propio). Before the fix the INSERT had two rows with the same
    // (flavor_id, ingredient_id) → unique violation → INSERT aborts after the
    // DELETE already wiped everything. The handler must dedupe to one row.
    mockQuery.mockResolvedValue({ rows: [] })
    const res = await request(makeApp())
      .put('/api/flavors/f-1/recipe')
      .set('Cookie', authCookie())
      .send([
        { ingredient_id: 'manteca', quantity_per_budin: 70 },
        { ingredient_id: 'manteca', quantity_per_budin: 70 },
        { ingredient_id: 'azucar-imp', quantity_per_budin: 100 },
      ])
    expect(res.status).toBe(200)
    const params = insertCallParams()
    expect(params).not.toBeNull()
    expect(params!.filter(p => p === 'manteca')).toHaveLength(1)
    expect(params!.filter(p => p === 'azucar-imp')).toHaveLength(1)
  })

  it('does not INSERT when all items are removed (empty body)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const res = await request(makeApp())
      .put('/api/flavors/f-1/recipe')
      .set('Cookie', authCookie())
      .send([])
    expect(res.status).toBe(200)
    expect(insertCallParams()).toBeNull()
    expect(mockQuery.mock.calls.some(c => String(c[0]).includes('DELETE FROM recipe_items'))).toBe(true)
  })
})

describe('PUT /api/flavors/:id (uses_common_ingredients)', () => {
  beforeEach(() => mockQuery.mockReset())

  it('updates uses_common_ingredients flag', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'f-1', name: 'Test', emoji: '', price_per_budin: '1000', active: true, uses_common_ingredients: false }],
    })
    const app = makeApp()
    const res = await request(app)
      .put('/api/flavors/f-1')
      .set('Cookie', authCookie())
      .send({ uses_common_ingredients: false })
    expect(res.status).toBe(200)
    expect(res.body.uses_common_ingredients).toBe(false)
  })
})
