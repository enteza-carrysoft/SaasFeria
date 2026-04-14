import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getVoucherSessions } from '@/features/vouchers/actions';
import { VoucherManager } from '@/features/vouchers/components/VoucherManager';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Conciliación | CasetaApp',
};

export const revalidate = 0;

export default async function VouchersPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Verify owner role and get booth_id
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    if (!staffData || staffData.staff_role !== 'owner') {
        redirect('/app');
    }

    const sessions = await getVoucherSessions(staffData.booth_id);

    return <VoucherManager sessions={sessions} />;
}
