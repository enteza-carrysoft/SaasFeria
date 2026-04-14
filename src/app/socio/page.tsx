import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getActiveSocioSessions, getSocioMenu, getSocioHistory } from '@/features/orders/actions';
import { SocioDashboard } from '@/features/orders/components/SocioDashboard';
import type { Socio } from '@/shared/types/domain';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Mi Caseta | CasetaApp',
};

export const revalidate = 0;

export default async function SocioPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: socioData } = await supabase
        .from('socios')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

    const socio = socioData as Socio;

    const [sessions, { categories, items }, history] = await Promise.all([
        getActiveSocioSessions(socio.id),
        getSocioMenu(socio.booth_id),
        getSocioHistory(socio.id),
    ]);

    return (
        <SocioDashboard
            socio={socio}
            sessions={sessions}
            categories={categories}
            menuItems={items}
            history={history}
        />
    );
}
