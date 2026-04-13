# CasetaApp — Guía de Pruebas en Entorno Real

> Versión: 2026-04-13  
> Propósito: Validar el flujo completo de la aplicación con múltiples dispositivos reales,  
> simulando un día de caseta desde la apertura hasta la liquidación de vales.

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Asignación de dispositivos y roles](#2-asignación-de-dispositivos-y-roles)
3. [Fase 0 — Configuración inicial (Admin)](#fase-0--configuración-inicial-admin)
4. [Fase 1 — Verificación de accesos](#fase-1--verificación-de-accesos)
5. [Fase 2 — Flujo completo de caseta](#fase-2--flujo-completo-de-caseta)
6. [Fase 3 — Liquidación y conciliación](#fase-3--liquidación-y-conciliación)
7. [Referencia rápida por rol](#referencia-rápida-por-rol)
8. [Credenciales de prueba](#credenciales-de-prueba)
9. [Resolución de problemas](#resolución-de-problemas)

---

## 1. Requisitos previos

Antes de iniciar las pruebas verificar que:

- [ ] El servidor de desarrollo está corriendo: `npm run dev` → http://localhost:3000  
  *(o sustituir `localhost:3000` por la IP local de la máquina si los dispositivos se conectan en red local)*
- [ ] Supabase está activo (no pausado): entrar a https://supabase.com/dashboard/project/xevjasexzqexkisfphrl y verificar que **no** aparece el banner "Project paused"
- [ ] Todos los dispositivos están en la misma red WiFi
- [ ] Se conoce la IP local del ordenador donde corre el servidor (ej. `192.168.1.X`):  
  ```bash
  # En Windows:
  ipconfig
  # Buscar "Dirección IPv4" en el adaptador WiFi
  ```

> **Nota sobre IP local:** En los dispositivos móviles usar `http://192.168.1.X:3000` en lugar de `localhost:3000`.

---

## 2. Asignación de dispositivos y roles

Para cubrir el flujo completo necesitas **mínimo 3 dispositivos**, idealmente 4:

| Dispositivo | Rol | URL de acceso | Quién lo usa |
|-------------|-----|---------------|--------------|
| **PC principal / tablet grande** | `owner` (Administrador) | `/admin` | Gestor de la caseta |
| **Tablet o PC secundario** | `waiter` (Camarero) | `/bar` | Camarero en la barra |
| **Tablet o pantalla cocina** | `kitchen` (Cocina) | `/kitchen` | Cocinero / preparador |
| **Móvil (smartphone)** | socio | `/socio` | El socio de la caseta |

> Si sólo hay 3 dispositivos: el mismo PC puede tener abiertas dos pestañas con `owner` y `kitchen`.

---

## Fase 0 — Configuración inicial (Admin)

**Dispositivo:** PC principal  
**Sesión:** `angeles@carrysoft.com` / `angeles`  
**URL:** http://localhost:3000/admin

Esta fase la realiza el gestor **una sola vez** antes del día de caseta. Si ya existe configuración previa, saltar a la Fase 1.

---

### 0.1 — Crear categorías y productos del menú

1. Acceder a `/admin` → menú lateral → **Catálogo y Productos**
2. Crear categorías (si no existen). Ejemplos:
   - "Bebidas"
   - "Cervezas"  
   - "Tapas"
   - "Raciones"
3. Para cada categoría, añadir productos con nombre y precio:

| Categoría | Producto | Precio |
|-----------|----------|--------|
| Bebidas | Fino | 2,00€ |
| Bebidas | Rebujito | 3,00€ |
| Bebidas | Tinto de verano | 2,50€ |
| Bebidas | Agua | 1,00€ |
| Bebidas | Refresco | 1,50€ |
| Cervezas | Caña | 2,00€ |
| Cervezas | Tercio | 2,50€ |
| Tapas | Montadito jamón | 2,50€ |
| Tapas | Montadito lomo | 2,00€ |
| Raciones | Jamón ibérico | 12,00€ |

4. Verificar que los productos aparecen en la lista y están **activos** (toggle activado).

> **Ya configurado en el sistema de prueba:** Los productos anteriores ya están cargados. Este paso solo es necesario si se parte de cero.

---

### 0.2 — Crear socios

1. En `/admin` → **Personal y Socios** → pestaña **Socios**
2. Añadir socios con:
   - **Nº de socio** (número único, ej: 1, 2, 3...)
   - **Nombre visible** (ej: "Juan García")
   - **Email** (opcional — para vincular cuenta de acceso)

> **Ya configurados:** Socios del 1 al 65 están creados en el sistema. El Socio nº 1 tiene cuenta activa: `socio1@caseta.com` / `test1234`.

Para crear más socios con acceso desde móvil, ejecutar en Supabase SQL Editor:
```sql
-- 1. Crear usuario en Supabase Auth (sin confirmación de email)
-- Hacerlo desde Admin → Personal y Socios → "Nuevo Socio" (si la UI lo permite)
-- O manualmente via SQL + vinculación

-- 2. Vincular usuario existente como socio
SELECT id FROM auth.users WHERE email = 'nuevo@email.com';
INSERT INTO socios (booth_id, user_id, display_name, socio_number)
VALUES ('b0000000-0000-0000-0000-000000000001', '<user_id>', 'Nombre Socio', <numero>);
```

---

### 0.3 — Crear personal (camarero, cocina)

1. En `/admin` → **Personal y Socios** → pestaña **Personal**
2. Añadir miembros del staff:
   - Email del usuario (debe estar registrado en `/register` primero)
   - Rol: `waiter` (camarero) | `kitchen` (cocina) | `owner` (gestor)

> **Ya configurado:**
> - `bar@caseta.com` / `test1234` → rol `waiter`
> - `cocina@caseta.com` / `test1234` → rol `kitchen`

---

## Fase 1 — Verificación de accesos

Cada dispositivo hace login y verifica que llega a la pantalla correcta.

### Dispositivo 1 — Admin (PC principal)

1. Ir a http://localhost:3000/login
2. Login: `angeles@carrysoft.com` / `angeles`
3. **Resultado esperado:** Redirección a `/admin`
4. Verificar que se ve: Vista General con métricas, menú lateral con Catálogo / Personal / Vales / Ajustes

### Dispositivo 2 — Camarero (tablet barra)

1. Ir a http://`<IP-servidor>`:3000/login
2. Login: `bar@caseta.com` / `test1234`
3. **Resultado esperado:** Redirección a `/bar`
4. Verificar: Grid de cuentas vacío con botón "+ ABRIR CUENTA"
5. Instalar como PWA (en Chrome: icono de instalar en la barra de URL, o menú → "Añadir a pantalla de inicio")

### Dispositivo 3 — Cocina (tablet/pantalla cocina)

1. Ir a http://`<IP-servidor>`:3000/login
2. Login: `cocina@caseta.com` / `test1234`
3. **Resultado esperado:** Redirección a `/kitchen`
4. Verificar: Pantalla "Cocina al día — No hay pedidos pendientes"

### Dispositivo 4 — Socio (móvil)

1. Abrir Chrome en el móvil → http://`<IP-servidor>`:3000/login
2. Login: `socio1@caseta.com` / `test1234`
3. **Resultado esperado:** Redirección a `/socio`
4. Verificar: Panel del socio con tabs "Mi Cuenta", "Pedir", "Historial"
5. Instalar como PWA: Chrome → menú (3 puntos) → "Añadir a pantalla de inicio"

---

## Fase 2 — Flujo completo de caseta

### Escenario: Un socio llega a la caseta, pide, recoge, vuelve a pedir y liquida con vale

---

### PASO 1 — Camarero abre cuenta al socio

**Dispositivo:** Camarero (tablet barra) → `/bar`

1. Pulsar botón **"+ ABRIR CUENTA"**
2. En el teclado numérico, introducir el **número de socio** (ej: `1` para Socio #1)
3. Pulsar **"Abrir Mesa"**
4. **Resultado esperado:**
   - La tarjeta del socio aparece en el grid de cuentas
   - Muestra: "#1 — Socio 1 — Total: 0,00€"
5. Pulsar sobre la tarjeta para entrar al POS de la cuenta

---

### PASO 2 — Camarero añade consumos desde la barra

**Dispositivo:** Camarero (tablet barra) → `/bar/session/[id]`

1. Seleccionar categoría (ej: "Bebidas")
2. Pulsar sobre los productos para añadirlos al carrito:
   - 2× Fino (aparece "Pedido Pendiente (Sin marchar) +4,00€")
   - 1× Rebujito (total pendiente +7,00€)
3. Revisar el "Pedido Pendiente" en el panel derecho
4. Pulsar **"Marchar Pedido (7,00€)"**
5. **Resultado esperado:**
   - El pedido pasa a "Consumos Registrados": "1× Fino 2,00€", "2× Fino 2,00€", "1× Rebujito 3,00€"
   - *(En función de la agrupación del servidor)*
   - Total Cuenta: 7,00€
   - Botón "Pedir Cuenta" activo

> Los consumos añadidos desde barra van directamente a `state='served'` — no pasan por cocina.

---

### PASO 3 — Socio pide desde su móvil

**Dispositivo:** Socio (móvil) → `/socio`

*El camarero ya tiene la cuenta abierta. El socio lo ve automáticamente.*

1. En la app del socio, verificar que la pestaña activa es **"Mi Cuenta"**
2. Ver los consumos que el camarero ya ha añadido (los de la barra)
3. Ir a la pestaña **"Pedir"**
4. Seleccionar categoría y añadir productos al carrito:
   - 1× Tinto de verano
   - 2× Agua
5. Ver el resumen del carrito en la parte inferior
6. Pulsar **"Enviar Pedido (5,50€)"**
7. **Resultado esperado:**
   - Toast verde: "✅ Pedido enviado a la barra"
   - La app vuelve automáticamente a la pestaña "Mi Cuenta"
   - Los productos aparecen en "Pendiente" con un indicador visual diferente

---

### PASO 4 — Cocina recibe y procesa el pedido

**Dispositivo:** Cocina (tablet cocina) → `/kitchen`

*Los pedidos del móvil del socio aparecen aquí en tiempo real (si Supabase Replication está activo) o tras actualizar la página.*

1. Verificar que aparece tarjeta: **"#1 Socio 1 — X min esperando"**
2. Items listados: "1× Tinto de verano", "2× Agua"
3. Al preparar cada ítem, pulsar el botón **"✓"** junto a él
4. El ítem desaparece de la pantalla
5. Cuando todos los ítems de la mesa estén listos, pulsar **"✓ Todo Listo"**
6. **Resultado esperado:**
   - La tarjeta del socio desaparece de la pantalla de cocina
   - Contador "Pedidos pendientes: 0 ítems"

---

### PASO 5 — Badge de pedidos móviles en la barra

**Dispositivo:** Camarero (tablet barra) → `/bar`

1. Volver a la pantalla principal de barra (botón "← Volver" o navegando a `/bar`)
2. **Resultado esperado:**
   - La tarjeta de Socio #1 muestra un **badge rojo** con el número de ítems móviles pendientes
   - El badge desaparece cuando la cocina marca los ítems como servidos

> El badge es la señal visual para el camarero de que hay pedidos móviles esperando atención.

---

### PASO 6 — Socio activa notificaciones push

**Dispositivo:** Socio (móvil) → `/socio` → pestaña "Mi Cuenta"

*Hacer esto antes del cierre de cuenta para poder recibir la notificación de cobro.*

1. En la pestaña "Mi Cuenta", buscar el card del total
2. Pulsar el icono **🔔 "Activar notificaciones de cobro"**
3. El navegador solicita permiso → pulsar **"Permitir"**
4. **Resultado esperado:**
   - El botón cambia a 🔕 (notificaciones activas)
   - Cuando el camarero pida la cuenta, el socio recibirá una notificación push

> Requiere que el dispositivo tenga conexión HTTPS o estar en localhost. En red local puede no funcionar en todos los navegadores.

---

### PASO 7 — Segunda ronda de pedidos del socio

**Dispositivo:** Socio (móvil) → `/socio` → pestaña "Pedir"

1. Repetir el proceso del Paso 3 con nuevos productos:
   - 1× Montadito jamón (Tapas)
   - 1× Caña (Cervezas)
2. Enviar el pedido
3. **Verificar en cocina (Paso 4):** Aparece nueva tarjeta para Socio #1

---

### PASO 8 — Camarero solicita la cuenta

**Dispositivo:** Camarero (tablet barra) → `/bar/session/[id]`

1. Acceder a la sesión de Socio #1 desde el grid de la barra
2. Verificar que el **Total Cuenta** refleja todos los consumos correctamente
3. Pulsar **"Pedir Cuenta"**
4. Confirmar el diálogo: **"¿Seguro que quieres cerrar esta mesa para cobrar?"** → Aceptar
5. **Resultado esperado:**
   - La página muestra el badge **"PENDIENTE COBRO"** en el encabezado
   - Los botones de producto quedan desactivados (no se pueden añadir más consumos)
   - Aparecen dos opciones de cobro:
     - 💳 **Efectivo/TPV** — Cobro físico, cierra la cuenta inmediatamente
     - 📷 **Foto Talón** — Sube foto del vale del socio, cierra la cuenta con registro

---

### PASO 9 — Socio recibe notificación push

**Dispositivo:** Socio (móvil)

*Si el socio activó notificaciones en el Paso 6:*

1. El móvil recibe una **notificación push** con el mensaje:
   - **Título:** "CasetaApp — Tu cuenta está lista"
   - **Cuerpo:** "Total: XX,XX€. El camarero ha preparado tu cuenta..."
2. Tocar la notificación → abre la app en `/socio`
3. En "Mi Cuenta" el socio puede ver el total definitivo antes de pagar

---

### PASO 10 — Pago con vale de socio (Foto Talón)

**Dispositivo:** Camarero (tablet barra) → `/bar/session/[id]` en estado "PENDIENTE COBRO"

**Escenario:** El socio entrega un vale físico en la barra.

1. Pulsar el botón **"Foto Talón"** (icono de cámara)
2. Seleccionar o capturar foto del vale del socio
3. La foto se sube automáticamente al sistema
4. **Resultado esperado:**
   - La sesión se cierra y queda en estado `closed`
   - La foto del talón queda guardada en Supabase Storage (bucket `receipts`)
   - El sistema vuelve automáticamente al grid de la barra
   - La tarjeta del Socio #1 ya no aparece en el grid

**Escenario alternativo — Pago en efectivo/TPV:**

1. Pulsar **"Efectivo/TPV"**
2. La cuenta se cierra inmediatamente sin necesidad de foto

---

## Fase 3 — Liquidación y conciliación

**Dispositivo:** Admin (PC principal) → `/admin/vouchers`

*Una vez terminada la jornada, el gestor revisa las sesiones cerradas.*

1. Acceder a `/admin` → **Conciliación de Vales**
2. Se muestra la lista de todas las sesiones cerradas con:
   - Nombre del socio
   - Número de socio
   - Total cobrado
   - Fecha y hora de cierre
   - Foto del talón (si se pagó con "Foto Talón")
3. Marcar cada sesión como **reconciliada** (toggle o botón de confirmación)
4. **Resultado esperado:**
   - Las sesiones reconciliadas quedan marcadas visualmente
   - El admin tiene el registro completo del día

---

## Referencia rápida por rol

### ADMIN — `/admin`

| Sección | Función |
|---------|---------|
| Vista General | Métricas: sesiones activas, ingresos brutos |
| Catálogo y Productos | Crear/editar categorías y artículos del menú |
| Personal y Socios | Gestionar camareros, cocineros y socios con sus números |
| Conciliación de Vales | Revisar cierres de cuenta del día, marcar como reconciliados |
| Ajustes | Configuración general de la caseta |

### CAMARERO — `/bar`

| Acción | Cómo |
|--------|------|
| Abrir cuenta | Botón "+ ABRIR CUENTA" → teclado numérico → número de socio |
| Añadir consumos | Entrar en la tarjeta de sesión → seleccionar categoría → pulsar producto → "Marchar Pedido" |
| Ver pedidos móviles | Badge rojo sobre la tarjeta de sesión |
| Solicitar cuenta | Entrar en sesión → "Pedir Cuenta" → confirmar |
| Cobrar con efectivo | Estado "PENDIENTE COBRO" → "Efectivo/TPV" |
| Cobrar con vale | Estado "PENDIENTE COBRO" → "Foto Talón" → subir foto |

### COCINA — `/kitchen`

| Acción | Cómo |
|--------|------|
| Ver pedidos pendientes | Los pedidos móviles aparecen automáticamente en tarjetas |
| Marcar ítem listo | Pulsar "✓" junto al ítem |
| Limpiar mesa | Pulsar "✓ Todo Listo" cuando todos los ítems estén preparados |
| Urgentes | Tarjeta con borde rojo pulsante = lleva más de 10 minutos esperando |

### SOCIO — `/socio`

| Pestaña | Función |
|---------|---------|
| Mi Cuenta | Ver consumos actuales (pendientes y servidos), total acumulado, activar/desactivar notificaciones push |
| Pedir | Catálogo completo del menú, carrito, enviar pedido a barra |
| Historial | Sesiones cerradas anteriores con detalle de consumos |

---

## Credenciales de prueba

| Rol | Email | Contraseña | URL destino |
|-----|-------|------------|-------------|
| Admin (Gestor) | `angeles@carrysoft.com` | `angeles` | `/admin` |
| Camarero | `bar@caseta.com` | `test1234` | `/bar` |
| Cocina | `cocina@caseta.com` | `test1234` | `/kitchen` |
| Socio #1 | `socio1@caseta.com` | `test1234` | `/socio` |

**Caseta de prueba:** "Caseta Hermandad de la Esperanza"  
**Supabase Project:** https://supabase.com/dashboard/project/xevjasexzqexkisfphrl

---

## Resolución de problemas

### "No hay cuentas abiertas" aunque hay sesiones en la BD

El filtro de la barra sólo muestra sesiones con `status = 'open'` o `status = 'closing'`. Si una sesión quedó en estado incorrecto, ejecutar en SQL Editor:
```sql
SELECT id, status, socio_id FROM sessions WHERE booth_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE sessions SET status = 'open' WHERE id = '<session_id>';
```

### La cocina no actualiza en tiempo real (hay que refrescar)

Supabase Replication no está activado. Activar en:
**Supabase Dashboard → Database → Replication → Tablas: activar `sessions` y `line_items`**

Sin Replication, el sistema funciona correctamente pero las actualizaciones requieren recargar la página manualmente.

### El socio ve "Sin caseta asignada" al hacer login

El usuario no está vinculado a la tabla `socios`. Ejecutar:
```sql
SELECT id FROM auth.users WHERE email = 'email@del.socio';
INSERT INTO socios (booth_id, user_id, display_name, socio_number)
VALUES ('b0000000-0000-0000-0000-000000000001', '<user_id>', 'Nombre', <numero>);
```

### El camarero/cocina ve "Sin caseta asignada" al hacer login

El usuario no está en `staff_users`. Ejecutar:
```sql
SELECT id FROM auth.users WHERE email = 'email@del.staff';
INSERT INTO staff_users (booth_id, user_id, display_name, staff_role, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', '<user_id>', 'Nombre', 'waiter', true);
-- Roles: 'waiter' | 'kitchen' | 'owner'
```

### Las notificaciones push no llegan

- El socio debe haber activado el permiso en el navegador (Paso 6)
- El Service Worker debe estar registrado: Chrome DevTools → Application → Service Workers
- Verificar que `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` están configuradas en `.env.local`
- En red local (sin HTTPS) las notificaciones push pueden no funcionar — usar HTTPS o probar en localhost directamente

### Error al abrir la sesión de un socio que ya tiene una sesión abierta

El sistema no permite dos sesiones abiertas para el mismo socio al mismo tiempo. Cerrar la sesión anterior primero desde la barra (o vía SQL si quedó huérfana):
```sql
UPDATE sessions SET status = 'closed', closed_at = now()
WHERE socio_id = '<socio_id>' AND status IN ('open', 'closing');
```

### La foto del talón no se sube (error al pagar con "Foto Talón")

Verificar que el bucket `receipts` existe en Supabase Storage con políticas de inserción para usuarios autenticados.

---

## Checklist de prueba completa

Usar esta lista para validar que todo el flujo funciona correctamente:

- [ ] Admin puede acceder a `/admin` y ver métricas
- [ ] Admin puede crear/editar artículos del menú
- [ ] Admin puede ver la lista de socios
- [ ] Camarero puede acceder a `/bar`
- [ ] Camarero puede abrir cuenta para socio por número
- [ ] Camarero puede añadir consumos y marchar pedido
- [ ] Camarero ve badge rojo cuando hay pedidos móviles
- [ ] Cocina puede acceder a `/kitchen`
- [ ] Cocina ve los pedidos móviles del socio
- [ ] Cocina puede marcar ítems como servidos (desaparecen)
- [ ] Socio puede acceder a `/socio` desde móvil
- [ ] Socio ve los consumos de su cuenta en tiempo real
- [ ] Socio puede pedir productos desde su móvil
- [ ] Socio puede activar notificaciones push
- [ ] Camarero puede solicitar la cuenta (status → "PENDIENTE COBRO")
- [ ] Socio recibe notificación push cuando se solicita la cuenta
- [ ] Camarero puede cerrar la cuenta con "Efectivo/TPV"
- [ ] Camarero puede cerrar la cuenta con "Foto Talón" (subir imagen)
- [ ] Sesión cerrada desaparece del grid de la barra
- [ ] Admin ve la sesión cerrada en Conciliación de Vales
- [ ] La app se puede instalar como PWA en Chrome (icono en pantalla de inicio)
