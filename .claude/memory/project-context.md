---
name: CasetaApp — Contexto del proyecto
description: Descripción general, roles, stack, tablas BD, componentes y flujos actuales
type: project
originSessionId: d82768ce-accc-4262-ba6f-b52ca1e4ec4d
---
CasetaApp es una PWA para gestionar casetas de feria: pedidos, consumos y cuentas de socios en tiempo real.

**URL Producción**: https://saas-feria.vercel.app
**Repo**: https://github.com/enteza-carrysoft/SaasFeria

**Stack**: Next.js 16 + Supabase + Tailwind + Web Push

**Roles**: Socio (/socio), Camarero (/bar), Cocina (/kitchen), Admin (/admin)

**Tablas BD**: sessions, line_items, menu_items, menu_categories, socios, socio_autorizados, staff_users, push_subscriptions, booths

**Tipos compartidos**: `src/shared/types/domain.ts` — Socio, Session, LineItem, MenuCategory, MenuItem, StaffUser, SocioAutorizado

**Multi-tenant**: todo filtrado por `booth_id`. `staff_role` usa los valores `'owner'|'waiter'|'kitchen'` (no 'admin').

---

## Componentes principales

| Componente | Ruta | Descripción |
|---|---|---|
| `SocioDashboard` | `src/features/orders/components/` | App del socio: tabs Cuenta / Pedir / Historial / Perfil |
| `SessionDetail` | `src/features/sessions/components/` | TPV del camarero: añadir ítems, servir pedidos, cobrar |
| `BarTerminal` | `src/features/sessions/components/` | Vista de mesas activas del camarero |
| `StaffManager` | `src/features/staff/components/` | Gestión de socios y autorizados |
| `IdentityGate` | `src/shared/components/` | Selector de identidad titular/autorizado en app socio |
| `SocioIdentityHeader` | `src/shared/components/` | Header con identidad activa en app socio |
| `supabase-admin.ts` | `src/shared/lib/` | Cliente service_role para Server Actions que bypasean RLS |

---

## Flujo de pago actual (2026-04-15)

1. Camarero abre cuenta → `openSession()`
2. Se añaden ítems (bar: `addLineItems` → served directo; móvil: `placeMobileOrder` → pending)
3. Camarero marca ítems móviles como servidos → `markItemsServed()` → actualiza `total_amount`
4. Camarero pulsa "Pedir Cuenta" → `closeSession()` → status = 'closing'
5. **Socio** toma foto del talón desde su app → `uploadAndSaveVoucher()` → guarda en `session.voucher_url`
6. Camarero pulsa "Efectivo/TPV" → `paySession()` → status = 'closed', recalcula `total_amount` desde todos los line_items

**Importante**: `paySession()` NO toca `voucher_url` (ya está guardada por el socio). Recalcula `total_amount` desde pending+served para garantizar exactitud.

---

## Patrones críticos

- **Upload de storage desde socio**: usar siempre `createAdminSupabaseClient()` — el bucket `receipts` tiene RLS que solo permite staff. Ver `uploadAndSaveVoucher` en `sessions/actions.ts`.
- **Updates de sessions desde socio**: usar `adminClient` — socios no tienen permiso RLS para UPDATE en la tabla sessions.
- **Total en SocioDashboard**: se calcula desde `lines` (state local, pending+served) no desde `session.total_amount` para reflejar pedidos enviados inmediatamente.
- **Next.js server actions body limit**: configurado en `10mb` en `next.config.ts`. Imágenes de cámara se comprimen con canvas antes de enviar (~300KB).
- **Anular cuenta vacía**: cuando `session.status === 'open'` y `lines.length === 0`, el camarero ve botón "Anular Cuenta" → `voidSession()`.
