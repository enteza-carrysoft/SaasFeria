import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/shared/components/ThemeToggle';

export const metadata = {
    title: 'Cocina | CasetaApp',
};

export default async function KitchenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: staffData } = await supabase
        .from('staff_users')
        .select('display_name, staff_role, booth_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    const staff = staffData as { display_name: string; staff_role: string; booth_id: string } | null;

    if (!staff || (staff.staff_role !== 'kitchen' && staff.staff_role !== 'owner')) {
        redirect('/app');
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
            <header className="h-14 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center font-bold text-white text-sm">
                        🍳
                    </div>
                    <span className="font-bold hidden md:inline">Cocina — {staff.display_name}</span>
                    <span className="font-bold md:hidden">Cocina</span>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <span className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        En directo
                    </span>
                    <form action="/auth/signout" method="POST">
                        <button
                            type="submit"
                            className="text-sm px-3 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
                        >
                            Salir
                        </button>
                    </form>
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col">
                {children}
            </main>
        </div>
    );
}
