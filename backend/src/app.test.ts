import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('./db/client', () => ({ query: vi.fn() }))

vi.mock('passport-google-oauth20', () => ({
  Strategy: class {
    name = 'google'
    authenticate(_req: unknown, _options?: unknown) { /* no-op stub */ }
  },
}))

import { createApp } from './app'

describe('Express app', () => {
  const app = createApp()

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('unknown routes return 404', async () => {
    const res = await request(app).get('/api/nonexistent')
    expect(res.status).toBe(404)
  })
})
