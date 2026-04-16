'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { createAdminSupabaseClient } from '@/shared/lib/supabase-admin';
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
            menu_items (name, prep_type)
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
// prep_type='bar' → state='served' immediately
// prep_type='kitchen' → state='sent_kitchen' (camarero marks delivered later)
export async function addLineItems(sessionId: string, items: { menu_item_id: string; qty: number; unit_price: number }[]) {
    if (items.length === 0) return;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch prep_type for all items to route bar→served, kitchen→sent_kitchen
    const menuItemIds = [...new Set(items.map(i => i.menu_item_id))];
    const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, prep_type')
        .in('id', menuItemIds);

    const prepTypeMap = new Map((menuItems ?? []).map(m => [m.id, m.prep_type as 'bar' | 'kitchen']));

    const insertPayload = items.map(item => ({
        session_id: sessionId,
        menu_item_id: item.menu_item_id,
        qty: item.qty,
        unit_price: item.unit_price,
        state: (prepTypeMap.get(item.menu_item_id) === 'kitchen' ? 'sent_kitchen' : 'served') as 'sent_kitchen' | 'served',
        source: 'bar' as const,
        created_by: user?.id
    }));

    const { error } = await supabase.from('line_items').insert(insertPayload);
    if (error) throw new Error(error.message);

    // Update total in DB → triggers Realtime UPDATE on sessions → socio sees new total
    await syncSessionTotal(supabase, sessionId);
    revalidatePath('/bar');
    revalidatePath('/kitchen');
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

// Upload voucher photo from socio app and save URL on the session.
// Uses admin client for storage upload to bypass bucket RLS (socios don't have write access).
export async function uploadAndSaveVoucher(sessionId: string, formData: FormData) {
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) throw new Error('No se recibió ningún archivo.');

    // Verify session exists and is in closing state
    const supabase = await createServerSupabaseClient();
    const { data: session } = await supabase
        .from('sessions')
        .select('booth_id')
        .eq('id', sessionId)
        .eq('status', 'closing')
        .single();

    if (!session) throw new Error('Sesión no encontrada o no está en estado de cobro.');

    // Upload using admin client — bypasses storage RLS
    const adminClient = createAdminSupabaseClient();
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const fileName = `${session.booth_id}/${sessionId}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
        .from('receipts')
        .upload(fileName, arrayBuffer, { contentType: file.type || 'image/jpeg' });

    if (uploadError) throw new Error('Error subiendo foto: ' + uploadError.message);

    const { data: urlData } = adminClient.storage.from('receipts').getPublicUrl(fileName);

    // Persist URL on session — admin client needed (socios cannot UPDATE sessions via RLS)
    const { error: updateError } = await adminClient
        .from('sessions')
        .update({ voucher_url: urlData.publicUrl })
        .eq('id', sessionId);

    if (updateError) throw new Error(updateError.message);
    revalidatePath('/socio');
    revalidatePath('/bar');
}

// Set session as Closed (Paid)
export async function paySession(sessionId: string) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Recalculate total from served items only (cancelled items excluded)
    const { data: lines } = await supabase
        .from('line_items')
        .select('qty, unit_price')
        .eq('session_id', sessionId)
        .eq('state', 'served');

    const total = (lines ?? []).reduce((sum, l) => sum + l.qty * l.unit_price, 0);

    // NOTE: voucher_url is intentionally NOT updated here — the socio may have
    // already uploaded it via uploadAndSaveVoucher. Passing null would erase it.
    const { error } = await supabase
        .from('sessions')
        .update({
            status: 'closed',
            closed_by: user?.id,
            closed_at: new Date().toISOString(),
            total_amount: total,
        })
        .eq('id', sessionId);

    if (error) throw new Error(error.message);
    revalidatePath('/bar');
    revalidatePath('/admin');
    revalidatePath('/socio');
}

// Camarero envía items pending (mobile) a cocina
export async function sendToKitchen(lineItemIds: string[]) {
    if (lineItemIds.length === 0) return;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('line_items')
        .update({ state: 'sent_kitchen' })
        .in('id', lineItemIds)
        .eq('state', 'pending');

    if (error) throw new Error(error.message);
    revalidatePath('/bar');
    revalidatePath('/kitchen');
}

// Camarero cancela un item agotado (pending → cancelled) + push al socio
export async function cancelLineItem(lineItemId: string) {
    const supabase = await createServerSupabaseClient();

    // Get item details before cancelling
    const { data: item } = await supabase
        .from('line_items')
        .select('session_id, menu_items (name)')
        .eq('id', lineItemId)
        .single();

    if (!item) throw new Error('Item no encontrado.');

    const { error } = await supabase
        .from('line_items')
        .update({ state: 'cancelled' })
        .eq('id', lineItemId)
        .eq('state', 'pending');

    if (error) throw new Error(error.message);

    await syncSessionTotal(supabase, item.session_id);

    // Push al socio
    const { data: session } = await supabase
        .from('sessions')
        .select('socios (user_id)')
        .eq('id', item.session_id)
        .single();

    const socio = session?.socios as unknown as { user_id: string | null } | null;
    const menuItem = item.menu_items as unknown as { name: string } | null;
    const itemName = menuItem?.name ?? 'un artículo';

    if (socio?.user_id) {
        sendPushToUser(socio.user_id, {
            title: 'CasetaApp — Cambio en tu pedido',
            body: `Lo sentimos, ${itemName} no está disponible hoy. Contacta con el camarero.`,
            url: '/socio',
        }).catch(() => { /* Non-critical */ });
    }

    revalidatePath('/bar');
    revalidatePath('/socio');
}

// Camarero marca items entregados (sent_kitchen → served) + push si todo resuelto
export async function markDelivered(lineItemIds: string[]) {
    if (lineItemIds.length === 0) return;

    const supabase = await createServerSupabaseClient();

    // Get session_id from first item
    const { data: items } = await supabase
        .from('line_items')
        .select('session_id')
        .in('id', lineItemIds)
        .limit(1);

    const sessionId = items?.[0]?.session_id;
    if (!sessionId) throw new Error('Items no encontrados.');

    const { error } = await supabase
        .from('line_items')
        .update({ state: 'served' })
        .in('id', lineItemIds)
        .in('state', ['pending', 'sent_kitchen']);

    if (error) throw new Error(error.message);

    await syncSessionTotal(supabase, sessionId);

    // Si no quedan items pendientes ni en cocina → push "pedido listo"
    const { count } = await supabase
        .from('line_items')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .in('state', ['pending', 'sent_kitchen']);

    if (count === 0) {
        const { data: session } = await supabase
            .from('sessions')
            .select('socios (user_id)')
            .eq('id', sessionId)
            .single();

        const socio = session?.socios as unknown as { user_id: string | null } | null;
        if (socio?.user_id) {
            sendPushToUser(socio.user_id, {
                title: 'CasetaApp — Tu pedido está listo 🍻',
                body: 'Pasa por la barra a recogerlo.',
                url: '/socio',
            }).catch(() => { /* Non-critical */ });
        }
    }

    revalidatePath('/bar');
    revalidatePath('/kitchen');
    revalidatePath('/socio');
}
