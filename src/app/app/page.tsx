import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { redirect } from 'next/navigation';
import type { StaffUser, Socio } from '@/shared/types/domain';

export default async function AppPage() {
    let supabase;
    try {
        supabase = await createServerSupabaseClient();
    } catch {
        // Missing env vars — show configuration error instead of 500
        return (
            <main className="min-h-screen flex items-center justify-center px-4">
                <div className="glass-card p-8 w-full max-w-md animate-fade-in text-center">
                    <div className="text-5xl mb-4">⚙️</div>
                    <h1 className="text-xl font-bold mb-2 text-[var(--color-danger)]">Error de configuración</h1>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                        Faltan variables de entorno de Supabase. Configúralas en el panel de Vercel.
                    </p>
                </div>
            </main>
        );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    // Check if user is staff (waiter/kitchen/owner)
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    const staffUser = staffData as StaffUser | null;

    // Check if user is a socio
    const { data: socioData } = await supabase
        .from('socios')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
    const socio = socioData as Socio | null;

    // Route based on role
    if (staffUser) {
        if (staffUser.staff_role === 'owner') {
            redirect('/admin');
        }
        if (staffUser.staff_role === 'kitchen') {
            redirect('/kitchen');
        }
        redirect('/bar');
    }

    if (socio) {
        redirect('/socio');
    }

    // No role assigned — show onboarding
    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="glass-card p-8 w-full max-w-md animate-fade-in text-center">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold mb-2">¡Bienvenido a CasetaApp!</h1>
                <p className="text-[var(--color-muted-foreground)] mb-4">
                    Tu cuenta está creada pero aún no está vinculada a ninguna caseta.
                </p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                    Contacta al gestor de tu caseta para que te asigne como socio o camarero.
                </p>
                <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                        Conectado como: <strong>{user.email}</strong>
                    </p>
                    <form action="/auth/signout" method="POST">
                        <button
                            type="submit"
                            className="mt-3 text-sm text-[var(--color-primary)] hover:underline"
                        >
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
