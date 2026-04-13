'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getVoucherSessions(boothId: string) {
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
        .eq('status', 'closed')
        .not('voucher_url', 'is', null)
        .order('closed_at', { ascending: false });

    if (error) throw new Error(error.message);
    return sessions || [];
}

export async function toggleReconciliation(sessionId: string, currentStatus: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('sessions')
        .update({ is_reconciled: !currentStatus })
        .eq('id', sessionId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/vouchers');
}
