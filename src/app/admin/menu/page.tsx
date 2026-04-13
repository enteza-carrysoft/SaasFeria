import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getCatalog } from '@/features/catalog/actions';
import { CatalogManager } from '@/features/catalog/components/CatalogManager';

export const metadata = {
    title: 'Catálogo Admin | CasetaApp',
};

export default async function AdminMenuPage() {
    // 1. Authenticate and get booth_id
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // We assume layout already checked this is an owner, so we just get booth_id safely
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    const staffUser = staffData as any;
    const boothId = staffUser.booth_id;

    // 2. Fetch Catalog data using the server action helper
    let categories: any[] = [];
    let items: any[] = [];
    try {
        const catalog = await getCatalog(boothId);
        categories = catalog.categories;
        items = catalog.items;
    } catch (e) {
        console.error("Failed to load catalog server-side", e);
    }

    // 3. Render Client Component passing data
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Catálogo y Productos</h1>
                <p className="text-[var(--color-muted-foreground)] mt-2">
                    Añade bebidas, raciones o activa el modo 'Top 8' para los productos más rápidos de barra.
                </p>
            </div>

            <CatalogManager
                boothId={boothId}
                categories={categories}
                items={items}
            />
        </div>
    );
}
