// backend/src/routes/common-recipe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { query } from '../db/client'

vi.mock('../db/client', () => ({ query: vi.fn() }))
vi.mock('../middleware/auth', () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }))
vi.mock('passport-google-oauth20', () => ({
  Strategy: class {
    name = 'google'
    authenticate(_req: unknown, _options?: unknown) {}
  },
}))

import { createApp } from '../app'

const mockQuery = vi.mocked(query)

describe('GET /api/common-recipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns common recipe items', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 500, price_per_unit: '0.005' },
      ],
    })
    const app = createApp()
    const res = await request(app).get('/api/common-recipe')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].ingredient_name).toBe('Harina')
  })

  it('includes applies_to in each item', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g',
          quantity_per_budin: 500, price_per_unit: '0.005', applies_to: 'all' },
      ],
    })
    const app = createApp()
    const res = await request(app).get('/api/common-recipe')
    expect(res.status).toBe(200)
    expect(res.body[0].applies_to).toBe('all')
  })
})

describe('PUT /api/common-recipe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces all common recipe items and returns updated list', async () => {
    // DELETE call
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // INSERT call
    mockQuery.mockResolvedValueOnce({ rows: [] })
    // SELECT call (return updated list)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'cri-1', ingredient_id: 'ing-1', ingredient_name: 'Harina', unit: 'g', quantity_per_budin: 600, price_per_unit: '0.005', applies_to: 'all' },
      ],
    })
    const app = createApp()
    const res = await request(app)
      .put('/api/common-recipe')
      .send([{ ingredient_id: 'ing-1', quantity_per_budin: 600, applies_to: 'all' }])
    expect(res.status).toBe(200)
    expect(res.body[0].quantity_per_budin).toBe(600)
  })

  it('handles empty items array (clears all common items)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }) // DELETE
    mockQuery.mockResolvedValueOnce({ rows: [] }) // SELECT
    const app = createApp()
    const res = await request(app).put('/api/common-recipe').send([])
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('rejects invalid applies_to value', async () => {
    const app = createApp()
    const res = await request(app)
      .put('/api/common-recipe')
      .send([{ ingredient_id: 'ing-1', quantity_per_budin: 100, applies_to: 'invalid' }])
    expect(res.status).toBe(400)
  })
})
