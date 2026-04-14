'server-only';

import { createClient } from '@supabase/supabase-js';

/** Cliente con service_role — solo usar en Server Actions o Route Handlers */
export function createAdminSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
