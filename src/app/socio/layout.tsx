import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { InstallPWA } from '@/shared/components/InstallPWA';
import { NotificationToggle } from '@/shared/components/NotificationToggle';
import { IdentityGate } from '@/shared/components/IdentityGate';
import { SocioIdentityHeader } from '@/shared/components/SocioIdentityHeader';
import type { Socio, SocioAutorizado } from '@/shared/types/domain';

export const dynamic = 'force-dynamic';

export default async function SocioLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: socioData } = await supabase
        .from('socios')
        .select('*, socio_autorizados(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

    const socio = socioData as (Socio & { socio_autorizados: SocioAutorizado[] }) | null;

    if (!socio) redirect('/app');

    const autorizados: SocioAutorizado[] = socio.socio_autorizados ?? [];

    return (
        <IdentityGate
            socioId={socio.id}
            socioName={socio.display_name}
            autorizados={autorizados}
        >
            <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
                <header className="h-14 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4 sticky top-0 z-10 backdrop-blur-lg bg-opacity-90">
                    <SocioIdentityHeader
                        socioNumber={socio.socio_number}
                        socioName={socio.display_name}
                    />

                    <div className="flex items-center gap-2">
                        <InstallPWA />
                        <NotificationToggle />
                        <ThemeToggle />
                        <form action="/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
                            >
                                Salir
                            </button>
                        </form>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </IdentityGate>
    );
}
