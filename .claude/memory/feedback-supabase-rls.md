---
name: Supabase RLS — usar adminClient para operaciones del socio
description: El socio no tiene permisos de escritura en sessions ni en el bucket receipts
type: feedback
originSessionId: d82768ce-accc-4262-ba6f-b52ca1e4ec4d
---
Cuando una Server Action actúa en nombre de un socio (usuario autenticado como socio, no staff), usar `createAdminSupabaseClient()` para cualquier INSERT/UPDATE en tablas protegidas o uploads a storage.

**Why:** El bucket `receipts` y la tabla `sessions` tienen RLS que solo permite escritura a staff. Un socio autenticado puede leer su sesión pero no puede hacer UPDATE ni subir archivos. El fallo es silencioso: el upload se queda colgado o la query devuelve error que se ignora.

**How to apply:**
- `uploadAndSaveVoucher` en `sessions/actions.ts` es el patrón de referencia: usa `adminClient` tanto para el upload de storage como para el UPDATE de `voucher_url` en sessions.
- Siempre importar desde `@/shared/lib/supabase-admin` (marcado como `server-only`).
- Nunca usar `adminClient` en componentes cliente — solo en Server Actions o Route Handlers.
