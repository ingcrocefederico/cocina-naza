import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { requireAuth } from './auth'

process.env.JWT_SECRET = 'test-secret'

function makeApp() {
  const app = express()
  app.use(cookieParser())
  app.get('/protected', requireAuth, (req, res) => res.json({ userId: (req as any).userId }))
  return app
}

describe('requireAuth middleware', () => {
  it('rejects requests without token', async () => {
    const res = await request(makeApp()).get('/protected')
    expect(res.status).toBe(401)
  })

  it('rejects requests with invalid token', async () => {
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', 'token=bad-token')
    expect(res.status).toBe(401)
  })

  it('passes requests with valid token and sets userId', async () => {
    const token = jwt.sign({ userId: 'user-123' }, 'test-secret')
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', `token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-123')
  })
})
