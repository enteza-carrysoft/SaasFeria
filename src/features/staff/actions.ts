'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { createAdminSupabaseClient } from '@/shared/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getStaffAndSocios(boothId: string) {
    const supabase = await createServerSupabaseClient();

    const { data: staff, error: staffError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('booth_id', boothId)
        .order('display_name');

    if (staffError) throw new Error(staffError.message);

    const { data: socios, error: sociosError } = await supabase
        .from('socios')
        .select('*, socio_autorizados(*)')
        .eq('booth_id', boothId)
        .order('socio_number');

    if (sociosError) throw new Error(sociosError.message);

    return { staff: staff ?? [], socios: socios ?? [] };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function addStaff(
    boothId: string,
    displayName: string,
    role: 'waiter' | 'kitchen' | 'owner',
    pin: string
) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('staff_users')
        .insert({ booth_id: boothId, display_name: displayName, staff_role: role, pin_hash: pin });

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

// ─── Socios — datos ───────────────────────────────────────────────────────────

export async function addSocio(boothId: string, socioNumber: number, displayName: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socios')
        .insert({ booth_id: boothId, socio_number: socioNumber, display_name: displayName });

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function updateSocio(socioId: string, socioNumber: number, displayName: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socios')
        .update({ socio_number: socioNumber, display_name: displayName })
        .eq('id', socioId);

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

// ─── Socios — acceso a la app ─────────────────────────────────────────────────

/** Crea usuario en auth y vincula user_id al socio */
export async function createSocioAccount(socioId: string, email: string, password: string) {
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });
    if (error) throw new Error(error.message);

    const supabase = await createServerSupabaseClient();
    const { error: linkError } = await supabase
        .from('socios')
        .update({ user_id: data.user.id })
        .eq('id', socioId);

    if (linkError) {
        // Intentar borrar el usuario recién creado para no dejar huérfanos
        await admin.auth.admin.deleteUser(data.user.id);
        throw new Error(linkError.message);
    }

    revalidatePath('/admin/staff');
}

/** Actualiza email y/o contraseña de un socio ya vinculado */
export async function updateSocioCredentials(
    userId: string,
    updates: { email?: string; password?: string }
) {
    if (!updates.email && !updates.password) return;

    const admin = createAdminSupabaseClient();
    const { error } = await admin.auth.admin.updateUserById(userId, updates);
    if (error) throw new Error(error.message);

    revalidatePath('/admin/staff');
}

/** Desvincula el acceso a la app de un socio (no elimina el usuario de auth) */
export async function unlinkSocioAccount(socioId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socios')
        .update({ user_id: null })
        .eq('id', socioId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

// ─── Autorizados ──────────────────────────────────────────────────────────────

export async function addAutorizado(socioId: string, boothId: string, displayName: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socio_autorizados')
        .insert({ socio_id: socioId, booth_id: boothId, display_name: displayName });

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function updateAutorizado(autorizadoId: string, displayName: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socio_autorizados')
        .update({ display_name: displayName })
        .eq('id', autorizadoId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}

export async function toggleAutorizadoStatus(autorizadoId: string, isActive: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('socio_autorizados')
        .update({ is_active: isActive })
        .eq('id', autorizadoId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/staff');
}
