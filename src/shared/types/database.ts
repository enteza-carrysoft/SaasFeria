// Auto-generated types will be placed here after schema migration.
// For now, placeholder to avoid import errors.

export type Database = {
    public: {
        Tables: {
            events: {
                Row: {
                    id: string;
                    name: string;
                    start_at: string;
                    end_at: string;
                    timezone: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['events']['Insert']>;
            };
            booths: {
                Row: {
                    id: string;
                    event_id: string;
                    name: string;
                    settings_json: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['booths']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['booths']['Insert']>;
            };
            menu_categories: {
                Row: {
                    id: string;
                    booth_id: string;
                    name: string;
                    sort_order: number;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['menu_categories']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['menu_categories']['Insert']>;
            };
            menu_items: {
                Row: {
                    id: string;
                    booth_id: string;
                    category_id: string;
                    name: string;
                    price: number;
                    is_active: boolean;
                    prep_type: 'bar' | 'kitchen';
                    is_top8: boolean;
                    sort_order: number;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['menu_items']['Row'], 'id' | 'created_at' | 'is_active' | 'is_top8' | 'sort_order'> & {
                    id?: string;
                    created_at?: string;
                    is_active?: boolean;
                    is_top8?: boolean;
                    sort_order?: number;
                };
                Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
            };
            socios: {
                Row: {
                    id: string;
                    booth_id: string;
                    socio_number: number;
                    user_id: string | null;
                    display_name: string;
                    status: 'active' | 'inactive';
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['socios']['Row'], 'id' | 'created_at' | 'status'> & {
                    id?: string;
                    created_at?: string;
                    status?: 'active' | 'inactive';
                };
                Update: Partial<Database['public']['Tables']['socios']['Insert']>;
            };
            staff_users: {
                Row: {
                    id: string;
                    booth_id: string;
                    user_id: string | null;
                    display_name: string;
                    staff_role: 'waiter' | 'kitchen' | 'owner';
                    pin_hash: string | null;
                    is_active: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['staff_users']['Row'], 'id' | 'created_at' | 'is_active'> & {
                    id?: string;
                    created_at?: string;
                    is_active?: boolean;
                };
                Update: Partial<Database['public']['Tables']['staff_users']['Insert']>;
            };
            sessions: {
                Row: {
                    id: string;
                    booth_id: string;
                    socio_id: string;
                    status: 'open' | 'closing' | 'closed' | 'voided';
                    opened_at: string;
                    closed_at: string | null;
                    total_amount: number;
                    currency: string;
                    opened_by: string | null;
                    closed_by: string | null;
                    version: number;
                    voucher_url: string | null;
                    is_reconciled: boolean;
                };
                Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'opened_at' | 'total_amount' | 'version' | 'is_reconciled'> & {
                    id?: string;
                    opened_at?: string;
                    total_amount?: number;
                    version?: number;
                    is_reconciled?: boolean;
                };
                Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
            };
            line_items: {
                Row: {
                    id: string;
                    session_id: string;
                    menu_item_id: string;
                    qty: number;
                    unit_price: number;
                    state: 'pending' | 'served';
                    source: 'bar' | 'mobile';
                    created_by: string | null;
                    idempotency_key: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['line_items']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['line_items']['Insert']>;
            };
            orders: {
                Row: {
                    id: string;
                    session_id: string;
                    created_by_profile_id: string | null;
                    status: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'status'> & {
                    id?: string;
                    created_at?: string;
                    status?: 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
                };
                Update: Partial<Database['public']['Tables']['orders']['Insert']>;
            };
            order_items: {
                Row: {
                    id: string;
                    order_id: string;
                    menu_item_id: string;
                    qty: number;
                    status: 'pending' | 'preparing' | 'ready' | 'delivered';
                };
                Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'status'> & {
                    id?: string;
                    status?: 'pending' | 'preparing' | 'ready' | 'delivered';
                };
                Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
            };
            vouchers: {
                Row: {
                    id: string;
                    session_id: string;
                    voucher_ref: string | null;
                    amount: number;
                    note: string | null;
                    signed_at: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['vouchers']['Row'], 'id' | 'created_at' | 'signed_at'> & {
                    id?: string;
                    created_at?: string;
                    signed_at?: string;
                };
                Update: Partial<Database['public']['Tables']['vouchers']['Insert']>;
            };
            voucher_photos: {
                Row: {
                    id: string;
                    voucher_id: string;
                    object_key: string;
                    mime: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['voucher_photos']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['voucher_photos']['Insert']>;
            };
            audit_events: {
                Row: {
                    id: string;
                    booth_id: string;
                    actor_user_id: string | null;
                    event_type: string;
                    payload_json: Record<string, unknown>;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['audit_events']['Row'], 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Database['public']['Tables']['audit_events']['Insert']>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
};
