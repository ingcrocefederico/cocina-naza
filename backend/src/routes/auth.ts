import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import { query } from '../db/client'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import type { User } from '../types'

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/api/auth/google/callback',
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value ?? ''
      const existing = await query<User>(
        'SELECT * FROM users WHERE google_id = $1',
        [profile.id]
      )
      if (existing.rows.length > 0) {
        return done(null, existing.rows[0])
      }
      const created = await query<User>(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [email, profile.displayName, profile.photos?.[0]?.value ?? null, profile.id]
      )
      done(null, created.rows[0])
    } catch (err) {
      done(err as Error)
    }
  }
))

export const authRouter = Router()

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

const clientBase = process.env.NODE_ENV === 'production' ? '' : (process.env.CLIENT_URL || 'http://localhost:5173')

authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${clientBase}/login?error=1` }),
  (req, res) => {
    const user = req.user as User
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.redirect(`${clientBase}/pedidos`)
  }
)

authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const result = await query<User>('SELECT id, email, name, avatar_url FROM users WHERE id = $1', [req.userId])
  if (!result.rows.length) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(result.rows[0])
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})
