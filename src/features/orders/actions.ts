'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// Get the socio's active session (if any)
export async function getSocioSession(socioId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('socio_id', socioId)
        .in('status', ['open', 'closing'])
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();

    return session;
}

// Get line items for a session
export async function getSocioSessionLines(sessionId: string) {
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

// Get menu items available for mobile ordering
export async function getSocioMenu(boothId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: categories } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('booth_id', boothId)
        .order('sort_order');

    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('booth_id', boothId)
        .eq('is_active', true)
        .order('name');

    return { categories: categories || [], items: items || [] };
}

// Place a mobile order
export async function placeMobileOrder(
    sessionId: string,
    items: { menu_item_id: string; qty: number; unit_price: number }[]
) {
    if (items.length === 0) throw new Error('El pedido está vacío.');

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const insertPayload = items.map(item => ({
        session_id: sessionId,
        menu_item_id: item.menu_item_id,
        qty: item.qty,
        unit_price: item.unit_price,
        state: 'pending' as const,  // Mobile orders start as pending (need bar confirmation)
        source: 'mobile' as const,
        created_by: user?.id
    }));

    const { error } = await supabase.from('line_items').insert(insertPayload);
    if (error) throw new Error(error.message);

    revalidatePath('/socio');
    revalidatePath('/bar');
}

// Get closed sessions history for this socio
export async function getSocioHistory(socioId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('socio_id', socioId)
        .in('status', ['closed', 'voided'])
        .order('closed_at', { ascending: false })
        .limit(20);

    if (error) throw new Error(error.message);
    return sessions || [];
}
