# CasetaApp — Documento Maestro de Traspaso

> Última actualización: 2026-04-13  
> Estado: **Desarrollo completo. Pruebas realizadas. Sistema funcionando.**

---

## Qué es esto

PWA para digitalizar cuentas de socios en casetas de feria. Los camareros gestionan sesiones desde barra, los socios piden desde móvil, la cocina ve los pedidos en tiempo real, y el admin gestiona todo.

**Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + Supabase (Auth + DB + Storage + Realtime)

---

## Estado actual — TODO implementado y probado

| Feature | Archivo principal | Estado |
|---------|------------------|--------|
| Auth (login/register/middleware) | `src/app/login/`, `src/app/register/` | ✅ Probado |
| Dispatcher de roles | `src/app/app/page.tsx` | ✅ Probado |
| BarTerminal + badge pedidos móviles | `src/features/sessions/components/BarTerminal.tsx` | ✅ Probado |
| POS de barra (SessionDetail) | `src/features/sessions/components/SessionDetail.tsx` | ✅ Probado |
| Dashboard socio (SocioDashboard) | `src/features/orders/components/SocioDashboard.tsx` | ✅ Implementado |
| Kitchen Display | `src/app/kitchen/`, `src/features/kitchen/` | ✅ Probado |
| Admin (stats, menú, staff, vouchers) | `src/app/admin/` | ✅ Implementado |
| PWA (manifest + service worker + iconos) | `public/manifest.json`, `public/sw.js`, `public/icons/` | ✅ Probado |
| Push Notifications (VAPID) | `src/shared/lib/push.ts`, `src/app/api/push/subscribe/` | ✅ Implementado |

---

## Supabase — Estado de la BD

**Project ID:** `xevjasexzqexkisfphrl`  
**URL:** https://xevjasexzqexkisfphrl.supabase.co  
**Estado:** ACTIVO ✅

### Migraciones ejecutadas ✅
- `sessions.voucher_url TEXT` — para URL de foto del talón
- `sessions.is_reconciled BOOLEAN DEFAULT FALSE` — para conciliación en admin
- Tabla `push_subscriptions` con RLS — para notificaciones push
- Policy `line_items_staff_update` — permite a staff marcar ítems como servidos

### Datos de prueba cargados ✅
- **Booth:** `b0000000-0000-0000-0000-000000000001` "Caseta Hermandad de la Esperanza"
- **Socios:** 65 socios (nº 1 a 65), Socio #1 vinculado a `socio1@caseta.com`
- **Menú:** Categorías Bebidas, Cervezas, Tapas, Raciones con 10+ artículos

### ⚠️ Pendiente manual (único paso sin hacer)
**Activar Replication** para que el realtime funcione sin refrescar:
- Supabase Dashboard → Database → Replication → activar `sessions` y `line_items`
- Sin esto el sistema funciona, pero los cambios no se propagan en tiempo real

---

## Usuarios de prueba (activos)

| Email | Contraseña | Rol | URL destino |
|-------|-----------|-----|-------------|
| `angeles@carrysoft.com` | `angeles` | owner | `/admin` |
| `bar@caseta.com` | `test1234` | waiter | `/bar` |
| `cocina@caseta.com` | `test1234` | kitchen | `/kitchen` |
| `socio1@caseta.com` | `test1234` | socio nº1 | `/socio` |

---

## Bugs corregidos en la última sesión

### 1. `/bar/session/[id]` redirigía siempre a `/bar`
**Causa:** Next.js 16 hace los `params` de rutas dinámicas asíncronos (Promise).  
**Fix en** `src/app/bar/session/[id]/page.tsx`:
```typescript
// Cambiado de:
export default async function SessionPage({ params }: { params: { id: string } })
// A:
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
```
> **Regla general para Next.js 16:** TODOS los parámetros de rutas dinámicas deben ser `Promise<{...}>` y usar `await params`.

### 2. `markItemsServed` no actualizaba la BD
**Causa:** No había RLS policy de UPDATE en `line_items`.  
**Fix:** Se añadió en Supabase:
```sql
CREATE POLICY line_items_staff_update ON line_items FOR UPDATE
USING (session_id IN (SELECT s.id FROM sessions s WHERE is_staff_of_booth(s.booth_id)));
```

---

## Cómo arrancar

```bash
cd C:\Users\carry\OneDrive\Documentos\Proyectos\SaasFeria
npm run dev
# → http://localhost:3000
```

**Verificación rápida:**
```
http://localhost:3000/manifest.json  → JSON con name, icons, display:standalone
http://localhost:3000/sw.js          → JavaScript del Service Worker
http://localhost:3000/icons/icon-192.png → PNG 192x192
```

---

## Arquitectura de rutas

```
/login, /register     → Auth pública
/app                  → Dispatcher de roles (requiere auth)
/bar                  → Terminal camarero — grid cuentas + badge pedidos móviles
/bar/session/[id]     → POS de barra — añadir consumos, cobrar
/kitchen              → Display cocina — pedidos móviles pendientes en tiempo real
/socio                → Dashboard móvil socio — ver cuenta, pedir, historial
/admin                → Panel gestor — stats, menú, staff, vouchers, settings
```

## Roles y accesos

| Rol | Tabla | Accede a |
|-----|-------|----------|
| `owner` | `staff_users.staff_role='owner'` | `/admin` |
| `kitchen` | `staff_users.staff_role='kitchen'` | `/kitchen` |
| `waiter` | `staff_users.staff_role='waiter'` | `/bar` |
| socio | tabla `socios` | `/socio` |

---

## Documentos del proyecto

| Archivo | Para qué |
|---------|----------|
| **`HANDOFF.md`** (este archivo) | Estado completo, bugs, arquitectura, setup |
| **`GUIA_PRUEBAS.md`** | Guía multi-dispositivo para pruebas en entorno real — **LEER PARA HACER PRUEBAS** |

---

## Flujo de negocio completo

1. **Apertura:** Camarero busca socio por nº → abre sesión en `/bar`
2. **Consumos barra:** Camarero añade ítems en POS → `state='served'` directo
3. **Pedido móvil:** Socio pide desde `/socio` → `line_items source='mobile' state='pending'`
4. **Badge barra:** BarTerminal muestra número de pedidos móviles pendientes por sesión
5. **Cocina:** KitchenDisplay muestra pendientes → staff marca como servido
6. **Cobro:** Camarero pulsa "Pedir Cuenta" → sesión status='closing' → push al socio → pago Efectivo/TPV o Foto Talón → `closed`
7. **Conciliación:** Admin revisa y marca como reconciliado en `/admin/vouchers`

---

## Notas de arquitectura críticas

- Los pedidos móviles van a `line_items` con `source='mobile'`, `state='pending'`
- Los ítems de barra se añaden con `state='served'` directamente (no pasan por cocina)
- `paySession()` sube foto al bucket `receipts`, guarda URL en `sessions.voucher_url`
- `sendPushToUser()` requiere `SUPABASE_SERVICE_ROLE_KEY` para bypassear RLS — ya configurado en `.env.local`
- Todos los params de rutas dinámicas en Next.js 16 son `Promise<{...}>` y requieren `await`

---

## .env.local actual (completo)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xevjasexzqexkisfphrl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhldmphc2V4enFleGtpc2ZwaHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODQ5NDQsImV4cCI6MjA4Nzk2MDk0NH0.Dl6ncJHts2ui5nUy4f-lIPNskjZ4YHiDV3GHPIbbpQE
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBAyawt24yzO8QiQtNATICR5jhKQ3G3LHsYAwhaaU0kjVycEiNja30GXbTqJjYVXx5BsJ6GRh3XtiHfR2HRVqoc
VAPID_PRIVATE_KEY=V-Nmsv64NmNHKgrzG3NF_qPxkehdlaFElfcMBNf4PjY
VAPID_SUBJECT=mailto:admin@casetaapp.com
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhldmphc2V4enFleGtpc2ZwaHJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM4NDk0NCwiZXhwIjoyMDg3OTYwOTQ0fQ.elVumKIxhhIsHt-aFk-vvYPx5hbQTKeZBpvIsSZ8NBw
```

---

## Comandos útiles

```bash
npm run dev        # Dev server
npm run typecheck  # TypeScript — debe pasar sin errores ✅
npm run build      # Build de producción
npm run lint       # ESLint
```

## Supabase Management API (para ejecutar SQL sin MCP)

```bash
curl -X POST "https://api.supabase.com/v1/projects/xevjasexzqexkisfphrl/database/query" \
  -H "Authorization: Bearer sbp_4a09e768e509996e523305d5adc9450479822be0" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```
