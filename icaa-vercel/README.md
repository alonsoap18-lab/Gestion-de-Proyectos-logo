# 🏗️ Grupo ICAA Constructora — Vercel + Supabase

Sistema completo de gestión de construcción desplegado en **Vercel** con base de datos **Supabase (PostgreSQL)** permanente.

---

## 🚀 Deploy Completo — Paso a Paso

### PASO 1 — Crear base de datos en Supabase

1. Ve a **https://supabase.com** → Crear cuenta gratuita
2. Click **"New Project"**
   - Name: `icaa-constructora`
   - Database Password: (anota esta contraseña)
   - Region: elige la más cercana (ej: `us-east-1`)
3. Espera ~2 minutos a que el proyecto se cree

4. Ve a **SQL Editor** (ícono de terminal en el sidebar)
5. Click **"New Query"**
6. **Copia y pega todo el contenido del archivo `supabase_schema.sql`**
7. Click **"Run"** → Verás "Success" al final

✅ Tu base de datos está lista con usuarios, proyectos, tareas y datos de prueba.

---

### PASO 2 — Obtener credenciales de Supabase

En tu proyecto Supabase:
1. Ve a **Project Settings** (ícono de engranaje) → **API**
2. Anota:
   - **Project URL**: `https://xxxx.supabase.co`
   - **service_role** key (la que dice "secret") — bajo "Project API keys"

⚠️ Nunca expongas la `service_role` key en el frontend.

---

### PASO 3 — Subir el proyecto a GitHub

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "Initial commit - ICAA Constructora"

# Crea un repo en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/icaa-constructora.git
git push -u origin main
```

---

### PASO 4 — Deploy en Vercel

1. Ve a **https://vercel.com** → Crear cuenta (puedes usar GitHub)
2. Click **"Add New Project"**
3. Importa tu repositorio de GitHub
4. En la pantalla de configuración:
   - **Framework Preset**: `Other`
   - **Root Directory**: `.` (raíz)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `cd api && npm install`

5. Expande **"Environment Variables"** y agrega:

   | Variable | Valor |
   |----------|-------|
   | `SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (service_role key) |
   | `JWT_SECRET` | cualquier string largo aleatorio |

6. Click **"Deploy"** → Espera ~2 minutos

7. 🎉 Tu app está en vivo en `https://icaa-constructora.vercel.app` (o similar)

---

### Desarrollo Local

```bash
# Instalar Vercel CLI (una sola vez)
npm install -g vercel

# En la raíz del proyecto, crear .env.local con tus variables
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Instalar dependencias
cd api && npm install && cd ..
cd frontend && npm install && cd ..

# Correr localmente (simula Vercel serverless functions)
vercel dev
# → App en http://localhost:3000
```

---

## 🔐 Credenciales de Acceso

| Campo    | Valor                  |
|----------|------------------------|
| Email    | `admin@grupoicaa.com`  |
| Password | `ICAAadmin2026`        |

**Usuarios adicionales** (password: `icaa1234`):
- `carlos@grupoicaa.com` — Engineer
- `ana@grupoicaa.com` — Engineer  
- `luis@grupoicaa.com` — Supervisor
- `pedro@grupoicaa.com` — Worker
- `maria@grupoicaa.com` — Worker

---

## 📁 Estructura del Proyecto

```
icaa-vercel/
├── vercel.json              ← Config de Vercel (routing SPA + API)
├── .env.example             ← Variables de entorno requeridas
├── supabase_schema.sql      ← Schema + seed data (correr en Supabase)
│
├── api/                     ← Serverless functions (Node.js)
│   ├── package.json         ← Solo: @supabase/supabase-js, bcryptjs, jsonwebtoken
│   ├── lib/
│   │   └── supabase.js      ← Cliente Supabase + helpers JWT + dispatcher
│   ├── auth.js              ← POST /api/auth/login | GET /api/auth/me
│   ├── users.js             ← CRUD /api/users
│   ├── projects.js          ← CRUD /api/projects + miembros + Gantt
│   ├── tasks.js             ← CRUD /api/tasks + PATCH position
│   ├── calendar.js          ← CRUD /api/calendar
│   ├── machinery.js         ← CRUD /api/machinery
│   ├── materials.js         ← CRUD /api/materials
│   └── dashboard.js         ← GET /api/dashboard (KPIs)
│
└── frontend/                ← React + Vite + Tailwind
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx          ← Router con guards por rol
        ├── index.css        ← Design tokens Tailwind
        ├── lib/api.js       ← Axios client (baseURL: /api)
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── layout/      ← Sidebar + Layout
        │   ├── ui/          ← Badge, Modal, Progress, etc.
        │   └── gantt/       ← GanttChart drag & drop
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Projects.jsx
            ├── ProjectDetail.jsx   ← Gantt + Tareas + Equipo + Info
            ├── Tasks.jsx
            ├── Employees.jsx
            ├── Calendar.jsx
            ├── Reports.jsx
            ├── Machinery.jsx
            ├── Materials.jsx
            └── Users.jsx
```

---

## 🏗️ Arquitectura

```
Browser (React SPA)
    ↓ fetch /api/*
Vercel Edge Network
    ↓ routes to serverless function
api/*.js (Node.js serverless)
    ↓ @supabase/supabase-js
Supabase PostgreSQL (hosted, permanente)
```

- **Frontend**: React 18 + Vite → deploy como archivos estáticos en Vercel CDN
- **Backend**: Funciones serverless Node.js en Vercel (no hay servidor Express)
- **Database**: Supabase PostgreSQL — persiste entre deploys, siempre activa
- **Auth**: JWT firmado en el serverless, verificado en cada request

---

## 🎯 Módulos Incluidos

| Módulo | Ruta |
|--------|------|
| Dashboard | `/` |
| Proyectos | `/projects` |
| Detalle + Gantt | `/projects/:id` |
| Tareas | `/tasks` |
| Empleados | `/employees` |
| Calendario | `/calendar` |
| Reportes + CSV | `/reports` |
| Maquinaria | `/machinery` |
| Materiales | `/materials` |
| Usuarios (Admin) | `/users` |

---

## ❓ Problemas Comunes

**"Error 401 en todas las rutas"**
→ Verifica que `JWT_SECRET` esté configurada en Vercel Environment Variables

**"Error 500 al hacer login"**
→ Verifica `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel

**"La app carga pero no hay datos"**
→ Asegúrate de haber corrido el SQL completo en Supabase (incluyendo el bloque DO $$ con el seed)

**"Build falla en Vercel"**
→ Verifica que el Build Command sea exactamente: `cd frontend && npm install && npm run build`

---

*© 2026 Grupo ICAA Constructora*
