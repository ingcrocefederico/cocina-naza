# Cocina Naza — Setup

## Levantar el proyecto local

### Requisitos

- Node.js 20+
- npm 7+ (workspaces)
- PostgreSQL local O una cuenta en [neon.tech](https://neon.tech) (recomendado)

---

### 1. Instalar todas las dependencias (una sola vez)

Desde la raíz del proyecto:

```bash
npm install
```

Esto instala las deps de `backend/`, `frontend/` y la raíz en un solo paso gracias a npm workspaces.

---

### 2. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` con valores reales:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
JWT_SECRET=cualquier-string-largo-random
CLIENT_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
```

> Para desarrollo podés usar Neon gratis como base de datos remota, o PostgreSQL local sin `?sslmode=require`.

---

### 3. Correr la migración SQL (una sola vez)

```bash
psql $DATABASE_URL -f backend/src/db/migrations/001_init.sql
```

Si usás PostgreSQL local:
```bash
createdb cocina
psql cocina -f backend/src/db/migrations/001_init.sql
```

---

### 4. Levantar FE + BE juntos

```bash
npm run dev
```

Levanta backend (`:3001`) y frontend (`:5173`) en paralelo con output diferenciado por color.

Las requests a `/api/*` se proxean automáticamente al backend (configurado en `vite.config.ts`).

Para levantar por separado si necesitás:
```bash
npm run dev -w backend    # solo backend
npm run dev -w frontend   # solo frontend
```

---

### Comandos disponibles desde la raíz

| Comando | Qué hace |
|---------|----------|
| `npm install` | Instala deps de todos los workspaces |
| `npm run dev` | Levanta BE + FE en paralelo |
| `npm run build` | Buildea BE y FE en secuencia |
| `npm test` | Corre los tests del backend |

---

### 5. Configurar Google OAuth para desarrollo

En [Google Cloud Console](https://console.cloud.google.com):

1. Crear proyecto → APIs & Services → Credentials → OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URIs agregar: `http://localhost:3001/api/auth/google/callback`
4. Copiar Client ID y Client Secret al `backend/.env`

Flujo de login: `http://localhost:5173` → click "Entrar con Google" → redirect a Google → redirect a `http://localhost:5173/pedidos` con cookie.

---

### 6. Correr los tests del backend

```bash
cd backend
npm test
```

23 tests, todos deben pasar sin base de datos (usan mocks).

---

## Deploy en producción (pendiente)

### Paso 1 — Subir el repo a GitHub

```bash
gh repo create cocina --private
git remote add origin git@github.com:federicocroce/cocina.git
git push -u origin master
```

### Paso 2 — Base de datos en Neon

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto → nombrar "cocina"
3. Copiar la connection string (con `?sslmode=require`)
4. Correr la migración:
   ```bash
   psql "tu-neon-connection-string" -f backend/src/db/migrations/001_init.sql
   ```

### Paso 3 — Google OAuth (credenciales de producción)

En [Google Cloud Console](https://console.cloud.google.com):

1. Al OAuth Client ID existente, agregar authorized redirect URI de producción:
   ```
   https://<tu-render-service>.onrender.com/api/auth/google/callback
   ```
   (Podés agregar ambas URIs — dev y prod — al mismo cliente)

### Paso 4 — Backend en Render

1. Ir a [render.com](https://render.com) → New → Web Service
2. Conectar repo GitHub → seleccionar `cocina`
3. Configurar:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. Variables de entorno (en Render dashboard → Environment):

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | Connection string de Neon |
   | `GOOGLE_CLIENT_ID` | De Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | De Google Cloud Console |
   | `JWT_SECRET` | `openssl rand -hex 32` |
   | `CLIENT_URL` | `https://<tu-vercel-app>.vercel.app` |
   | `NODE_ENV` | `production` |

5. Deploy → esperar que termine → verificar:
   ```bash
   curl https://<tu-render-service>.onrender.com/health
   # → {"ok":true}
   ```

### Paso 5 — Frontend en Vercel

1. Crear `frontend/.env.production`:
   ```env
   VITE_API_URL=https://<tu-render-service>.onrender.com
   ```

2. Commitear y pushear:
   ```bash
   git add frontend/.env.production
   git commit -m "chore: production API URL"
   git push
   ```

3. Deploy:
   ```bash
   cd frontend
   npx vercel --prod
   ```
   O via Vercel dashboard: importar repo GitHub → Root Directory: `frontend` → Framework: Vite → Deploy.

4. Volver a Render → actualizar `CLIENT_URL` con la URL de Vercel → redeploy.

### Paso 6 — Smoke test final

1. Abrir `https://<tu-vercel-app>.vercel.app`
2. Click "Entrar con Google" → completar OAuth
3. Ir a `/sabores` → crear un sabor (ej: "Vainilla 🍦 $1500")
4. Ir a `/pedidos` → crear un pedido con ese sabor
5. Verificar que aparece el pedido con el precio calculado
6. Cambiar el estado inline → verificar que actualiza

---

## Notas

- **Cold start Render (free tier):** El backend duerme después de 15min sin uso. El primer request tarda ~30s. Normal en el plan gratuito.
- **Calculadora de ingredientes:** Muestra vacío hasta que haya recetas cargadas (la sección `/recetas` es la próxima etapa del proyecto).
- **Datos de prueba:** Para testear la calculadora, insertar manualmente en la DB:
  ```sql
  -- Ejemplo: agregar un ingrediente y conectarlo a un sabor
  INSERT INTO ingredients (name, unit, price_per_unit) VALUES ('Harina', 'kg', 500);
  INSERT INTO recipe_items (flavor_id, ingredient_id, quantity_per_budin)
    VALUES ('<id-sabor>', '<id-ingrediente>', 0.25);
  ```
