'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

type Status = 'unsupported' | 'loading' | 'default' | 'granted' | 'denied';

export function NotificationToggle() {
    const [status, setStatus] = useState<Status>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }
        setStatus(Notification.permission as Status);
    }, []);

    const enable = useCallback(async () => {
        setError(null);
        try {
            const permission = await Notification.requestPermission();
            setStatus(permission as Status);
            if (permission !== 'granted') return;

            const reg = await navigator.serviceWorker.ready;
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

            if (!vapidKey) {
                setError('VAPID key no configurada en Vercel');
                return;
            }

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
            });

            const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error ?? 'Error al guardar suscripción');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        }
    }, []);

    const disable = useCallback(async () => {
        setError(null);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (!sub) { setStatus('default'); return; }

            const { endpoint } = sub;
            await sub.unsubscribe();
            await fetch('/api/push/subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint }),
            });
            setStatus('default');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        }
    }, []);

    // Hidden on unsupported browsers
    if (status === 'unsupported') return null;
    if (status === 'loading') return null;

    if (status === 'denied') {
        return (
            <div className="relative group">
                <button
                    disabled
                    className="p-2 rounded-lg text-[var(--color-muted-foreground)] opacity-50 cursor-not-allowed"
                    title="Notificaciones bloqueadas en el navegador"
                >
                    <BellOff className="w-4 h-4" />
                </button>
                <span className="absolute bottom-full right-0 mb-1 w-48 text-[10px] bg-[var(--color-card)] border border-[var(--color-border)] rounded px-2 py-1 hidden group-hover:block shadow-lg z-50 text-[var(--color-muted-foreground)]">
                    Bloqueadas en el navegador. Actívalas en los ajustes del sitio.
                </span>
            </div>
        );
    }

    return (
        <div className="relative">
            {status === 'granted' ? (
                <button
                    onClick={disable}
                    className="p-2 rounded-lg text-[var(--color-success)] hover:bg-[var(--color-muted)] transition-colors"
                    title="Notificaciones activas — pulsa para desactivar"
                >
                    <BellRing className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={enable}
                    className="p-2 rounded-lg text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] hover:bg-[var(--color-muted)] transition-colors"
                    title="Activar notificaciones"
                >
                    <Bell className="w-4 h-4" />
                </button>
            )}
            {error && (
                <div className="absolute top-full right-0 mt-1 w-64 text-[10px] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] rounded px-2 py-1.5 z-50 shadow-lg">
                    {error}
                </div>
            )}
        </div>
    );
}
