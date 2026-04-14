import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import type { StaffUser } from '@/shared/types/domain';

export const dynamic = 'force-dynamic';

export default async function BarLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Verify staff role (waiter or owner)
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    const staffUser = staffData as StaffUser | null;

    if (!staffUser || (staffUser.staff_role !== 'waiter' && staffUser.staff_role !== 'owner')) {
        redirect('/app'); // Not authorized, go back to routing
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
            {/* Minimal top bar for tablet kiosk mode */}
            <header className="h-14 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex flex-center items-center justify-center font-bold text-white">
                        C
                    </div>
                    <span className="font-bold hidden md:inline">Barra — {staffUser.display_name}</span>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <span className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span> En línea
                    </span>
                    <form action="/auth/signout" method="POST">
                        <button type="submit" className="text-sm px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                            Cerrar Turno
                        </button>
                    </form>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {children}
            </main>
        </div>
    );
}
