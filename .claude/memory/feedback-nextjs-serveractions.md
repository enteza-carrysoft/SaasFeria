---
name: Next.js Server Actions — límite de tamaño y uploads de imagen
description: El límite por defecto de 1MB rompe uploads de fotos de cámara
type: feedback
originSessionId: d82768ce-accc-4262-ba6f-b52ca1e4ec4d
---
Next.js limita el body de las Server Actions a **1MB por defecto**. Las fotos de cámara de móvil pesan 3-8MB, lo que provoca que la petición se rechace silenciosamente (el cliente se queda en "Subiendo..." sin error visible).

**Why:** Descubierto al mover el upload del talón de la app del camarero (staff con permisos directos de storage) a la app del socio (Server Action). El fallo era imperceptible para el usuario.

**How to apply:**
- `next.config.ts` ya tiene `experimental.serverActions.bodySizeLimit: '10mb'` configurado.
- Antes de enviar a la Server Action, comprimir la imagen con canvas (ver `compressImage()` en `SocioDashboard.tsx`): max 1920px, JPEG 0.82 → ~300KB. Así la subida es rápida y no depende del límite.
- Patrón: `canvas.toBlob(..., 'image/jpeg', 0.82)` + `new File([blob], 'talon.jpg', { type: 'image/jpeg' })`.
