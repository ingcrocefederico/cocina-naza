import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import path from 'path'
import { authRouter } from './routes/auth'
import { flavorsRouter } from './routes/flavors'
import { ordersRouter } from './routes/orders'
import { ingredientsRouter } from './routes/ingredients'

const isProd = process.env.NODE_ENV === 'production'

export function createApp() {
  const app = express()

  if (isProd) {
    app.set('trust proxy', 1)
  } else {
    app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    }))
  }

  app.use(express.json())
  app.use(cookieParser())
  app.use(passport.initialize())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRouter)
  app.use('/api/flavors', flavorsRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/ingredients', ingredientsRouter)

  if (isProd) {
    const clientDist = path.join(__dirname, '../../frontend/dist')
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
  }

  return app
}
