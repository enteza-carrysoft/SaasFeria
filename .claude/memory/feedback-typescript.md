---
name: No usar `any` en TypeScript
description: Usar siempre los tipos de domain.ts en lugar de `any`
type: feedback
originSessionId: 7c1be907-81e3-46a9-9e19-4f21c548106f
---
Nunca usar `any` o `as any` en el código. El proyecto tiene `src/shared/types/domain.ts` con todos los tipos del dominio.

**Why:** El usuario quiere TypeScript estricto. Los `any` ocultan errores en tiempo de desarrollo y hacen el código frágil.

**How to apply:**
- Para errores en catch: `catch (e) { ... e instanceof Error ? e.message : 'Error' }`
- Para selects HTML con union types: `e.target.value as 'opcion1' | 'opcion2'`
- Para datos de Supabase: importar el tipo de domain.ts y castear con `as Tipo`
- Para realtime payloads: castear `payload.new as MiTipo`
