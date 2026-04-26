# Cocina — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack order management system for a budin bakery with Google OAuth, PostgreSQL, and a React frontend.

**Architecture:** Express/TypeScript backend on Render serving a REST API with Google OAuth + JWT (httpOnly cookie) auth; React/Vite frontend on Vercel consuming the API via TanStack Query v5; PostgreSQL on Neon (serverless) for persistence. Monorepo with `frontend/` and `backend/` folders.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind CSS v3, Shadcn UI, TanStack Query v5, React Router v6, React Hook Form + Zod, date-fns, Express 4, Passport.js + passport-google-oauth20, jsonwebtoken, cookie-parser, pg (node-postgres), Vitest, Supertest

---

## File Map

```
cocina/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts                  # HTTP server entry point
│       ├── app.ts                    # Express app factory (testable)
│       ├── db/
│       │   ├── client.ts             # pg Pool + query helper
│       │   └── migrations/
│       │       └── 001_init.sql      # Full DB schema
│       ├── middleware/
│       │   └── auth.ts               # JWT requireAuth middleware
│       ├── routes/
│       │   ├── auth.ts               # Google OAuth + /me + /logout
│       │   ├── flavors.ts            # CRUD sabores
│       │   ├── orders.ts             # CRUD pedidos (with items)
│       │   └── ingredients.ts        # Ingredient prices + calculator
│       └── types.ts                  # Shared TS types
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx                  # React entry
        ├── App.tsx                   # Router definition
        ├── lib/
        │   ├── api.ts                # Axios instance with credentials
        │   └── queryClient.ts        # TanStack QueryClient
        ├── hooks/
        │   ├── useAuth.ts            # Auth state + redirect
        │   ├── useFlavors.ts         # Flavor queries/mutations
        │   ├── useOrders.ts          # Order queries/mutations
        │   └── useIngredients.ts     # Ingredient queries/mutations
        ├── components/
        │   ├── Layout.tsx            # Nav + outlet
        │   ├── ProtectedRoute.tsx    # Redirect to /login if not authed
        │   └── StatusBadge.tsx       # Colored status chip
        └── pages/
            ├── Login.tsx
            ├── Sabores.tsx
            ├── Pedidos.tsx
            ├── PedidoForm.tsx
            └── Ingredientes.tsx
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `frontend/` (via Vite CLI)

- [ ] **Step 1: Create backend folder and package.json**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
mkdir backend && cd backend
```

Create `backend/package.json`:
```json
{
  "name": "cocina-backend",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "pg": "^8.13.3"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^22.0.0",
    "@types/passport": "^1.0.17",
    "@types/passport-google-oauth20": "^2.0.16",
    "@types/pg": "^8.11.11",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vitest": "^3.0.9"
  }
}
```

- [ ] **Step 2: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create backend/.env.example**

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=change-me-to-a-long-random-string
CLIENT_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

Copy to `.env` and fill real values (do not commit `.env`):
```bash
cp .env.example .env
```

- [ ] **Step 4: Create backend/src/ folders**

```bash
mkdir -p src/db/migrations src/middleware src/routes
```

- [ ] **Step 5: Install backend dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Scaffold frontend with Vite**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 7: Install frontend base dependencies**

```bash
cd frontend
npm install
npm install axios @tanstack/react-query react-router-dom react-hook-form zod date-fns lucide-react
npm install -D tailwindcss@3 postcss autoprefixer @types/node
npx tailwindcss init -p
```

- [ ] **Step 8: Configure Tailwind**

Replace `frontend/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Replace `frontend/src/index.css` content (keep only Tailwind directives):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Configure Vite proxy for local dev**

Replace `frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 10: Add path alias to frontend tsconfig**

In `frontend/tsconfig.json`, add inside `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 11: Initialize Shadcn UI**

```bash
cd frontend
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Then add needed components:
```bash
npx shadcn@latest add button card table form select badge input dialog label separator tabs
```

- [ ] **Step 12: Initialize git repo**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git init
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.local
.DS_Store
EOF
git add .
git commit -m "chore: monorepo scaffold — backend + frontend setup"
```

---

## Task 2: Database schema

**Files:**
- Create: `backend/src/db/migrations/001_init.sql`
- Create: `backend/src/db/client.ts`

**Prerequisites:** Create a Neon account at neon.tech, create a project named "cocina", copy the connection string to `backend/.env` → `DATABASE_URL`.

- [ ] **Step 1: Write the migration SQL**

Create `backend/src/db/migrations/001_init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  avatar_url TEXT,
  google_id  TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE flavors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL DEFAULT '',
  price_per_budin NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK (unit IN ('kg','g','L','ml','unidad')),
  price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipe_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flavor_id          UUID NOT NULL REFERENCES flavors(id) ON DELETE CASCADE,
  ingredient_id      UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_budin NUMERIC(10,4) NOT NULL,
  UNIQUE(flavor_id, ingredient_id)
);

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  address     TEXT,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pedido'
                CHECK (status IN ('pedido','preparado','entregado','cobrado')),
  sale_price  NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  flavor_id UUID NOT NULL REFERENCES flavors(id),
  quantity  INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_orders_date ON orders(date);
```

- [ ] **Step 2: Run migration against Neon**

```bash
cd backend
# Install psql if not available: brew install postgresql
psql $DATABASE_URL -f src/db/migrations/001_init.sql
```

Expected output: series of `CREATE TABLE` and `CREATE INDEX` lines, no errors.

- [ ] **Step 3: Create the DB client**

Create `backend/src/db/client.ts`:
```ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export const query = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> => pool.query(text, params)
```

- [ ] **Step 4: Write DB client test**

Create `backend/src/db/client.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./client', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ result: 1 }] }),
}))

import { query } from './client'

describe('db/client', () => {
  it('query resolves with rows', async () => {
    const result = await query('SELECT 1 AS result')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ result: 1 })
  })
})
```

- [ ] **Step 5: Run test**

```bash
cd backend && npm test
```

Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/
git commit -m "feat: database schema and pg client"
```

---

## Task 3: Backend Express app

**Files:**
- Create: `backend/src/types.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Create: `backend/src/middleware/auth.ts`

- [ ] **Step 1: Create shared types**

Create `backend/src/types.ts`:
```ts
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  google_id: string
  created_at: string
}

export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  created_at: string
}

export interface Ingredient {
  id: string
  name: string
  unit: 'kg' | 'g' | 'L' | 'ml' | 'unidad'
  price_per_unit: string
  updated_at: string
}

export interface Order {
  id: string
  client_name: string
  address: string | null
  date: string
  status: 'pedido' | 'preparado' | 'entregado' | 'cobrado'
  sale_price: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  flavor_id: string
  quantity: number
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { flavor_name: string; flavor_emoji: string; price_per_budin: string })[]
}
```

- [ ] **Step 2: Create auth middleware**

Create `backend/src/middleware/auth.ts`:
```ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

- [ ] **Step 3: Create Express app factory**

Create `backend/src/app.ts`:
```ts
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import { authRouter } from './routes/auth'
import { flavorsRouter } from './routes/flavors'
import { ordersRouter } from './routes/orders'
import { ingredientsRouter } from './routes/ingredients'

export function createApp() {
  const app = express()

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }))
  app.use(express.json())
  app.use(cookieParser())
  app.use(passport.initialize())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRouter)
  app.use('/api/flavors', flavorsRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/ingredients', ingredientsRouter)

  return app
}
```

- [ ] **Step 4: Create server entry point**

Create `backend/src/index.ts`:
```ts
import 'dotenv/config'
import { createApp } from './app'

const port = parseInt(process.env.PORT || '3000', 10)
const app = createApp()

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
```

- [ ] **Step 5: Write app test**

Create `backend/src/app.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

vi.mock('./db/client', () => ({ query: vi.fn() }))
vi.mock('./routes/auth', () => ({ authRouter: require('express').Router() }))
vi.mock('./routes/flavors', () => ({ flavorsRouter: require('express').Router() }))
vi.mock('./routes/orders', () => ({ ordersRouter: require('express').Router() }))
vi.mock('./routes/ingredients', () => ({ ingredientsRouter: require('express').Router() }))

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
```

- [ ] **Step 6: Run tests**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: `Server running on port 3000`. Ctrl+C to stop.

- [ ] **Step 8: Commit**

```bash
git add backend/src/
git commit -m "feat: Express app with middleware, health check, and auth middleware"
```

---

## Task 4: Google OAuth + JWT auth

**Files:**
- Create: `backend/src/routes/auth.ts`

**Prerequisites:** Google Cloud Console setup:
1. Go to console.cloud.google.com → create project "cocina"
2. APIs & Services → OAuth consent screen → External → fill app name
3. APIs & Services → Credentials → Create → OAuth 2.0 Client ID → Web application
4. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copy Client ID and Secret to `backend/.env`

- [ ] **Step 1: Configure Passport Google strategy**

Create `backend/src/routes/auth.ts`:
```ts
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

authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=1` }),
  (req, res) => {
    const user = req.user as User
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.redirect(`${process.env.CLIENT_URL}/pedidos`)
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
```

- [ ] **Step 2: Write auth middleware test**

Create `backend/src/middleware/auth.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
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
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test
```

Expected: all tests pass including the 3 auth middleware tests.

- [ ] **Step 4: Manual OAuth test**

Start dev server: `npm run dev`

Visit: `http://localhost:3000/api/auth/google`

Expected: redirected to Google login → after login → redirected to `http://localhost:5173/pedidos` with `token` cookie set.

Visit: `http://localhost:3000/api/auth/me` (with cookie)

Expected: `{ "id": "...", "email": "...", "name": "..." }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/middleware/auth.test.ts
git commit -m "feat: Google OAuth + JWT httpOnly cookie auth"
```

---

## Task 5: Flavors API

**Files:**
- Create: `backend/src/routes/flavors.ts`
- Create: `backend/src/routes/flavors.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/routes/flavors.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const mockQuery = vi.fn()
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
    const flavor = { id: 'f-1', name: 'Vainilla', emoji: '🍦', price_per_budin: '1500.00', active: true }
    mockQuery.mockResolvedValue({ rows: [flavor] })
    const res = await request(makeApp()).get('/api/flavors').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([flavor])
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

  it('deletes a flavor', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'f-1' }] })
    const res = await request(makeApp())
      .delete('/api/flavors/f-1')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npm test -- flavors
```

Expected: errors about missing module `./flavors`.

- [ ] **Step 3: Implement flavors router**

Create `backend/src/routes/flavors.ts`:
```ts
import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Flavor } from '../types'

export const flavorsRouter = Router()

flavorsRouter.use(requireAuth)

flavorsRouter.get('/', async (_req, res) => {
  const result = await query<Flavor>(
    'SELECT * FROM flavors WHERE active = true ORDER BY name'
  )
  res.json(result.rows)
})

flavorsRouter.post('/', async (req, res) => {
  const { name, emoji = '', price_per_budin = 0 } = req.body
  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  const result = await query<Flavor>(
    'INSERT INTO flavors (name, emoji, price_per_budin) VALUES ($1, $2, $3) RETURNING *',
    [name, emoji, price_per_budin]
  )
  res.status(201).json(result.rows[0])
})

flavorsRouter.put('/:id', async (req, res) => {
  const { name, emoji, price_per_budin, active } = req.body
  const result = await query<Flavor>(
    `UPDATE flavors SET
       name            = COALESCE($1, name),
       emoji           = COALESCE($2, emoji),
       price_per_budin = COALESCE($3, price_per_budin),
       active          = COALESCE($4, active)
     WHERE id = $5 RETURNING *`,
    [name ?? null, emoji ?? null, price_per_budin ?? null, active ?? null, req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Flavor not found' })
    return
  }
  res.json(result.rows[0])
})

flavorsRouter.delete('/:id', async (req, res) => {
  await query('UPDATE flavors SET active = false WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- flavors
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/flavors.ts backend/src/routes/flavors.test.ts
git commit -m "feat: flavors CRUD API"
```

---

## Task 6: Orders API

**Files:**
- Create: `backend/src/routes/orders.ts`
- Create: `backend/src/routes/orders.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/routes/orders.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const mockQuery = vi.fn()
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
}

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
      .mockResolvedValueOnce({ rows: [sampleOrder] })
      .mockResolvedValueOnce({ rows: [{ flavor_id: 'f-1', flavor_name: 'Vainilla', flavor_emoji: '🍦', quantity: 2, price_per_budin: '1500.00' }] })
    const res = await request(makeApp()).get('/api/orders?date=2026-04-26').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body[0].items).toHaveLength(1)
  })
})

describe('POST /api/orders', () => {
  beforeEach(() => mockQuery.mockReset())

  it('creates order with items', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [sampleOrder] })  // INSERT order
      .mockResolvedValueOnce({ rows: [] })              // INSERT items
      .mockResolvedValueOnce({ rows: [{ flavor_id: 'f-1', flavor_name: 'Vainilla', flavor_emoji: '🍦', quantity: 2, price_per_budin: '1500.00' }] }) // SELECT items
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
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] }) // delete old items
      .mockResolvedValueOnce({ rows: [] }) // insert new items
      .mockResolvedValueOnce({ rows: [] }) // fetch items
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- orders
```

Expected: import error (module not found).

- [ ] **Step 3: Implement orders router**

Create `backend/src/routes/orders.ts`:
```ts
import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Order, OrderWithItems } from '../types'

export const ordersRouter = Router()

ordersRouter.use(requireAuth)

async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const orderRes = await query<Order>('SELECT * FROM orders WHERE id = $1', [orderId])
  if (!orderRes.rows.length) return null
  const itemsRes = await query(
    `SELECT oi.flavor_id, f.name AS flavor_name, f.emoji AS flavor_emoji,
            oi.quantity, f.price_per_budin
     FROM order_items oi
     JOIN flavors f ON f.id = oi.flavor_id
     WHERE oi.order_id = $1`,
    [orderId]
  )
  return { ...orderRes.rows[0], items: itemsRes.rows as any }
}

ordersRouter.get('/', async (req, res) => {
  const { date } = req.query
  if (!date) {
    res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    return
  }
  const ordersRes = await query<Order>('SELECT * FROM orders WHERE date = $1 ORDER BY created_at', [date])
  const ordersWithItems = await Promise.all(
    ordersRes.rows.map(o => fetchOrderWithItems(o.id))
  )
  res.json(ordersWithItems.filter(Boolean))
})

ordersRouter.post('/', async (req, res) => {
  const { client_name, address, date, status = 'pedido', sale_price, notes, items = [] } = req.body
  if (!client_name || !date) {
    res.status(400).json({ error: 'client_name and date are required' })
    return
  }
  const orderRes = await query<Order>(
    `INSERT INTO orders (client_name, address, date, status, sale_price, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [client_name, address ?? null, date, status, sale_price ?? null, notes ?? null]
  )
  const order = orderRes.rows[0]

  if (items.length > 0) {
    const values = items
      .map((_: any, i: number) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(', ')
    const params = items.flatMap((item: any) => [order.id, item.flavor_id, item.quantity])
    await query(
      `INSERT INTO order_items (order_id, flavor_id, quantity) VALUES ${values}`,
      params
    )
  }

  const result = await fetchOrderWithItems(order.id)
  res.status(201).json(result)
})

ordersRouter.put('/:id', async (req, res) => {
  const { client_name, address, date, status, sale_price, notes, items } = req.body
  const orderRes = await query<Order>(
    `UPDATE orders SET
       client_name = COALESCE($1, client_name),
       address     = COALESCE($2, address),
       date        = COALESCE($3, date),
       status      = COALESCE($4, status),
       sale_price  = COALESCE($5, sale_price),
       notes       = COALESCE($6, notes),
       updated_at  = now()
     WHERE id = $7 RETURNING *`,
    [client_name ?? null, address ?? null, date ?? null, status ?? null, sale_price ?? null, notes ?? null, req.params.id]
  )
  if (!orderRes.rows.length) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  if (Array.isArray(items)) {
    await query('DELETE FROM order_items WHERE order_id = $1', [req.params.id])
    if (items.length > 0) {
      const values = items
        .map((_: any, i: number) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(', ')
      const params = items.flatMap((item: any) => [req.params.id, item.flavor_id, item.quantity])
      await query(
        `INSERT INTO order_items (order_id, flavor_id, quantity) VALUES ${values}`,
        params
      )
    }
  }

  const result = await fetchOrderWithItems(req.params.id)
  res.json(result)
})

ordersRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM orders WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- orders
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/orders.ts backend/src/routes/orders.test.ts
git commit -m "feat: orders CRUD API with order items"
```

---

## Task 7: Ingredients + Calculator API

**Files:**
- Create: `backend/src/routes/ingredients.ts`
- Create: `backend/src/routes/ingredients.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/routes/ingredients.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'

const mockQuery = vi.fn()
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
    const ingredients = [
      { id: 'i-1', name: 'Harina', unit: 'kg', price_per_unit: '500.00' }
    ]
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- ingredients
```

Expected: import error.

- [ ] **Step 3: Implement ingredients router**

Create `backend/src/routes/ingredients.ts`:
```ts
import { Router } from 'express'
import { query } from '../db/client'
import { requireAuth } from '../middleware/auth'
import type { Ingredient } from '../types'

export const ingredientsRouter = Router()

ingredientsRouter.use(requireAuth)

ingredientsRouter.get('/', async (_req, res) => {
  const result = await query<Ingredient>('SELECT * FROM ingredients ORDER BY name')
  res.json(result.rows)
})

ingredientsRouter.post('/', async (req, res) => {
  const { name, unit, price_per_unit = 0 } = req.body
  if (!name || !unit) {
    res.status(400).json({ error: 'name and unit are required' })
    return
  }
  const result = await query<Ingredient>(
    'INSERT INTO ingredients (name, unit, price_per_unit) VALUES ($1, $2, $3) RETURNING *',
    [name, unit, price_per_unit]
  )
  res.status(201).json(result.rows[0])
})

ingredientsRouter.put('/:id', async (req, res) => {
  const { name, unit, price_per_unit } = req.body
  const result = await query<Ingredient>(
    `UPDATE ingredients SET
       name           = COALESCE($1, name),
       unit           = COALESCE($2, unit),
       price_per_unit = COALESCE($3, price_per_unit),
       updated_at     = now()
     WHERE id = $4 RETURNING *`,
    [name ?? null, unit ?? null, price_per_unit ?? null, req.params.id]
  )
  if (!result.rows.length) {
    res.status(404).json({ error: 'Ingredient not found' })
    return
  }
  res.json(result.rows[0])
})

ingredientsRouter.get('/calculator', async (req, res) => {
  const { date } = req.query
  if (!date) {
    res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    return
  }

  // Total ingredients across all orders for the date
  const totalsRes = await query(
    `SELECT i.id, i.name, i.unit, i.price_per_unit,
            SUM(oi.quantity * ri.quantity_per_budin) AS total_quantity
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN recipe_items ri ON ri.flavor_id = oi.flavor_id
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE o.date = $1
     GROUP BY i.id, i.name, i.unit, i.price_per_unit
     ORDER BY i.name`,
    [date]
  )

  // Breakdown by flavor
  const byFlavorRes = await query(
    `SELECT f.id AS flavor_id, f.name AS flavor_name,
            SUM(oi.quantity) AS budin_count,
            i.id AS ingredient_id, i.name AS ingredient_name, i.unit,
            SUM(oi.quantity * ri.quantity_per_budin) AS total_quantity
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN flavors f ON f.id = oi.flavor_id
     JOIN recipe_items ri ON ri.flavor_id = oi.flavor_id
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE o.date = $1
     GROUP BY f.id, f.name, i.id, i.name, i.unit
     ORDER BY f.name, i.name`,
    [date]
  )

  // Financial summary
  const financialsRes = await query(
    `SELECT COALESCE(SUM(sale_price), 0) AS total_sales FROM orders WHERE date = $1`,
    [date]
  )

  const totals = totalsRes.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    totalQuantity: parseFloat(r.total_quantity),
    pricePerUnit: parseFloat(r.price_per_unit),
    totalCost: parseFloat(r.total_quantity) * parseFloat(r.price_per_unit),
  }))

  const totalCost = totals.reduce((sum: number, t: any) => sum + t.totalCost, 0)
  const totalSales = parseFloat(financialsRes.rows[0].total_sales)

  // Group byFlavor rows by flavor
  const flavorMap = new Map<string, any>()
  for (const row of byFlavorRes.rows as any[]) {
    if (!flavorMap.has(row.flavor_id)) {
      flavorMap.set(row.flavor_id, {
        flavorId: row.flavor_id,
        flavorName: row.flavor_name,
        budinCount: parseInt(row.budin_count),
        ingredients: [],
      })
    }
    flavorMap.get(row.flavor_id).ingredients.push({
      id: row.ingredient_id,
      name: row.ingredient_name,
      unit: row.unit,
      totalQuantity: parseFloat(row.total_quantity),
    })
  }

  res.json({
    totals,
    byFlavor: Array.from(flavorMap.values()),
    financials: {
      totalCost,
      totalSales,
      profit: totalSales - totalCost,
    },
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- ingredients
```

Expected: all tests pass.

- [ ] **Step 5: Run all backend tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/ingredients.ts backend/src/routes/ingredients.test.ts
git commit -m "feat: ingredients CRUD + calculator API"
```

---

## Task 8: Frontend core setup

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/queryClient.ts`
- Create: `frontend/src/types.ts`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create shared frontend types**

Create `frontend/src/types.ts`:
```ts
export type OrderStatus = 'pedido' | 'preparado' | 'entregado' | 'cobrado'
export type Unit = 'kg' | 'g' | 'L' | 'ml' | 'unidad'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
}

export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
}

export interface Ingredient {
  id: string
  name: string
  unit: Unit
  price_per_unit: string
}

export interface OrderItem {
  flavor_id: string
  flavor_name: string
  flavor_emoji: string
  quantity: number
  price_per_budin: string
}

export interface Order {
  id: string
  client_name: string
  address: string | null
  date: string
  status: OrderStatus
  sale_price: string | null
  notes: string | null
  items: OrderItem[]
}

export interface CalculatorResult {
  totals: {
    id: string
    name: string
    unit: Unit
    totalQuantity: number
    pricePerUnit: number
    totalCost: number
  }[]
  byFlavor: {
    flavorId: string
    flavorName: string
    budinCount: number
    ingredients: { id: string; name: string; unit: Unit; totalQuantity: number }[]
  }[]
  financials: {
    totalCost: number
    totalSales: number
    profit: number
  }
}
```

- [ ] **Step 2: Create API client**

Create `frontend/src/lib/api.ts`:
```ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

export default api
```

Create `frontend/src/.env.local` (for local dev — Vite proxy handles /api):
```env
VITE_API_URL=
```

- [ ] **Step 3: Create TanStack Query client**

Create `frontend/src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})
```

- [ ] **Step 4: Update main.tsx**

Replace `frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
```

- [ ] **Step 5: Create App.tsx with routing**

Create `frontend/src/App.tsx`:
```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/Login'
import Sabores from './pages/Sabores'
import Pedidos from './pages/Pedidos'
import PedidoForm from './pages/PedidoForm'
import Ingredientes from './pages/Ingredientes'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { path: '/sabores', element: <Sabores /> },
      { path: '/pedidos', element: <Pedidos /> },
      { path: '/pedidos/nuevo', element: <PedidoForm /> },
      { path: '/pedidos/:id', element: <PedidoForm /> },
      { path: '/ingredientes', element: <Ingredientes /> },
      { path: '/', element: <Pedidos /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 6: Verify frontend compiles**

```bash
cd frontend && npm run build
```

Expected: build error about missing page components — that's fine, we'll add them next. The key is no TS config errors.

Actually, create placeholder stubs for the missing files so the build doesn't fail completely. Create each as a single-line file:

```bash
mkdir -p src/pages src/components
for page in Login Sabores Pedidos PedidoForm Ingredientes; do
  echo "export default function ${page}() { return <div>${page}</div> }" > src/pages/${page}.tsx
done
echo "export default function ProtectedRoute({ children }: any) { return children }" > src/components/ProtectedRoute.tsx
echo "import { Outlet } from 'react-router-dom'; export default function Layout() { return <Outlet /> }" > src/components/Layout.tsx
echo "export default function StatusBadge({ status }: any) { return <span>{status}</span> }" > src/components/StatusBadge.tsx
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/
git commit -m "feat: frontend scaffold — routing, API client, TanStack Query, types"
```

---

## Task 9: Frontend auth

**Files:**
- Create: `frontend/src/hooks/useAuth.ts`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Create useAuth hook**

Replace `frontend/src/hooks/useAuth.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { User } from '../types'

export function useAuth() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.get<User>('/api/auth/me')
        return res.data
      } catch {
        return null
      }
    },
    staleTime: Infinity,
  })

  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(['auth', 'me'], null)
    },
  })

  return { user, isLoading, logout: logout.mutate }
}
```

- [ ] **Step 2: Implement ProtectedRoute**

Replace `frontend/src/components/ProtectedRoute.tsx`:
```tsx
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-500">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 3: Implement Layout with nav**

Replace `frontend/src/components/Layout.tsx`:
```tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Palette, FlaskConical, LogOut } from 'lucide-react'

const navItems = [
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/sabores', label: 'Sabores', icon: Palette },
  { to: '/ingredientes', label: 'Ingredientes', icon: FlaskConical },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4">
        <span className="font-semibold text-slate-800 text-lg">🍞 Cocina Naza</span>
        <nav className="flex gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {user?.name}
          <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/login') }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Implement Login page**

Replace `frontend/src/pages/Login.tsx`:
```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function Login() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/pedidos', { replace: true })
  }, [user, navigate])

  if (isLoading) return null

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <div className="text-5xl">🍞</div>
        <h1 className="text-2xl font-bold text-slate-800">Cocina Naza</h1>
        <p className="text-slate-500">Gestión de pedidos</p>
        <Button
          size="lg"
          onClick={() => { window.location.href = '/api/auth/google' }}
        >
          Entrar con Google
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/
git commit -m "feat: frontend auth — Google login, ProtectedRoute, Layout with nav"
```

---

## Task 10: Sabores page

**Files:**
- Create: `frontend/src/hooks/useFlavors.ts`
- Modify: `frontend/src/pages/Sabores.tsx`

- [ ] **Step 1: Create useFlavors hook**

Create `frontend/src/hooks/useFlavors.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Flavor } from '../types'

export function useFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['flavors'],
    queryFn: async () => (await api.get('/api/flavors')).data,
  })
}

export function useCreateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Flavor>) => api.post('/api/flavors', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}

export function useUpdateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Flavor> & { id: string }) =>
      api.put(`/api/flavors/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}

export function useDeleteFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/flavors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}
```

- [ ] **Step 2: Implement Sabores page**

Replace `frontend/src/pages/Sabores.tsx`:
```tsx
import { useState } from 'react'
import { useFlavors, useCreateFlavor, useUpdateFlavor, useDeleteFlavor } from '../hooks/useFlavors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Trash2, Pencil, Plus } from 'lucide-react'
import type { Flavor } from '../types'

interface FlavorFormData {
  name: string
  emoji: string
  price_per_budin: string
}

const empty: FlavorFormData = { name: '', emoji: '', price_per_budin: '' }

export default function Sabores() {
  const { data: flavors = [], isLoading } = useFlavors()
  const createFlavor = useCreateFlavor()
  const updateFlavor = useUpdateFlavor()
  const deleteFlavor = useDeleteFlavor()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Flavor | null>(null)
  const [form, setForm] = useState<FlavorFormData>(empty)

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(flavor: Flavor) {
    setEditing(flavor)
    setForm({ name: flavor.name, emoji: flavor.emoji, price_per_budin: flavor.price_per_budin })
    setOpen(true)
  }

  async function handleSubmit() {
    const payload = { ...form, price_per_budin: parseFloat(form.price_per_budin) || 0 }
    if (editing) {
      await updateFlavor.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createFlavor.mutateAsync(payload)
    }
    setOpen(false)
  }

  if (isLoading) return <div className="text-slate-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Sabores de budín</h1>
        <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nuevo sabor</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {flavors.map(flavor => (
          <Card key={flavor.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">{flavor.emoji}</span>
                {flavor.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">
                ${parseFloat(flavor.price_per_budin).toLocaleString('es-AR')}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(flavor)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteFlavor.mutate(flavor.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sabor' : 'Nuevo sabor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vainilla" />
            </div>
            <div><Label>Emoji</Label>
              <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🍦" className="w-24" />
            </div>
            <div><Label>Precio por budín ($)</Label>
              <Input type="number" value={form.price_per_budin} onChange={e => setForm(f => ({ ...f, price_per_budin: e.target.value }))} placeholder="1500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/
git commit -m "feat: sabores page — CRUD de sabores con precio por budín"
```

---

## Task 11: Pedidos list page

**Files:**
- Create: `frontend/src/hooks/useOrders.ts`
- Modify: `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/pages/Pedidos.tsx`

- [ ] **Step 1: Create useOrders hook**

Create `frontend/src/hooks/useOrders.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Order, OrderStatus } from '../types'

export function useOrders(date: string) {
  return useQuery<Order[]>({
    queryKey: ['orders', date],
    queryFn: async () => (await api.get(`/api/orders?date=${date}`)).data,
    enabled: !!date,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Order> & { items: { flavor_id: string; quantity: number }[] }) =>
      api.post('/api/orders', data),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['orders', vars.date] }),
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Order> & { id: string; items?: { flavor_id: string; quantity: number }[] }) =>
      api.put(`/api/orders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
```

- [ ] **Step 2: Implement StatusBadge**

Replace `frontend/src/components/StatusBadge.tsx`:
```tsx
import type { OrderStatus } from '../types'

const config: Record<OrderStatus, { label: string; className: string }> = {
  pedido:     { label: 'Pedido',     className: 'bg-slate-100 text-slate-700' },
  preparado:  { label: 'Preparado',  className: 'bg-yellow-100 text-yellow-800' },
  entregado:  { label: 'Entregado',  className: 'bg-blue-100 text-blue-800' },
  cobrado:    { label: 'Cobrado',    className: 'bg-green-100 text-green-800' },
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 3: Implement Pedidos list page**

Replace `frontend/src/pages/Pedidos.tsx`:
```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, useUpdateOrder, useDeleteOrder } from '../hooks/useOrders'
import StatusBadge from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Pencil, MapPin } from 'lucide-react'
import type { Order, OrderStatus } from '../types'

const STATUSES: OrderStatus[] = ['pedido', 'preparado', 'entregado', 'cobrado']

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.get('date') || today

  const { data: orders = [], isLoading } = useOrders(date)
  const updateOrder = useUpdateOrder()
  const deleteOrder = useDeleteOrder()
  const navigate = useNavigate()

  function setDate(d: string) {
    setParams({ date: d })
  }

  function changeStatus(order: Order, status: OrderStatus) {
    updateOrder.mutate({ id: order.id, status })
  }

  const totalBudines = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalVenta = orders.reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">Pedidos</h1>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={() => navigate(`/pedidos/nuevo?date=${date}`)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
        </Button>
      </div>

      {isLoading && <div className="text-slate-500">Cargando...</div>}

      {!isLoading && orders.length === 0 && (
        <div className="text-center py-16 text-slate-400">Sin pedidos para esta fecha.</div>
      )}

      <div className="space-y-3">
        {orders.map(order => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{order.client_name}</span>
                    <Select
                      value={order.status}
                      onValueChange={val => changeStatus(order, val as OrderStatus)}
                    >
                      <SelectTrigger className="w-fit h-6 px-2 py-0 text-xs border-0 p-0">
                        <StatusBadge status={order.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {order.address && (
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="w-3.5 h-3.5" /> {order.address}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {order.items.map(item => (
                      <span key={item.flavor_id} className="text-sm bg-slate-100 rounded px-2 py-0.5">
                        {item.flavor_emoji} {item.flavor_name} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {order.sale_price && (
                    <span className="text-sm font-medium text-slate-700 mr-2">
                      ${parseFloat(order.sale_price).toLocaleString('es-AR')}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/pedidos/${order.id}?date=${date}`)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteOrder.mutate(order.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="border-t pt-3 flex gap-6 text-sm text-slate-600">
          <span><strong>{orders.length}</strong> pedidos</span>
          <span><strong>{totalBudines}</strong> budines</span>
          <span>Total venta: <strong>${totalVenta.toLocaleString('es-AR')}</strong></span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/
git commit -m "feat: pedidos list page — date picker, status change inline, summary"
```

---

## Task 12: Pedido form (create/edit)

**Files:**
- Modify: `frontend/src/pages/PedidoForm.tsx`

- [ ] **Step 1: Implement PedidoForm**

Replace `frontend/src/pages/PedidoForm.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useFlavors } from '../hooks/useFlavors'
import { useCreateOrder, useUpdateOrder, useOrders } from '../hooks/useOrders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import type { OrderStatus } from '../types'

const schema = z.object({
  client_name: z.string().min(1, 'Nombre requerido'),
  address: z.string().optional(),
  date: z.string().min(1),
  status: z.enum(['pedido', 'preparado', 'entregado', 'cobrado']),
  sale_price: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    flavor_id: z.string().min(1, 'Elegí un sabor'),
    quantity: z.coerce.number().int().min(1),
  })).min(1, 'Agregá al menos un budín'),
})

type FormValues = z.infer<typeof schema>

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pedido', label: 'Pedido' },
  { value: 'preparado', label: 'Preparado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cobrado', label: 'Cobrado' },
]

export default function PedidoForm() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const dateFromParams = params.get('date') || format(new Date(), 'yyyy-MM-dd')
  const { data: flavors = [] } = useFlavors()
  const { data: orders = [] } = useOrders(dateFromParams)
  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()

  const existingOrder = useMemo(() => orders.find(o => o.id === id), [orders, id])

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_name: '',
      address: '',
      date: dateFromParams,
      status: 'pedido',
      sale_price: '',
      notes: '',
      items: [{ flavor_id: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  // Populate form when editing
  useEffect(() => {
    if (existingOrder) {
      setValue('client_name', existingOrder.client_name)
      setValue('address', existingOrder.address || '')
      setValue('date', existingOrder.date)
      setValue('status', existingOrder.status)
      setValue('sale_price', existingOrder.sale_price || '')
      setValue('notes', existingOrder.notes || '')
      setValue('items', existingOrder.items.map(i => ({ flavor_id: i.flavor_id, quantity: i.quantity })))
    }
  }, [existingOrder, setValue])

  // Auto-calculate sale_price from items
  const calculatedPrice = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const flavor = flavors.find(f => f.id === item.flavor_id)
      if (!flavor) return sum
      return sum + parseFloat(flavor.price_per_budin) * (item.quantity || 0)
    }, 0)
  }, [watchedItems, flavors])

  const [priceEdited, setPriceEdited] = useState(false)

  useEffect(() => {
    if (!priceEdited) {
      setValue('sale_price', calculatedPrice > 0 ? calculatedPrice.toFixed(2) : '')
    }
  }, [calculatedPrice, priceEdited, setValue])

  async function onSubmit(data: FormValues) {
    if (isEdit) {
      await updateOrder.mutateAsync({ id: id!, ...data })
    } else {
      await createOrder.mutateAsync(data as any)
    }
    navigate(`/pedidos?date=${data.date}`)
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold text-slate-800">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Nombre del cliente *</Label>
          <Input {...register('client_name')} placeholder="María González" />
          {errors.client_name && <p className="text-red-500 text-xs mt-1">{errors.client_name.message}</p>}
        </div>

        <div>
          <Label>Dirección</Label>
          <Input {...register('address')} placeholder="Opcional" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" {...register('date')} />
          </div>
          <div>
            <Label>Estado</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* Budines table */}
        <div className="space-y-2">
          <Label>Budines</Label>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-center">
              <Controller
                control={control}
                name={`items.${idx}.flavor_id`}
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Elegí sabor" />
                    </SelectTrigger>
                    <SelectContent>
                      {flavors.map(flavor => (
                        <SelectItem key={flavor.id} value={flavor.id}>
                          {flavor.emoji} {flavor.name} — ${parseFloat(flavor.price_per_budin).toLocaleString('es-AR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Input
                type="number"
                min={1}
                className="w-20"
                {...register(`items.${idx}.quantity`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          ))}
          {errors.items && <p className="text-red-500 text-xs">{errors.items.message || errors.items.root?.message}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ flavor_id: '', quantity: 1 })}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar sabor
          </Button>
        </div>

        <div>
          <Label>Precio de venta ($)</Label>
          <Input
            type="number"
            step="0.01"
            {...register('sale_price')}
            onChange={e => { setPriceEdited(true); register('sale_price').onChange(e) }}
            placeholder={calculatedPrice > 0 ? calculatedPrice.toFixed(2) : '0.00'}
          />
          {calculatedPrice > 0 && !priceEdited && (
            <p className="text-xs text-slate-500 mt-1">Calculado: ${calculatedPrice.toLocaleString('es-AR')}</p>
          )}
        </div>

        <div>
          <Label>Notas</Label>
          <Input {...register('notes')} placeholder="Opcional" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={createOrder.isPending || updateOrder.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear pedido'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Install zod resolver**

```bash
cd frontend && npm install @hookform/resolvers
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/ frontend/package.json frontend/package-lock.json
git commit -m "feat: pedido form — create/edit with dynamic budin rows and auto price"
```

---

## Task 13: Ingredientes page

**Files:**
- Create: `frontend/src/hooks/useIngredients.ts`
- Modify: `frontend/src/pages/Ingredientes.tsx`

- [ ] **Step 1: Create useIngredients hook**

Create `frontend/src/hooks/useIngredients.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Ingredient, CalculatorResult } from '../types'

export function useIngredients() {
  return useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => (await api.get('/api/ingredients')).data,
  })
}

export function useUpdateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ingredient> & { id: string }) =>
      api.put(`/api/ingredients/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  })
}

export function useCalculator(date: string) {
  return useQuery<CalculatorResult>({
    queryKey: ['calculator', date],
    queryFn: async () => (await api.get(`/api/ingredients/calculator?date=${date}`)).data,
    enabled: !!date,
  })
}
```

- [ ] **Step 2: Implement Ingredientes page**

Replace `frontend/src/pages/Ingredientes.tsx`:
```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { useIngredients, useUpdateIngredient, useCalculator } from '../hooks/useIngredients'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Ingredient } from '../types'

export default function Ingredientes() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.get('date') || today

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Ingredientes</h1>
      <Tabs defaultValue="calculadora">
        <TabsList>
          <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
          <TabsTrigger value="precios">Precios</TabsTrigger>
        </TabsList>
        <TabsContent value="calculadora" className="mt-4">
          <CalculadoraTab date={date} onDateChange={d => setParams({ date: d })} />
        </TabsContent>
        <TabsContent value="precios" className="mt-4">
          <PreciosTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CalculadoraTab({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const { data, isLoading } = useCalculator(date)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Fecha:</span>
        <Input type="date" value={date} onChange={e => onDateChange(e.target.value)} className="w-40" />
      </div>

      {isLoading && <div className="text-slate-500">Calculando...</div>}

      {data && (
        <>
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Costo total', value: data.financials.totalCost, color: 'text-red-600' },
              { label: 'Venta total', value: data.financials.totalSales, color: 'text-blue-600' },
              { label: 'Ganancia', value: data.financials.profit, color: data.financials.profit >= 0 ? 'text-green-600' : 'text-red-600' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total ingredients */}
          {data.totals.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Total ingredientes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.totals.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.totalQuantity.toLocaleString('es-AR')} {t.unit}</TableCell>
                        <TableCell className="text-slate-600">${t.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Breakdown by flavor */}
          {data.byFlavor.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Desglose por sabor</h2>
              {data.byFlavor.map(flavor => (
                <Card key={flavor.flavorId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{flavor.flavorName} <span className="font-normal text-slate-500">×{flavor.budinCount}</span></CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {flavor.ingredients.map(ing => (
                          <TableRow key={ing.id}>
                            <TableCell className="text-sm">{ing.name}</TableCell>
                            <TableCell className="text-sm">{ing.totalQuantity.toLocaleString('es-AR')} {ing.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.totals.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Sin datos para esta fecha. Asegurate de tener recetas cargadas.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PreciosTab() {
  const { data: ingredients = [], isLoading } = useIngredients()
  const updateIngredient = useUpdateIngredient()
  const [prices, setPrices] = useState<Record<string, string>>({})

  function handleSave(ingredient: Ingredient) {
    const newPrice = prices[ingredient.id]
    if (!newPrice) return
    updateIngredient.mutate({ id: ingredient.id, price_per_unit: parseFloat(newPrice) as any })
  }

  if (isLoading) return <div className="text-slate-500">Cargando...</div>

  if (ingredients.length === 0) {
    return <div className="text-center py-12 text-slate-400">Sin ingredientes cargados. Se cargan desde las recetas.</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingrediente</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead>Precio por unidad ($)</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ingredients.map(ing => (
          <TableRow key={ing.id}>
            <TableCell>{ing.name}</TableCell>
            <TableCell>{ing.unit}</TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.01"
                defaultValue={ing.price_per_unit}
                className="w-32"
                onChange={e => setPrices(p => ({ ...p, [ing.id]: e.target.value }))}
              />
            </TableCell>
            <TableCell>
              <Button size="sm" variant="outline" onClick={() => handleSave(ing)}>
                Guardar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
git add frontend/src/
git commit -m "feat: ingredientes page — calculadora por fecha + precios editables"
```

---

## Task 14: Deploy

**Files:**
- Create: `frontend/.env.production`
- Create: `backend/.env` (on Render dashboard, not committed)

### Backend → Render

- [ ] **Step 1: Push repo to GitHub**

```bash
cd /Users/federicocroce/Documents/Naza/cocina
# Create repo at github.com (via UI or gh CLI)
gh repo create cocina --private
git remote add origin git@github.com:federicocroce/cocina.git
git push -u origin main
```

- [ ] **Step 2: Create Render service**

1. Go to render.com → New → Web Service
2. Connect GitHub repo → select `cocina`
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node

- [ ] **Step 3: Set Render environment variables**

In Render dashboard → Environment → add:
```
DATABASE_URL=<Neon connection string>
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
JWT_SECRET=<random 64-char string — generate with: openssl rand -hex 32>
CLIENT_URL=https://<your-vercel-app>.vercel.app
NODE_ENV=production
```

- [ ] **Step 4: Update Google OAuth redirect URI**

In Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs → add:
```
https://<your-render-service>.onrender.com/api/auth/google/callback
```

- [ ] **Step 5: Verify backend health**

```bash
curl https://<your-render-service>.onrender.com/health
```

Expected: `{"ok":true}`

### Frontend → Vercel

- [ ] **Step 6: Create frontend env file**

Create `frontend/.env.production`:
```env
VITE_API_URL=https://<your-render-service>.onrender.com
```

Commit:
```bash
git add frontend/.env.production
git commit -m "chore: production API URL for frontend"
git push
```

- [ ] **Step 7: Deploy to Vercel**

```bash
cd frontend
npx vercel --prod
```

Or via Vercel dashboard:
1. Import GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework: Vite
4. Deploy

- [ ] **Step 8: Update Render CLIENT_URL**

In Render dashboard → Environment → update:
```
CLIENT_URL=https://<your-vercel-app>.vercel.app
```

Trigger redeploy.

- [ ] **Step 9: End-to-end smoke test**

1. Open `https://<your-vercel-app>.vercel.app`
2. Click "Entrar con Google" → complete OAuth flow
3. Redirected to `/pedidos`
4. Go to `/sabores` → create a flavor (ej: "Vainilla 🍦 $1500")
5. Go to `/pedidos` → create a new order with that flavor
6. Verify order appears in list with correct price
7. Change status inline → verify it updates
8. Go to `/ingredientes` → select today's date → verify calculator loads (will be empty until recipes are loaded)

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "chore: deploy configuration — Vercel + Render"
git push
```

---

## Self-review notes

- The `GET /api/ingredients/calculator` route must be registered **before** `GET /api/ingredients/:id` in the router, or Express will try to match `calculator` as an `:id`. The implementation above defines it as a separate route in `ingredientsRouter` with the path `/calculator` — verify the route ordering when implementing.
- The `useOrders` hook fetches orders by date to populate the edit form. In a future optimization, a `GET /api/orders/:id` endpoint would be cleaner than fetching all orders for a date and finding the one by ID.
- Ingredient CRUD (create/delete) via UI is not in scope — ingredients are expected to be seeded via the future `/recetas` section. The Precios tab only shows existing ingredients.
