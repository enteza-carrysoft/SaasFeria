import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getSessionLines } from '@/features/sessions/actions';
import { SessionDetail } from '@/features/sessions/components/SessionDetail';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Detalle de Cuenta | CasetaApp',
};

export const revalidate = 0;

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // 1. Get Session Info
    const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .select(`
            *,
            socios (
                socio_number,
                display_name
            )
        `)
        .eq('id', id)
        .single();

    if (sessionErr || !session) {
        redirect('/bar');
    }

    // 2. Get Menu Items and Categories
    const [{ data: menuData }, { data: categoriesData }] = await Promise.all([
        supabase
            .from('menu_items')
            .select('*')
            .eq('booth_id', session.booth_id)
            .eq('is_active', true)
            .order('category_id'),
        supabase
            .from('menu_categories')
            .select('id, name, sort_order')
            .eq('booth_id', session.booth_id)
            .order('sort_order'),
    ]);

    // 3. Get Lines
    const lines = await getSessionLines(id);

    return (
        <SessionDetail
            session={session}
            lines={lines}
            menuItems={menuData as any || []}
            categories={categoriesData as any || []}
        />
    );
}
