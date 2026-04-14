import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { getStaffAndSocios } from '@/features/staff/actions';
import { StaffManager } from '@/features/staff/components/StaffManager';
import type { StaffUser } from '@/shared/types/domain';

export const dynamic = 'force-dynamic';

type StaffResult = Awaited<ReturnType<typeof getStaffAndSocios>>;

export const metadata = {
    title: 'Personal y Socios | CasetaApp',
};

export default async function AdminStaffPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: staffData } = await supabase
        .from('staff_users')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

    const boothId = (staffData as StaffUser).booth_id;

    let staff: StaffResult['staff'] = [];
    let socios: StaffResult['socios'] = [];
    try {
        const result = await getStaffAndSocios(boothId);
        staff = result.staff;
        socios = result.socios;
    } catch (e) {
        console.error("Failed to load staff/socios server-side", e);
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Personal y Socios</h1>
                <p className="text-[var(--color-muted-foreground)] mt-2">
                    Administra los accesos del personal de la caseta y mantén el censo de socios actualizado.
                </p>
            </div>

            <StaffManager
                boothId={boothId}
                staff={staff}
                socios={socios}
            />
        </div>
    );
}
