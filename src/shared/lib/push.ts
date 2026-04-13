import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configure web-push with VAPID keys
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? 'mailto:admin@casetaapp.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

type PushPayload = {
    title: string;
    body: string;
    url?: string;
    requireInteraction?: boolean;
};

/**
 * Sends a push notification to all registered devices for a given user.
 * Requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
        // Service role key not configured — skip silently
        console.warn('[Push] SUPABASE_SERVICE_ROLE_KEY not configured, skipping push notification');
        return;
    }

    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.warn('[Push] VAPID keys not configured, skipping push notification');
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: subscriptions, error } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId);

    if (error || !subscriptions?.length) return;

    const payloadStr = JSON.stringify(payload);

    await Promise.allSettled(
        subscriptions.map(sub =>
            webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payloadStr
            )
        )
    );
}
