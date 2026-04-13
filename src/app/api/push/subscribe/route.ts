import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, p256dh, auth } = body as { endpoint: string; p256dh: string; auth: string };

    if (!endpoint || !p256dh || !auth) {
        return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 });
    }

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            { user_id: user.id, endpoint, p256dh, auth },
            { onConflict: 'endpoint' }
        );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) {
        return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
    }

    await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);

    return NextResponse.json({ ok: true });
}
