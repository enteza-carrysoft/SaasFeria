import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

export default async function AdminDashboardPage() {
    const supabase = await createServerSupabaseClient();

    // We get the user and booth_id securely from the session / staff query (already checked in layout)
    const { data: { user } } = await supabase.auth.getUser();

    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    const boothId = (staffData as any).booth_id;

    // Fetch quick stats
    const { count: activeSessionsCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('booth_id', boothId)
        .in('status', ['open', 'closing']);

    const { data: sessionsData } = await supabase
        .from('sessions')
        .select('total_amount, status')
        .eq('booth_id', boothId)
        .eq('status', 'closed');

    // Aggregate today's or overall revenue (simplified for MVP: overall closed sessions)
    const totalRevenue = sessionsData?.reduce((sum, session) => sum + (session.total_amount || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Vista General</h1>
                <p className="text-[var(--color-muted-foreground)] mt-2">
                    Resumen en tiempo real de la actividad de la caseta.
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                        Sesiones Activas
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{activeSessionsCount || 0}</span>
                        <span className="text-sm text-[var(--color-success)] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse"></span>
                            en vivo
                        </span>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                        Ingresos Brutos (Cerrado)
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{totalRevenue.toFixed(2)}€</span>
                    </div>
                </div>

                <div className="glass-card p-6 opacity-50">
                    <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                        Pedidos en Cola (Móvil)
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-bold">--</span>
                        <span className="text-sm text-[var(--color-muted-foreground)]">Próximamente</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="glass-card p-6">
                    <h3 className="text-lg font-bold mb-4">Última Actividad Rápida</h3>
                    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[var(--color-border)] rounded-lg">
                        <p className="text-[var(--color-muted-foreground)]">
                            Aquí aparecerá el feed en tiempo real de aperturas de cuenta y pedidos. <br /> (Fase 8)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
