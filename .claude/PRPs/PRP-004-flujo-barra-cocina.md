# PRP-004 — Flujo Barra-Cocina optimizado

> Estado: **PLANIFICADO — pendiente de implementación**
> Fecha: 2026-04-16
> Rama base: `master` (commit `38b91eb`)

---

## Contexto y motivación

El flujo actual de cocina tiene varios problemas críticos:

1. El campo `prep_type` de `menu_items` existe pero no se usa para enrutar pedidos.
2. `getKitchenOrders()` muestra todos los `pending` — incluyendo bebidas que el camarero sirve directamente.
3. `addLineItems()` pone todo en `served` directo desde el POS, aunque sea un plato de cocina.
4. Cocina y barra pueden marcar el mismo item como servido (doble responsabilidad sin control).
5. No hay forma de cancelar un item agotado desde barra antes de que llegue a cocina.

### Principio de diseño acordado

> El camarero es el único responsable del ciclo de vida de cada pedido.
> Cocina es un **display pasivo** — solo ve lo que el camarero le manda.
> El socio recibe notificación automática cuando todo está resuelto.

---

## Modelo de estados

```
PEDIDO MÓVIL (socio)          PEDIDO POS (camarero)
       ↓                              ↓
   [pending]              prep='bar'     → [served] directo
       ↓                  prep='kitchen' → [sent_kitchen] directo
  camarero revisa
       ├── bar item     → [served]
       ├── kitchen item → [sent_kitchen] ──→ cocina prepara físicamente
       │                        ↓
       │              camarero recibe físicamente y marca
       │                        ↓
       │                   [served]
       └── agotado    → [cancelled] + push al socio con aviso
```

| Estado | Quién lo crea | Quién lo resuelve |
|--------|--------------|-------------------|
| `pending` | Socio (mobile order) | Camarero |
| `sent_kitchen` | Camarero | Camarero (al recibir físicamente de cocina) |
| `served` | Camarero | — |
| `cancelled` | Camarero | — (push automático al socio) |

---

## Fase 1 — Base de datos

**Archivo a crear:** `supabase/migrations/add_line_items_states.sql`

```sql
ALTER TABLE line_items
  DROP CONSTRAINT IF EXISTS line_items_state_check;

ALTER TABLE line_items
  ADD CONSTRAINT line_items_state_check
  CHECK (state IN ('pending', 'sent_kitchen', 'served', 'cancelled'));
```

**Aplicar con:** Supabase MCP → `apply_migration`

---

## Fase 2 — Tipos TypeScript

**Archivo:** `src/shared/types/domain.ts`

Cambiar línea 44:
```typescript
// Antes:
state: 'pending' | 'served';

// Después:
state: 'pending' | 'sent_kitchen' | 'served' | 'cancelled';
```

---

## Fase 3 — Sessions actions

**Archivo:** `src/features/sessions/actions.ts`

### 3a. Modificar `addLineItems()` (línea 159)

Cuando el camarero añade desde el POS, consultar `prep_type` de cada item antes de insertar:

```typescript
// Necesita fetch de prep_type antes de insertar
// prep_type='bar'     → state='served'     (como ahora)
// prep_type='kitchen' → state='sent_kitchen' (va directo a cocina)
```

### 3b. Nueva acción `sendToKitchen(lineItemIds: string[])`

- Cambia `state: 'pending'` → `'sent_kitchen'`
- Para cuando camarero revisa pedido móvil y deriva a cocina
- `revalidatePath('/bar')` y `revalidatePath('/kitchen')`

### 3c. Nueva acción `cancelLineItem(lineItemId: string)`

- Cambia `state: 'pending'` → `'cancelled'`
- Recalcula total de sesión
- Push al socio: "Lo sentimos, [producto] no está disponible. Contacta con el camarero."
- `revalidatePath('/bar')` y `revalidatePath('/socio')`

### 3d. Nueva acción `markDelivered(lineItemIds: string[])`

- Cambia `state: 'sent_kitchen'` → `'served'`
- Recalcula total de sesión (`syncSessionTotal`)
- Comprueba si quedan items en `pending` o `sent_kitchen` para esa sesión:
  - Si count = 0 → push al socio "Tu pedido está listo 🍻"
- `revalidatePath('/bar')`, `revalidatePath('/kitchen')`, `revalidatePath('/socio')`

> **Nota:** La lógica de notificación se mueve de `kitchen/actions.ts` a `sessions/actions.ts`.
> La cocina ya no llama a `markItemsServed`.

---

## Fase 4 — SessionDetail (refactor panel derecho)

**Archivo:** `src/features/sessions/components/SessionDetail.tsx`

El panel derecho (ticket) tendrá **tres secciones dinámicas**:

### Sección A — "Por revisar" (fondo naranja)
- Condición: solo aparece si hay items `source='mobile'` y `state='pending'`
- Items `prep_type='kitchen'` → color azul/morado, icono 🍳
- Items `prep_type='bar'` → color normal, icono 🍺
- Botones por item de barra: `✓ Servir` → llama `markDelivered([id])`
- Botones por item de cocina: `→ Cocina` → `sendToKitchen([id])` | `✗ No hay` → `cancelLineItem(id)`
- Botón global: `✓ Todo a cocina` si todos son de kitchen

### Sección B — "En cocina" (fondo azul)
- Condición: solo aparece si hay items `state='sent_kitchen'`
- Timer: minutos desde `created_at` del envío
- Si > 10 min → pulse rojo en el item (urgente, ir a buscar)
- Botón por item: `✓ Entregado` → `markDelivered([id])`
- Botón global: `✓ Todo entregado` si hay más de uno

### Sección C — "Consumos registrados" (como ahora)
- Items `state='served'`
- Items `state='cancelled'` → tachados en gris (visibilidad de lo que no se sirvió)

### Realtime a actualizar
El canal `session-detail-${id}` debe escuchar también actualizaciones de `sent_kitchen` y `cancelled`.

---

## Fase 5 — Kitchen Display (read-only)

### `src/features/kitchen/actions.ts`

- `getKitchenOrders()`: cambiar `.eq('state', 'pending')` → `.eq('state', 'sent_kitchen')`
- Eliminar export de `markItemsServed` (ya no se usa desde kitchen)

### `src/features/kitchen/components/KitchenDisplay.tsx`

- **Eliminar todos los botones** ✓ — cocina no interactúa con la app
- Display puramente visual: número socio, items, tiempo esperando
- Si > 10 min → tarjeta roja pulsante (señal visual para camarero)
- Realtime:
  - INSERT de `sent_kitchen` → aparece item (`router.refresh()` para traer datos completos)
  - UPDATE a `served` → desaparece item del display
- Estado vacío: "Cocina al día — Nada pendiente" (como ahora)

---

## Fase 6 — BarTerminal (badge doble)

**Archivo:** `src/features/sessions/components/BarTerminal.tsx`

El badge actual cuenta todos los `pending` mobile. Ampliar a dos indicadores por tarjeta:

```
📱 2 por revisar     ← state='pending' (mobile)
🍳 1 en cocina       ← state='sent_kitchen'
```

- `mobilePendingCounts` → renombrar a `pendingCounts` (items por revisar)
- Añadir `kitchenCounts` (items en sent_kitchen)
- El color ámbar actual → para `pending`
- Nuevo indicador azul → para `sent_kitchen`

El servidor debe calcular ambos conteos y pasarlos como props.

---

## Flujo de notificaciones push al socio

| Evento | Título | Body |
|--------|--------|------|
| Camarero cancela un item | "CasetaApp — Cambio en tu pedido" | "Lo sentimos, [X] no está disponible hoy." |
| Último item entregado (pending+sent_kitchen=0) | "CasetaApp — Tu pedido está listo 🍻" | "Pasa por la barra a recogerlo." |
| Camarero pide cuenta | "CasetaApp — Tu cuenta está lista" | "Total: XX€. Dirígete a la barra para pagar." |

---

## Resumen de ficheros a tocar

| Fichero | Tipo de cambio |
|---------|---------------|
| `supabase/migrations/add_line_items_states.sql` | **NUEVO** — constraint estados |
| `src/shared/types/domain.ts` | Pequeño — ampliar union type |
| `src/features/sessions/actions.ts` | Medio — modificar addLineItems + 3 nuevas acciones |
| `src/features/sessions/components/SessionDetail.tsx` | **GRANDE** — refactor panel derecho |
| `src/features/sessions/components/BarTerminal.tsx` | Medio — badge doble + conteos |
| `src/features/kitchen/actions.ts` | Pequeño — filtro + quitar export |
| `src/features/kitchen/components/KitchenDisplay.tsx` | Medio — eliminar botones, read-only |

**Total: 7 ficheros. Sin nuevas tablas. Sin cambio de arquitectura.**

---

## Orden de implementación recomendado

1. Fase 1 — Migración BD (base de todo)
2. Fase 2 — Tipos TS (evita errores en compilación)
3. Fase 3 — Sessions actions (lógica de negocio)
4. Fase 5 — Kitchen actions + display (más simple, sin botones)
5. Fase 4 — SessionDetail (cambio más grande)
6. Fase 6 — BarTerminal (badge)
7. `npm run typecheck` — verificar sin errores
8. Prueba manual del flujo completo con usuarios de prueba

---

## Prueba del flujo completo

```
1. socio1@caseta.com → pedir 1 cerveza + 1 tapa
2. bar@caseta.com → SessionDetail → ver sección "Por revisar"
   - Cerveza (bar) → ✓ Servir
   - Tapa (kitchen) → → Cocina
3. kitchen@caseta.com → ver tapa en display (sin botones)
4. bar@caseta.com → tapa aparece en "En cocina"
   - Simular que cocina entrega físicamente
   - ✓ Entregado → push al socio
5. socio1@caseta.com → recibe push "Tu pedido está listo"
6. Probar cancelación: pedir algo → camarero → ✗ No hay → socio recibe push de aviso
```

---

## Notas técnicas

- El campo `prep_type` ya existe en `menu_items` — no hay que crearlo.
- `addLineItems` necesita hacer un JOIN o fetch adicional de `menu_items` para conocer el `prep_type` antes de insertar. Alternativa: el cliente manda el `prep_type` en el payload (más eficiente).
- La acción `markItemsServed` en `kitchen/actions.ts` puede eliminarse completamente o mantenerse sin export (dead code). Mejor eliminar para limpieza.
- Los `revalidatePath` actuales en kitchen apuntan a `/kitchen`, `/bar`, `/socio` — mantener ese patrón.
