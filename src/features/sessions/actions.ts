'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/shared/lib/push';

// Fetch all Open or Closing sessions for this booth (incluyendo autorizado si aplica)
export async function getActiveSessions(boothId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
            *,
            socios (socio_number, display_name),
            socio_autorizados (display_name)
        `)
        .eq('booth_id', boothId)
        .in('status', ['open', 'closing'])
        .order('opened_at', { ascending: false });

    if (error) throw new Error(error.message);
    return sessions;
}

// Busca un socio por número y devuelve sus autorizados activos
export async function getAutorizadosBySocioNumber(boothId: string, socioNumber: number) {
    const supabase = await createServerSupabaseClient();

    const { data: socio } = await supabase
        .from('socios')
        .select('id, display_name, status')
        .eq('booth_id', boothId)
        .eq('socio_number', socioNumber)
        .maybeSingle();

    if (!socio) return { error: 'Socio no encontrado en esta caseta.' };
    if (socio.status !== 'active') return { error: 'Socio dado de baja.' };

    const { data: autorizados } = await supabase
        .from('socio_autorizados')
        .select('id, display_name')
        .eq('socio_id', socio.id)
        .eq('is_active', true)
        .order('display_name');

    return {
        socio: { id: socio.id, display_name: socio.display_name as string },
        autorizados: (autorizados ?? []) as Array<{ id: string; display_name: string }>,
    };
}

// Fetch line items for a specific session
export async function getSessionLines(sessionId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: lines, error } = await supabase
        .from('line_items')
        .select(`
            id, session_id, menu_item_id, qty, unit_price, state, source, created_at,
            menu_items (name)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    // Normalize: Supabase types the join as array but it's always a single object (FK)
    return (lines ?? []).map(l => ({
        ...l,
        menu_items: Array.isArray(l.menu_items)
            ? (l.menu_items[0] ?? null)
            : l.menu_items,
    }));
}

// Open a new session by Socio Number (con autorizado opcional)
export async function openSession(boothId: string, socioNumber: number, autorizadoId?: string | null) {
    const supabase = await createServerSupabaseClient();

    const { data: socio, error: socioError } = await supabase
        .from('socios')
        .select('id, status')
        .eq('booth_id', boothId)
        .eq('socio_number', socioNumber)
        .single();

    if (socioError || !socio) throw new Error('Socio no encontrado en esta caseta.');
    if (socio.status !== 'active') throw new Error('Socio dado de baja.');

    // Validar autorizado si se especifica
    if (autorizadoId) {
        const { data: aut } = await supabase
            .from('socio_autorizados')
            .select('id')
            .eq('id', autorizadoId)
            .eq('socio_id', socio.id)
            .eq('is_active', true)
            .maybeSingle();
        if (!aut) throw new Error('Autorizado no válido o inactivo.');
    }

    // Verificar sesión ya abierta para esta identidad concreta
    let existingQuery = supabase
        .from('sessions')
        .select('id')
        .eq('socio_id', socio.id)
        .eq('status', 'open');

    const existing = autorizadoId
        ? await existingQuery.eq('autorizado_id', autorizadoId).maybeSingle()
        : await existingQuery.is('autorizado_id', null).maybeSingle();

    if (existing.data) {
        throw new Error(autorizadoId
            ? 'Este autorizado ya tiene una cuenta abierta.'
            : 'El socio ya tiene una cuenta abierta.');
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert({
            booth_id: boothId,
            socio_id: socio.id,
            autorizado_id: autorizadoId ?? null,
            status: 'open',
            opened_by: user?.id,
            total_amount: 0,
            currency: 'EUR'
        })
        .select('id')
        .single();

    if (insertError) throw new Error(insertError.message);

    revalidatePath('/bar');
    return newSession.id;
}

// Recalculate and persist total_amount for a session (sum of all served line_items)
// This fires a Realtime UPDATE on the sessions table → socio app updates instantly
async function syncSessionTotal(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, sessionId: string) {
    const { data: lines } = await supabase
        .from('line_items')
        .select('qty, unit_price')
        .eq('session_id', sessionId)
        .eq('state', 'served');

    const total = (lines ?? []).reduce((sum, l) => sum + l.qty * l.unit_price, 0);

    await supabase
        .from('sessions')
        .update({ total_amount: total })
        .eq('id', sessionId);
}

// Add line items to a session (Waiters adding drinks/tapas)
export async function addLineItems(sessionId: string, items: { menu_item_id: string; qty: number; unit_price: number }[]) {
    if (items.length === 0) return;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const insertPayload = items.map(item => ({
        session_id: sessionId,
        menu_item_id: item.menu_item_id,
        qty: item.qty,
        unit_price: item.unit_price,
        state: 'served' as const,
        source: 'bar' as const,
        created_by: user?.id
    }));

    const { error } = await supabase.from('line_items').insert(insertPayload);
    if (error) throw new Error(error.message);

    // Update total in DB → triggers Realtime UPDATE on sessions → socio sees new total
    await syncSessionTotal(supabase, sessionId);
    revalidatePath('/bar');
}

// Set session as Closing (preparing the bill)
export async function closeSession(sessionId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch session + socio user_id before updating (for push notification)
    const { data: sessionData } = await supabase
        .from('sessions')
        .select('total_amount, socios (user_id, socio_number)')
        .eq('id', sessionId)
        .single();

    const { error } = await supabase
        .from('sessions')
        .update({
            status: 'closing',
            closed_by: user?.id,
            closed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (error) throw new Error(error.message);
    revalidatePath('/bar');
    revalidatePath('/socio');

    // Send push notification to the socio
    const socio = sessionData?.socios as unknown as { user_id: string | null; socio_number: number } | null;
    if (socio?.user_id) {
        const total = Number(sessionData?.total_amount ?? 0).toFixed(2);
        sendPushToUser(socio.user_id, {
            title: 'CasetaApp — Tu cuenta está lista',
            body: `Total: ${total}€. El camarero ha preparado tu cuenta. Dirígete a la barra para pagar.`,
            url: '/socio',
            requireInteraction: true,
        }).catch(() => { /* Non-critical, swallow errors */ });
    }
}

// Void an open session that has no line items (cancel without any consumption)
export async function voidSession(sessionId: string) {
    const supabase = await createServerSupabaseClient();

    // Server-side guard: no line items allowed
    const { count } = await supabase
        .from('line_items')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);

    if (count && count > 0) throw new Error('No se puede anular una cuenta con consumiciones.');

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('sessions')
        .update({
            status: 'voided',
            closed_by: user?.id,
            closed_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('status', 'open');

    if (error) throw new Error(error.message);
    revalidatePath('/bar');
    revalidatePath('/socio');
}

// Save voucher photo URL on a closing session (uploaded from socio app)
export async function saveVoucherUrl(sessionId: string, voucherUrl: string) {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
        .from('sessions')
        .update({ voucher_url: voucherUrl })
        .eq('id', sessionId)
        .eq('status', 'closing');

    if (error) throw new Error(error.message);
    revalidatePath('/socio');
    revalidatePath('/bar');
}

// Set session as Closed (Paid) with optional Voucher URL
export async function paySession(sessionId: string, voucherUrl: string | null = null) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('sessions')
        .update({
            status: 'closed',
            closed_by: user?.id,
            closed_at: new Date().toISOString(),
            voucher_url: voucherUrl
        })
        .eq('id', sessionId);

    if (error) throw new Error(error.message);
    revalidatePath('/bar');
    revalidatePath('/admin');
}
