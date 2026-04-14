import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getSocioSession, getSocioSessionLines, getSocioMenu, getSocioHistory } from '@/features/orders/actions';
import { SocioDashboard } from '@/features/orders/components/SocioDashboard';
import type { Socio, LineItem } from '@/shared/types/domain';

export const metadata = {
    title: 'Mi Caseta | CasetaApp',
};

export const revalidate = 0;

export default async function SocioPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get socio info
    const { data: socioData } = await supabase
        .from('socios')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

    const socio = socioData as Socio;

    // Get active session
    const session = await getSocioSession(socio.id);

    // Get line items if there is an active session
    let lines: LineItem[] = [];
    if (session) {
        lines = await getSocioSessionLines(session.id);
    }

    // Get menu for ordering
    const { categories, items } = await getSocioMenu(socio.booth_id);

    // Get past sessions
    const history = await getSocioHistory(socio.id);

    return (
        <SocioDashboard
            socio={socio}
            session={session}
            lines={lines}
            categories={categories}
            menuItems={items}
            history={history}
        />
    );
}
