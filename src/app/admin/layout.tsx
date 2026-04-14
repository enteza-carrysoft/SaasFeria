import Link from 'next/link';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import type { StaffUser } from '@/shared/types/domain';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Verify owner role
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    const staffUser = staffData as StaffUser | null;

    if (!staffUser || staffUser.staff_role !== 'owner') {
        redirect('/app'); // Not authorized, go back to routing
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-[var(--color-card)] flex flex-col">
                <div className="p-6 border-b border-[var(--color-border)]">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
                        Admin Panel
                    </h2>
                    <p className="text-xs mt-1 text-[var(--color-muted-foreground)] truncate">
                        {staffUser.booth_id}
                    </p>
                </div>
                <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
                    <Link href="/admin" className="block px-4 py-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                        📊 Vista General
                    </Link>
                    <Link href="/admin/menu" className="block px-4 py-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                        📋 Catálogo
                    </Link>
                    <Link href="/admin/staff" className="block px-4 py-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                        👥 Personal corporativo
                    </Link>
                    <Link href="/admin/vouchers" className="block px-4 py-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors text-[var(--color-info)]">
                        🧾 Conciliación
                    </Link>
                    <Link href="/admin/settings" className="block px-4 py-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                        ⚙️ Configuración
                    </Link>
                </nav>
                <div className="p-4 border-t border-[var(--color-border)] flex flex-col gap-3">
                    <div className="flex justify-center">
                        <ThemeToggle />
                    </div>
                    <Link href="/app" className="block w-full text-center px-4 py-2 bg-[var(--color-muted)] hover:bg-[var(--color-border)] rounded-lg text-sm transition-colors">
                        ← Volver a Routing
                    </Link>
                    <form action="/auth/signout" method="POST">
                        <button type="submit" className="w-full px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)]">
                            Cerrar Sesión
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-8 max-w-7xl mx-auto auto-rows-max">
                    {children}
                </div>
            </main>
        </div>
    );
}
