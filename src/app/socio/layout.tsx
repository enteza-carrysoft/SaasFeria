import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { InstallPWA } from '@/shared/components/InstallPWA';
import { NotificationToggle } from '@/shared/components/NotificationToggle';
import type { Socio } from '@/shared/types/domain';

export const dynamic = 'force-dynamic';

export default async function SocioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Verify socio role
    const { data: socioData } = await supabase
        .from('socios')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

    const socio = socioData as Socio | null;

    if (!socio) {
        redirect('/app');
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
            {/* Mobile-first sticky header */}
            <header className="h-14 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4 sticky top-0 z-10 backdrop-blur-lg bg-opacity-90">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-accent)] flex items-center justify-center text-white font-black text-sm">
                        {socio.socio_number}
                    </div>
                    <div>
                        <p className="font-bold text-sm leading-tight">{socio.display_name}</p>
                        <p className="text-[10px] text-[var(--color-muted-foreground)]">Socio #{socio.socio_number}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <InstallPWA />
                    <NotificationToggle />
                    <ThemeToggle />
                    <form action="/auth/signout" method="POST">
                        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                            Salir
                        </button>
                    </form>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
