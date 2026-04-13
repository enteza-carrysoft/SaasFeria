'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/shared/lib/push';

// Fetch all Open or Closing sessions for this booth
export async function getActiveSessions(boothId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
            *,
            socios (
                socio_number,
                display_name
            )
        `)
        .eq('booth_id', boothId)
        .in('status', ['open', 'closing'])
        .order('opened_at', { ascending: false });

    if (error) throw new Error(error.message);
    return sessions;
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
    return lines;
}

// Open a new session by Socio Number
export async function openSession(boothId: string, socioNumber: number) {
    const supabase = await createServerSupabaseClient();

    // First, find the socio ID
    const { data: socio, error: socioError } = await supabase
        .from('socios')
        .select('id, status')
        .eq('booth_id', boothId)
        .eq('socio_number', socioNumber)
        .single();

    if (socioError || !socio) throw new Error('Socio no encontrado en esta caseta.');
    if (socio.status !== 'active') throw new Error('Socio dado de baja.');

    // Check if socio already has an open session
    const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('socio_id', socio.id)
        .eq('status', 'open')
        .single();

    if (existing) throw new Error('El socio ya tiene una cuenta abierta.');

    // Get current user ID (waiter)
    const { data: { user } } = await supabase.auth.getUser();

    // Insert new session
    const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert({
            booth_id: boothId,
            socio_id: socio.id,
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
        state: 'served' as const, // For bar orders, they are served immediately usually
        source: 'bar' as const,
        created_by: user?.id
    }));

    const { error } = await supabase.from('line_items').insert(insertPayload);
    if (error) throw new Error(error.message);

    // Note: The total_amount is automatically updated by the trg_update_session_total trigger in Supabase!
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
