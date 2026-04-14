-- ============================================================
-- Migración: Autorizados por socio + columna en sessions
-- ============================================================

-- 1. Tabla socio_autorizados
CREATE TABLE IF NOT EXISTS public.socio_autorizados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    socio_id    UUID NOT NULL REFERENCES public.socios(id) ON DELETE CASCADE,
    booth_id    UUID NOT NULL REFERENCES public.booths(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Columna autorizado_id en sessions (nullable = el titular)
ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS autorizado_id UUID REFERENCES public.socio_autorizados(id) ON DELETE SET NULL;

-- 3. Índice único parcial: una sesión open por (socio_id, autorizado_id)
--    NULL se trata como un valor único en Postgres, así que necesitamos
--    dos índices: uno para NULL (titular) y otro para valores concretos.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_open_per_titular
    ON public.sessions (socio_id)
    WHERE status = 'open' AND autorizado_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_open_per_autorizado
    ON public.sessions (socio_id, autorizado_id)
    WHERE status = 'open' AND autorizado_id IS NOT NULL;

-- 4. Índice de rendimiento
CREATE INDEX IF NOT EXISTS idx_socio_autorizados_socio_id
    ON public.socio_autorizados (socio_id);

CREATE INDEX IF NOT EXISTS idx_sessions_autorizado_id
    ON public.sessions (autorizado_id);

-- 5. RLS en socio_autorizados
ALTER TABLE public.socio_autorizados ENABLE ROW LEVEL SECURITY;

-- El staff autenticado puede leer todos los autorizados de su booth
CREATE POLICY "staff_can_read_autorizados" ON public.socio_autorizados
    FOR SELECT
    USING (
        booth_id IN (
            SELECT booth_id FROM public.staff_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- El socio titular puede leer sus propios autorizados
CREATE POLICY "socio_can_read_own_autorizados" ON public.socio_autorizados
    FOR SELECT
    USING (
        socio_id IN (
            SELECT id FROM public.socios
            WHERE user_id = auth.uid()
        )
    );

-- Solo staff owner puede insertar/actualizar/eliminar autorizados
CREATE POLICY "owner_can_manage_autorizados" ON public.socio_autorizados
    FOR ALL
    USING (
        booth_id IN (
            SELECT booth_id FROM public.staff_users
            WHERE user_id = auth.uid()
              AND staff_role = 'owner'
              AND is_active = true
        )
    );

-- El socio puede gestionar sus propios autorizados
CREATE POLICY "socio_can_manage_own_autorizados" ON public.socio_autorizados
    FOR ALL
    USING (
        socio_id IN (
            SELECT id FROM public.socios
            WHERE user_id = auth.uid()
        )
    );
