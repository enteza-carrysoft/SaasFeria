'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// Fetch full catalog for a booth
export async function getCatalog(boothId: string) {
    const supabase = await createServerSupabaseClient();

    // Categories
    const { data: categories, error: catError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('booth_id', boothId)
        .order('sort_order');

    if (catError) throw new Error(catError.message);

    // Items
    const { data: items, error: itemError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('booth_id', boothId)
        .order('sort_order');

    if (itemError) throw new Error(itemError.message);

    return { categories, items };
}

// Add Category
export async function addCategory(boothId: string, name: string, sortOrder: number = 0) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('menu_categories')
        .insert({ booth_id: boothId, name, sort_order: sortOrder });

    if (error) throw new Error(error.message);
    revalidatePath('/admin/menu');
}

// Add Item
export async function addItem(data: {
    booth_id: string;
    category_id: string;
    name: string;
    price: number;
    prep_type: 'bar' | 'kitchen';
}) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('menu_items')
        .insert(data);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/menu');
}

// Toggle Item state (Active / Top8)
export async function toggleItemState(itemId: string, field: 'is_active' | 'is_top8', value: boolean) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('menu_items')
        .update({ [field]: value })
        .eq('id', itemId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/menu');
}

// Update Item Price
export async function updateItemPrice(itemId: string, price: number) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
        .from('menu_items')
        .update({ price })
        .eq('id', itemId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/menu');
}
