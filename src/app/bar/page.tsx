import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getActiveSessions } from '@/features/sessions/actions';
import { BarTerminal } from '@/features/sessions/components/BarTerminal';
import type { MenuItem } from '@/shared/types/domain';

export const metadata = {
    title: 'Terminal Barra | CasetaApp',
};

export const dynamic = 'force-dynamic';

export default async function BarPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: staffData } = await supabase
        .from('staff_users')
        .select('booth_id')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    const boothId = (staffData as { booth_id: string }).booth_id;

    // Fetch sessions and mobile pending counts in parallel
    const [sessions, menuData, pendingLineItems] = await Promise.all([
        getActiveSessions(boothId).catch(() => []),
        supabase
            .from('menu_items')
            .select('*')
            .eq('booth_id', boothId)
            .eq('is_active', true)
            .order('category_id'),
        supabase
            .from('line_items')
            .select('session_id')
            .eq('source', 'mobile')
            .eq('state', 'pending'),
    ]);

    // Build a count map: session_id → number of pending mobile orders
    const mobilePendingCounts: Record<string, number> = {};
    for (const li of pendingLineItems.data ?? []) {
        mobilePendingCounts[li.session_id] = (mobilePendingCounts[li.session_id] ?? 0) + 1;
    }

    return (
        <BarTerminal
            boothId={boothId}
            initialSessions={sessions}
            menuItems={(menuData.data ?? []) as MenuItem[]}
            mobilePendingCounts={mobilePendingCounts}
        />
    );
}
