import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

export const metadata = {
    title: 'Configuración | CasetaApp',
};

export default async function AdminSettingsPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch booth details
    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    const boothId = (staffData as any).booth_id;

    // Fetch the actual booth name
    const { data: booth } = await supabase
        .from('booths')
        .select('*')
        .eq('id', boothId)
        .single();

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold">Configuración de Caseta</h1>
                <p className="text-[var(--color-muted-foreground)] mt-2">
                    Ajustes generales de tu caseta y datos de contacto.
                </p>
            </div>

            <div className="glass-card p-6">
                <form className="space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nombre de la Caseta</label>
                        <input
                            type="text"
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none text-[var(--color-foreground)]"
                            defaultValue={booth?.name || ''}
                            disabled
                        />
                        <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                            Para cambiar el nombre, contacta a soporte técnico.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Cierre Automático de Sesiones (Horas)</label>
                        <input
                            type="number"
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none"
                            defaultValue={24}
                            disabled
                        />
                        <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                            Las sesiones abiertas se cerrarán (anuladas) automáticamente tras estas horas.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">ID Interno de Caseta</label>
                        <input
                            type="text"
                            className="w-full bg-black border border-[var(--color-border)] rounded p-2 outline-none text-[var(--color-muted-foreground)] text-xs font-mono"
                            readOnly
                            value={boothId}
                        />
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)]">
                        <button type="button" disabled className="px-6 py-2 bg-[var(--color-primary)] text-white font-bold rounded opacity-50 cursor-not-allowed">
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>

            <div className="glass-card p-6 border-l-4 border-[var(--color-danger)] mt-8">
                <h3 className="text-lg font-bold text-[var(--color-danger)] mb-2">Zona de Peligro</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                    Borrar todos los datos de prueba resetea los pedidos y sesiones sin borrar el catálogo ni los socios. Esta acción no se puede deshacer.
                </p>
                <button type="button" className="px-4 py-2 border border-[var(--color-danger)] text-[var(--color-danger)] rounded hover:bg-[var(--color-danger)] hover:text-white transition">
                    Reiniciar Datos de Prueba
                </button>
            </div>
        </div>
    );
}
