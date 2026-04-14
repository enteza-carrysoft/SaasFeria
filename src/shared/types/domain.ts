// Core domain types for CasetaApp

export interface Socio {
    id: string;
    user_id: string;
    booth_id: string;
    socio_number: number;
    display_name: string;
    status: 'active' | 'inactive';
}

export interface Session {
    id: string;
    booth_id: string;
    socio_id: string;
    status: 'open' | 'closing' | 'closed' | 'voided';
    total_amount: number;
    currency: string;
    opened_at: string;
    closed_at: string | null;
    opened_by: string | null;
    closed_by: string | null;
    voucher_url: string | null;
    is_reconciled?: boolean;
}

export interface LineItem {
    id: string;
    session_id: string;
    menu_item_id: string;
    qty: number;
    unit_price: number;
    state: 'pending' | 'served';
    source: 'bar' | 'mobile';
    created_at: string;
    created_by?: string | null;
    menu_items: { name: string } | null;
}

export interface MenuCategory {
    id: string;
    booth_id: string;
    name: string;
    sort_order: number;
}

export interface MenuItem {
    id: string;
    booth_id: string;
    category_id: string;
    name: string;
    price: number;
    prep_type: 'bar' | 'kitchen';
    is_active: boolean;
    sort_order: number;
}

export interface StaffUser {
    id: string;
    user_id: string;
    booth_id: string;
    staff_role: 'owner' | 'waiter' | 'kitchen';
    display_name: string;
    is_active: boolean;
    created_at: string;
}
