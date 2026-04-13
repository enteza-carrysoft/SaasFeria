'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getStaffAndSocios(boothId: string) {
    const supabase = await createServerSupabaseClient();

    // Get Staff
    const { data: staff, error: staffError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('booth_id', boothId)
        .order('display_name');

    if (staffError) throw new Error(staffError.message);

    // Get Socios
    const { data: socios, error: sociosError } = await supabase
        .from('socios')
        .select('*')
        .eq('booth_id', boothId)
        .order('socio_number');

    if (sociosError) throw new Error(sociosError.message);

    return { staff, socios };
}

export async function addStaff(
    boothId: string,
    displayName: string,
    role: 'waiter' | 'kitchen' | 'owner',
    pin: string
) {
    const supabase = await createServerSupabaseClient();
    // For simplicity in MVP, we might store pin_hash as plain text if we haven't set up hashing, 
    // but ideally we should hash it. Let's just store it in pin_hash column as is for now if no auth trigger hashes it.
    // In production, we should hash this before inserting.
    const { error } = await supabase
        .from('staff_users')
        .insert({
            booth_id: boothId,
            display_name: displayName,
            staff_role: role,
            pin_hash: pin // Reminder: raw pin for MVP Demo
        });

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function toggleStaffStatus(staffId: string, isActive: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('staff_users')
        .update({ is_active: isActive })
        .eq('id', staffId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function addSocio(boothId: string, socioNumber: number, displayName: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socios')
        .insert({
            booth_id: boothId,
            socio_number: socioNumber,
            display_name: displayName
        });

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function toggleSocioStatus(socioId: string, status: 'active' | 'inactive') {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socios')
        .update({ status })
        .eq('id', socioId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}
