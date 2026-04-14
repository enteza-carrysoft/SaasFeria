# CasetaApp — Documento Maestro de Traspaso

> Última actualización: 2026-04-14  
> Estado: **Desarrollo completo. Autorizados implementados. Sistema probado.**  
> Último commit: `05faaca` — `feat: autorizados por socio — identidades múltiples y gestión completa`

---

## Qué es esto

PWA para digitalizar cuentas de socios en casetas de feria. Los camareros gestionan sesiones desde barra, los socios piden desde móvil, la cocina ve los pedidos en tiempo real, y el admin gestiona todo.

**Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + Supabase (Auth + DB + Storage + Realtime)

---

## Cómo arrancar

```bash
cd C:\Users\carry\OneDrive\Documentos\Proyectos\SaasFeria
npm run dev
# → http://localhost:3000
```

Si hay errores raros de caché (ChunkLoadError):
```bash
# Parar el servidor, luego:
Remove-Item -Recurse -Force .next   # PowerShell
npm run dev
```

---

## Usuarios de prueba (activos en Supabase)

| Email | Contraseña | Rol | URL |
|-------|-----------|-----|-----|
| `angeles@carrysoft.com` | `angeles` | owner | `/admin` |
| `bar@caseta.com` | `test1234` | waiter | `/bar` |
| `cocina@caseta.com` | `test1234` | kitchen | `/kitchen` |
| `socio1@caseta.com` | `test1234` | socio nº1 | `/socio` |

- **Booth ID:** `b0000000-0000-0000-0000-000000000001` — "Caseta Hermandad de la Esperanza"
- **Socios:** 65 registros (nº 1–65). Socio #1 vinculado a `socio1@caseta.com`
- **Menú:** Bebidas, Cervezas, Tapas, Raciones — 10+ artículos

---

## Features implementadas

| Feature | Archivo principal | Estado |
|---------|------------------|--------|
| Auth (login / sin registro público) | `src/app/login/`, `src/app/register/` | ✅ |
| Dispatcher de roles | `src/app/app/page.tsx` | ✅ |
| BarTerminal + badge pedidos móviles | `src/features/sessions/components/BarTerminal.tsx` | ✅ |
| POS de barra (SessionDetail) | `src/features/sessions/components/SessionDetail.tsx` | ✅ |
| Dashboard socio (cuenta, pedir, historial, perfil) | `src/features/orders/components/SocioDashboard.tsx` | ✅ |
| Kitchen Display | `src/features/kitchen/` | ✅ |
| Admin (stats, menú, staff, vouchers) | `src/app/admin/` | ✅ |
| PWA (manifest + service worker + iconos) | `public/` | ✅ |
| Push Notifications (VAPID) | `src/shared/lib/push.ts` | ✅ |
| **Autorizados por socio** | ver sección abajo | ✅ |

---

## Feature: Autorizados por socio

### Qué hace
Cada socio puede tener personas autorizadas (hijos, familiares) que tienen **sus propias sesiones simultáneas** sin interferirse entre sí.

### Flujo de usuario

**Socio en `/socio`:**
1. Si tiene autorizados → pantalla "¿Quién accede?" con lista de nombres
2. Elige su identidad → se guarda en `localStorage` (key: `caseta_identity_${socioId}`)
3. Ve solo su propia sesión en "Mi Cuenta"
4. "Historial" muestra todas las sesiones del socio, con badge del nombre del autorizado
5. Pestaña "Perfil" → puede cambiar su nombre, email, contraseña y gestionar autorizados

**Camarero en `/bar`:**
1. Modal abrir cuenta: introduce nº de socio → si tiene autorizados, aparece paso 2
2. Selecciona quién (titular o autorizado) → abre sesión para esa identidad

**Admin en `/admin/staff`:**
- Fila expandible por socio: editar nombre/número, crear/editar credenciales app, gestionar autorizados

### Base de datos
```sql
-- Tabla nueva
socio_autorizados (id, socio_id FK, booth_id FK, display_name, is_active, created_at)

-- Columna nueva en sessions
sessions.autorizado_id → FK socio_autorizados (nullable = titular)

-- Índices únicos parciales
UNIQUE WHERE status='open' AND autorizado_id IS NULL      -- un titular abierto a la vez
UNIQUE WHERE status='open' AND autorizado_id IS NOT NULL  -- un autorizado abierto a la vez
```

### Ficheros clave
```
src/shared/
  components/IdentityGate.tsx        → Context + pantalla selección identidad
  components/SocioIdentityHeader.tsx → Header con nombre + botón cambiar identidad
  lib/supabase-admin.ts              → Cliente service_role (crear auth users)

src/features/orders/
  actions.ts                         → getActiveSocioSessions(), updateSocioProfile()
  components/SocioDashboard.tsx      → sessions[], filtra por identidad, Realtime
  components/SocioPerfil.tsx         → Pestaña perfil del socio

src/features/sessions/
  actions.ts                         → openSession(autorizadoId?), getAutorizadosBySocioNumber()
  components/OpenSessionModal.tsx    → 2 pasos: número → identidad
  components/BarTerminal.tsx         → muestra nombre autorizado en tarjeta

src/features/staff/
  actions.ts                         → addAutorizado, updateAutorizado, toggleAutorizadoStatus, createSocioAccount
  components/SocioRow.tsx            → fila expandible admin
  components/StaffManager.tsx        → lista socios

supabase/migrations/socio_autorizados.sql
```

---

## Flujo de negocio completo

1. **Apertura:** Camarero busca socio por nº → si tiene autorizados, elige identidad → abre sesión
2. **Consumos barra:** Añade ítems en POS → `line_items source='bar' state='served'`
3. **Pedido móvil:** Socio pide desde `/socio` → `line_items source='mobile' state='pending'`
4. **Badge barra:** BarTerminal muestra nº pedidos móviles pendientes por sesión
5. **Cocina:** KitchenDisplay muestra pendientes → staff marca como servido
6. **Cobro:** Camarero "Pedir Cuenta" → `status='closing'` → push al socio → pago → `closed`
7. **Conciliación:** Admin revisa y marca reconciliado en `/admin/vouchers`

---

## Supabase — Estado de la BD

**Project ID:** `xevjasexzqexkisfphrl`  
**Dashboard:** https://supabase.com/dashboard/project/xevjasexzqexkisfphrl

### Migraciones ejecutadas ✅
| Migración | Estado |
|-----------|--------|
| `sessions.voucher_url TEXT` | ✅ |
| `sessions.is_reconciled BOOLEAN` | ✅ |
| Tabla `push_subscriptions` + RLS | ✅ |
| Policy `line_items_staff_update` | ✅ |
| Tabla `socio_autorizados` + `sessions.autorizado_id` + índices | ✅ |

### ⚠️ Pendiente: Activar Replication
Para que Realtime funcione sin refresh manual:
- Supabase Dashboard → Database → Replication → activar `sessions`, `line_items`, `socio_autorizados`

---

## Arquitectura de rutas y roles

```
/login              → Auth pública (registro deshabilitado — admin crea cuentas)
/app                → Dispatcher de roles
/bar                → waiter / owner — grid cuentas + badge pedidos móviles
/bar/session/[id]   → waiter / owner — POS: añadir consumos, cobrar
/kitchen            → kitchen / owner — cola pedidos tiempo real
/socio              → socio — cuenta, pedir, historial, perfil
/admin              → owner — stats, menú, personal, vales, ajustes
```

| Rol | Tabla | URL |
|-----|-------|-----|
| `owner` | `staff_users.staff_role='owner'` | `/admin` |
| `kitchen` | `staff_users.staff_role='kitchen'` | `/kitchen` |
| `waiter` | `staff_users.staff_role='waiter'` | `/bar` |
| socio | tabla `socios` | `/socio` |

---

## Notas de arquitectura críticas

- Pedidos móviles → `line_items` con `source='mobile'`, `state='pending'`
- Consumos barra → `line_items` con `source='bar'`, `state='served'` (no pasan por cocina)
- `paySession()` sube foto al bucket `receipts`, guarda URL en `sessions.voucher_url`
- `sendPushToUser()` usa `SUPABASE_SERVICE_ROLE_KEY` para bypassear RLS
- `createAdminSupabaseClient()` en `src/shared/lib/supabase-admin.ts` — **solo usar en Server Actions**
- **Next.js 16:** params de rutas dinámicas son `Promise<{id}>` → siempre `const { id } = await params`
- Identidad en cliente: `localStorage` clave `caseta_identity_${socioId}` → `{ autorizadoId, displayName }`
- Registro público deshabilitado: `/register` redirige a `/login`

---

## Bugs conocidos / fixes aplicados

| Bug | Causa | Fix |
|-----|-------|-----|
| `/bar/session/[id]` redirigía siempre | Next.js 16 params es Promise | `const { id } = await params` |
| `markItemsServed` no actualizaba BD | Faltaba RLS UPDATE en line_items | Policy añadida en Supabase |
| ChunkLoadError en navegación privada | Caché Turbopack obsoleta | Borrar `.next` y reiniciar |
| `useRef` con función lazy | useRef no acepta initializer fn | `useRef(valor)` no `useRef(() => valor)` |

---

## Comandos

```bash
npm run dev        # Dev server (Turbopack) → localhost:3000
npm run typecheck  # TypeScript — debe pasar sin errores
npm run build      # Build producción
npm run lint       # ESLint
```

---

## .env.local (completo — no commitear)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xevjasexzqexkisfphrl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhldmphc2V4enFleGtpc2ZwaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODQ5NDQsImV4cCI6MjA4Nzk2MDk0NH0.Dl6ncJHts2ui5nUy4f-lIPNskjZ4YHiDV3GHPIbbpQE
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBAyawt24yzO8QiQtNATICR5jhKQ3G3LHsYAwhaaU0kjVycEiNja30GXbTqJjYVXx5BsJ6GRh3XtiHfR2HRVqoc
VAPID_PRIVATE_KEY=V-Nmsv64NmNHKgrzG3NF_qPxkehdlaFElfcMBNf4PjY
VAPID_SUBJECT=mailto:admin@casetaapp.com
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhldmphc2V4enFleGtpc2ZwaHJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM4NDk0NCwiZXhwIjoyMDg3OTYwOTQ0fQ.elVumKIxhhIsHt-aFk-vvYPx5hbQTKeZBpvIsSZ8NBw
```
