# BUSINESS_LOGIC.md - CasetaApp

> Generado por SaaS Factory | Fecha: 2026-03-01

## 1. Problema de Negocio

**Dolor:** Las casetas de feria gestionan consumos de socios con papelitos y rayas. No hay transparencia, las disputas son frecuentes, y los socios hacen cola en barra para cada pedido.

**Costo actual:**
- Disputas en el cierre por conteos erróneos
- Colas en barra que drenan la experiencia del socio
- Sin histórico ni evidencia digital de consumos
- Camareros saturados por la doble tarea: servir + contabilizar

## 2. Solución

**Propuesta de valor:** Una PWA que digitaliza las cuentas efímeras por visita de socios. El camarero registra consumos en tablet con 1-2 toques, el socio ve su cuenta en tiempo real desde el móvil y puede hacer pedidos sin cola.

**Flujo principal (Happy Path):**
1. Socio llega → Camarero abre cuenta con nº de socio
2. Camarero añade consumos con botones rápidos (≤2s)
3. Socio ve en tiempo real: servido / pendiente / total
4. Socio puede pedir desde el móvil (opcional)
5. Al irse → Camarero cierra cuenta → Total calculado automáticamente
6. Socio adjunta foto del talón como evidencia

## 3. Roles

- **Socio**: Ve su cuenta, hace pedidos desde móvil, historico
- **Camarero (Staff)**: Abre/cierra cuentas, añade consumos, gestiona pedidos
- **Cocina**: Ve cola de pedidos, cambia estados
- **Gestor (Owner)**: Configura caseta, catálogo, da de alta camareros/socios

## 4. Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4
- **Backend:** Supabase (Auth + DB + Realtime + Storage)
- **State:** Zustand
- **PWA:** Service Worker + Web Push + IndexedDB cache
- **Deploy:** Vercel + Supabase Cloud

## 5. Supabase Project

- **Project ID:** `xevjasexzqexkisfphrl`
- **Region:** eu-north-1
- **URL:** https://xevjasexzqexkisfphrl.supabase.co

## 6. KPIs

- Acción de camarero: ≤ 2 segundos
- Cuentas con foto de talón: > 80%
- Adopción PWA socios: > 60%
- Latencia WebSocket: < 500ms
