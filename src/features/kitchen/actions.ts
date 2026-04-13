'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { sendPushToUser } from '@/shared/lib/push';
import { revalidatePath } from 'next/cache';

export type KitchenOrderItem = {
    id: string;
    session_id: string;
    qty: number;
    unit_price: number;
    source: 'bar' | 'mobile';
    created_at: string;
    item_name: string;
    prep_type: 'bar' | 'kitchen';
    socio_number: number;
    display_name: string;
};

export async function getKitchenOrders(boothId: string): Promise<KitchenOrderItem[]> {
    const supabase = await createServerSupabaseClient();

    // Step 1: Get active sessions for this booth with socio info
    const { data: activeSessions, error: sessError } = await supabase
        .from('sessions')
        .select('id, socios (socio_number, display_name)')
        .eq('booth_id', boothId)
        .in('status', ['open', 'closing']);

    if (sessError) throw new Error(sessError.message);
    if (!activeSessions?.length) return [];

    const sessionIds = activeSessions.map(s => s.id);
    const sessionMap: Record<string, { socio_number: number; display_name: string }> = {};
    for (const s of activeSessions) {
        const socio = s.socios as unknown as { socio_number: number; display_name: string } | null;
        if (socio) sessionMap[s.id] = socio;
    }

    // Step 2: Get pending line_items for those sessions
    const { data: lineItems, error: liError } = await supabase
        .from('line_items')
        .select('id, session_id, qty, unit_price, source, created_at, menu_items (name, prep_type)')
        .in('session_id', sessionIds)
        .eq('state', 'pending')
        .order('created_at', { ascending: true });

    if (liError) throw new Error(liError.message);
    if (!lineItems?.length) return [];

    return lineItems.map(li => {
        const menuItem = li.menu_items as unknown as { name: string; prep_type: 'bar' | 'kitchen' } | null;
        const session = sessionMap[li.session_id];
        return {
            id: li.id,
            session_id: li.session_id,
            qty: li.qty,
            unit_price: li.unit_price,
            source: li.source as 'bar' | 'mobile',
            created_at: li.created_at,
            item_name: menuItem?.name ?? 'Desconocido',
            prep_type: menuItem?.prep_type ?? 'bar',
            socio_number: session?.socio_number ?? 0,
            display_name: session?.display_name ?? '—',
        };
    });
}

export async function markItemsServed(lineItemIds: string[]): Promise<void> {
    if (lineItemIds.length === 0) return;
    const supabase = await createServerSupabaseClient();

    // Get affected session_ids before updating
    const { data: affectedItems } = await supabase
        .from('line_items')
        .select('session_id')
        .in('id', lineItemIds);

    const sessionIds = [...new Set(affectedItems?.map(i => i.session_id) ?? [])];

    // Mark items as served
    const { error } = await supabase
        .from('line_items')
        .update({ state: 'served' })
        .in('id', lineItemIds);

    if (error) throw new Error(error.message);

    // For each affected session, check if all pending items are now done
    for (const sessionId of sessionIds) {
        const { count } = await supabase
            .from('line_items')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .eq('state', 'pending');

        if (count === 0) {
            // All done → notify the socio
            const { data: session } = await supabase
                .from('sessions')
                .select('socios(user_id, display_name)')
                .eq('id', sessionId)
                .single();

            const socio = session?.socios as unknown as { user_id: string; display_name: string } | null;
            if (socio?.user_id) {
                // Fire-and-forget — don't block on push errors
                sendPushToUser(socio.user_id, {
                    title: 'CasetaApp — Tu pedido está listo 🍻',
                    body: 'Pasa por la barra a recogerlo',
                    url: '/socio',
                }).catch(() => {/* silencioso si falla */});
            }
        }
    }

    revalidatePath('/kitchen');
    revalidatePath('/bar');
    revalidatePath('/socio');
}

export async function getBoothIdForStaff(): Promise<string> {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: staff, error } = await supabase
        .from('staff_users')
        .select('booth_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    if (error || !staff) throw new Error('Staff no encontrado');
    return staff.booth_id;
}
