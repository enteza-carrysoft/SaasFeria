import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { sendPushToUser } from '@/shared/lib/push';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/test
 * Sends a test push notification to the authenticated user.
 * Used to verify the full push pipeline without waiting for a real event.
 */
export async function POST() {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Check env vars
    const diagnostics = {
        vapidPublicKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        vapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
        vapidSubject: !!process.env.VAPID_SUBJECT,
        serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    };

    const allConfigured = Object.values(diagnostics).every(Boolean);

    if (!allConfigured) {
        return NextResponse.json({
            error: 'Variables de entorno de push no configuradas en Vercel',
            diagnostics,
        }, { status: 500 });
    }

    // Check if user has any subscriptions
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: subs, error: subsError } = await adminClient
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id);

    if (subsError) {
        return NextResponse.json({
            error: `Error al leer suscripciones: ${subsError.message}`,
            diagnostics,
        }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
        return NextResponse.json({
            error: 'No hay suscripciones registradas para este usuario. Activa las notificaciones primero desde la app.',
            diagnostics,
            userId: user.id,
        }, { status: 400 });
    }

    await sendPushToUser(user.id, {
        title: '🎪 CasetaApp — Prueba OK',
        body: `Notificaciones funcionando correctamente. ${new Date().toLocaleTimeString('es-ES')}`,
        url: '/socio',
    });

    return NextResponse.json({
        ok: true,
        message: 'Notificación enviada',
        subscriptionsFound: subs.length,
        diagnostics,
    });
}
