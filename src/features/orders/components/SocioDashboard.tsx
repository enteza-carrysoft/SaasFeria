'use client';

import { useState, useEffect, useCallback } from 'react';
import { placeMobileOrder } from '../actions';
import { ShoppingCart, Clock, Receipt, Plus, Minus, Send, Bell, BellOff, ChevronDown, Volume2 } from 'lucide-react';
import { createClient } from '@/shared/lib/supabase';
import { useAlertSound, type AlertType } from '@/shared/hooks/useAlertSound';
import type { Socio, Session, LineItem, MenuCategory, MenuItem } from '@/shared/types/domain';

interface SocioDashboardProps {
    socio: Socio;
    session: Session | null;
    lines: LineItem[];
    categories: MenuCategory[];
    menuItems: MenuItem[];
    history: Session[];
}

type Tab = 'cuenta' | 'pedir' | 'historial';

// Helper: convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function SocioDashboard({ socio, session: initialSession, lines: initialLines, categories, menuItems, history }: SocioDashboardProps) {
    const [activeTab, setActiveTab] = useState<Tab>(initialSession ? 'cuenta' : 'pedir');
    const [cart, setCart] = useState<{ menu_item_id: string; qty: number; unit_price: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [session, setSession] = useState<Session | null>(initialSession);
    const [lines, setLines] = useState<LineItem[]>(initialLines);
    const [notifStatus, setNotifStatus] = useState<'unsupported' | 'denied' | 'default' | 'granted'>('unsupported');
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
    const [inAppAlert, setInAppAlert] = useState<{ message: string; id: number } | null>(null);
    const { alert: playAlert } = useAlertSound();

    const toggleCategory = (catId: string) => {
        setOpenCategories(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    // Sync state when server re-renders
    useEffect(() => { setSession(initialSession); }, [initialSession]);
    useEffect(() => { setLines(initialLines); }, [initialLines]);

    // Check notification permission status
    useEffect(() => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setNotifStatus('unsupported');
            return;
        }
        setNotifStatus(Notification.permission as 'denied' | 'default' | 'granted');
    }, []);

    const handleEnableNotifications = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const permission = await Notification.requestPermission();
        setNotifStatus(permission as 'denied' | 'default' | 'granted');
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
        });

        const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
        });
    }, []);

    const handleDisableNotifications = useCallback(async () => {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const { endpoint } = sub;
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
        });
        setNotifStatus('default');
    }, []);

    // Show in-app alert banner with sound + vibration
    const triggerAlert = useCallback((message: string, type: AlertType = 'generic') => {
        playAlert({ type });
        setInAppAlert({ message, id: Date.now() });
    }, [playAlert]);

    // Auto-dismiss in-app alert after 4s
    useEffect(() => {
        if (!inAppAlert) return;
        const t = setTimeout(() => setInAppAlert(null), 4000);
        return () => clearTimeout(t);
    }, [inAppAlert]);

    // Realtime: watch sessions for this socio (camarero opens/closes account)
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`socio-session-${socio.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions', filter: `socio_id=eq.${socio.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setSession(payload.new as Session);
                        setActiveTab('cuenta');
                        triggerAlert('🍻 El camarero ha abierto tu cuenta', 'account_opened');
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as Session;
                        setSession(prev => prev ? { ...prev, ...updated } : updated);
                        if (updated.status === 'closing') {
                            triggerAlert('💳 Tu cuenta está lista para pagar', 'account_closing');
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [socio.id, triggerAlert]);

    // Realtime: watch line_items for the active session (served/pending state changes)
    useEffect(() => {
        if (!session?.id) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`socio-lines-${session.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items', filter: `session_id=eq.${session.id}` },
                (payload) => {
                    const menuItem = menuItems.find(m => m.id === payload.new.menu_item_id);
                    setLines(prev => [...prev, { ...payload.new, menu_items: { name: menuItem?.name ?? 'Desconocido' } } as LineItem]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items', filter: `session_id=eq.${session.id}` },
                (payload) => {
                    // payload.old is empty without REPLICA IDENTITY FULL — compare with local state instead
                    setLines(prev => {
                        const existing = prev.find(l => l.id === payload.new.id);
                        if (existing?.state === 'pending' && payload.new?.state === 'served') {
                            const menuItem = menuItems.find(m => m.id === payload.new.menu_item_id);
                            // setTimeout to fire alert outside the state setter
                            setTimeout(() => {
                                triggerAlert(`✅ Listo: ${menuItem?.name ?? 'Tu pedido'} está servido`, 'order_served');
                            }, 0);
                        }
                        return prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } as LineItem : l);
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session?.id, menuItems, triggerAlert]);


    // Cart helpers
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.menu_item_id === item.id);
            if (existing) return prev.map(c => c.menu_item_id === item.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { menu_item_id: item.id, qty: 1, unit_price: item.price, name: item.name }];
        });
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => {
            const existing = prev.find(c => c.menu_item_id === itemId);
            if (!existing) return prev;
            if (existing.qty <= 1) return prev.filter(c => c.menu_item_id !== itemId);
            return prev.map(c => c.menu_item_id === itemId ? { ...c, qty: c.qty - 1 } : c);
        });
    };

    const cartTotal = cart.reduce((sum, c) => sum + c.qty * c.unit_price, 0);
    const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

    const handlePlaceOrder = async () => {
        if (!session || cart.length === 0) return;
        setLoading(true);
        try {
            await placeMobileOrder(session.id, cart);
            setCart([]);
            setOrderSuccess(true);
            setTimeout(() => setOrderSuccess(false), 3000);
            setActiveTab('cuenta');
        } catch (e) {
            alert('Error: ' + (e instanceof Error ? e.message : 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    // Group lines by state
    const pendingLines = lines.filter(l => l.state === 'pending');
    const servedLines = lines.filter(l => l.state === 'served');

    // Group menu by category
    const getCategoryName = (catId: string) => {
        const cat = categories.find(c => c.id === catId);
        return cat?.name || 'Otros';
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'cuenta', label: 'Mi Cuenta', icon: <Receipt className="w-4 h-4" /> },
        { id: 'pedir', label: 'Pedir', icon: <ShoppingCart className="w-4 h-4" /> },
        { id: 'historial', label: 'Historial', icon: <Clock className="w-4 h-4" /> },
    ];

    const handleTestAlert = useCallback(async () => {
        const vibrateSupported = 'vibrate' in navigator;
        const msg = vibrateSupported
            ? '🔔 Prueba — sonido y vibración'
            : '🔔 Prueba — sonido (vibración no soportada en este dispositivo)';
        triggerAlert(msg, 'order_served');
        // Also test push notification via server (only works if subscribed)
        if (notifStatus === 'granted') {
            await fetch('/api/push/test', { method: 'POST' });
        }
    }, [triggerAlert, notifStatus]);

    return (
        <div className="flex flex-col h-[calc(100dvh-56px)]">
            {/* In-app alert banner (foreground notifications) */}
            {inAppAlert && (
                <div
                    key={inAppAlert.id}
                    className="fixed top-16 left-4 right-4 z-50 bg-[var(--color-accent)] text-white px-5 py-3.5 rounded-xl shadow-xl font-bold text-sm animate-fade-in flex items-center gap-3"
                    onClick={() => setInAppAlert(null)}
                >
                    <Volume2 className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{inAppAlert.message}</span>
                </div>
            )}

            {/* Success Toast */}
            {orderSuccess && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-success)] text-gray-900 px-6 py-3 rounded-xl shadow-lg font-bold text-sm animate-fade-in">
                    ✅ Pedido enviado a la barra
                </div>
            )}

            {/* Tab Bar */}
            <nav className="flex border-b border-[var(--color-border)] bg-[var(--color-card)]">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors relative ${activeTab === tab.id
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-muted-foreground)]'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.id === 'pedir' && cartCount > 0 && (
                            <span className="absolute top-1 right-4 w-5 h-5 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-primary)] rounded-full" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {/* ===== MI CUENTA ===== */}
                {activeTab === 'cuenta' && (
                    <div className="p-4 space-y-4 animate-fade-in">
                        {!session ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="text-6xl mb-4">🍻</div>
                                <h2 className="text-xl font-bold mb-2">No tienes cuenta abierta</h2>
                                <p className="text-sm text-[var(--color-muted-foreground)] max-w-xs">
                                    Pide al camarero que abra tu cuenta con tu número de socio <strong>#{socio.socio_number}</strong> para empezar a consumir.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Total Card */}
                                <div className="glass-card p-6 text-center">
                                    <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider mb-1">Total Actual</p>
                                    <p className="text-5xl font-black text-[var(--color-foreground)]">{Number(session.total_amount).toFixed(2)}€</p>
                                    <div className="flex items-center justify-center gap-2 mt-3">
                                        <span className={`badge ${session.status === 'open' ? 'badge-open' : 'badge-closing'}`}>
                                            {session.status === 'open' ? 'Cuenta Abierta' : 'Pendiente de Cobro'}
                                        </span>
                                    </div>

                                    {/* Notification controls */}
                                    <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-center gap-3 flex-wrap">
                                        {notifStatus !== 'unsupported' && notifStatus !== 'denied' && (
                                            notifStatus === 'granted' ? (
                                                <button
                                                    onClick={handleDisableNotifications}
                                                    className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                                                >
                                                    <BellOff className="w-3.5 h-3.5" />
                                                    Desactivar push
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleEnableNotifications}
                                                    className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 font-bold transition-colors"
                                                >
                                                    <Bell className="w-3.5 h-3.5" />
                                                    Activar push
                                                </button>
                                            )
                                        )}
                                        <button
                                            onClick={handleTestAlert}
                                            className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors border border-[var(--color-border)] rounded px-2 py-1"
                                        >
                                            <Volume2 className="w-3.5 h-3.5" />
                                            Probar alerta
                                        </button>
                                    </div>
                                </div>

                                {/* Pending Orders */}
                                {pendingLines.length > 0 && (
                                    <div className="glass-card p-4">
                                        <h3 className="text-sm font-bold text-[var(--color-warning)] flex items-center gap-2 mb-3">
                                            <Clock className="w-4 h-4" /> Pedidos en cola ({pendingLines.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {pendingLines.map(line => (
                                                <div key={line.id} className="flex justify-between items-center text-sm py-1 border-b border-[var(--color-border)] last:border-0">
                                                    <span className="text-[var(--color-muted-foreground)] w-6">{line.qty}x</span>
                                                    <span className="flex-1 truncate px-2">{line.menu_items?.name}</span>
                                                    <span className="badge text-[10px] bg-[var(--color-warning)] text-gray-900">Pendiente</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Served Items */}
                                <div className="glass-card p-4">
                                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                                        <Receipt className="w-4 h-4" /> Consumiciones ({servedLines.length})
                                    </h3>
                                    {servedLines.length === 0 ? (
                                        <p className="text-sm text-[var(--color-muted-foreground)] italic">Aún no hay consumiciones registradas.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {servedLines.map(line => (
                                                <div key={line.id} className="flex justify-between items-center text-sm py-1 border-b border-[var(--color-border)] last:border-0">
                                                    <span className="text-[var(--color-muted-foreground)] w-6">{line.qty}x</span>
                                                    <span className="flex-1 truncate px-2">{line.menu_items?.name}</span>
                                                    <span className="font-mono font-bold">{(line.qty * line.unit_price).toFixed(2)}€</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ===== PEDIR ===== */}
                {activeTab === 'pedir' && (
                    <div className="animate-fade-in">
                        {!session ? (
                            <div className="p-8 text-center">
                                <p className="text-[var(--color-muted-foreground)]">Necesitas tener una cuenta abierta para hacer pedidos.</p>
                            </div>
                        ) : session.status === 'closing' ? (
                            <div className="p-8 text-center">
                                <p className="text-[var(--color-warning)] font-bold">Tu cuenta está pendiente de cobro, no puedes hacer más pedidos.</p>
                            </div>
                        ) : (
                            <>
                                {/* Menu by Category — accordion */}
                                <div className="pb-32 divide-y divide-[var(--color-border)]">
                                    {categories.map((cat) => {
                                        const catItems = menuItems.filter(m => m.category_id === cat.id);
                                        if (catItems.length === 0) return null;
                                        const isOpen = openCategories.has(cat.id);
                                        const catInCart = catItems.reduce((sum, item) => {
                                            const c = cart.find(c => c.menu_item_id === item.id);
                                            return sum + (c?.qty || 0);
                                        }, 0);
                                        return (
                                            <div key={cat.id}>
                                                <button
                                                    onClick={() => toggleCategory(cat.id)}
                                                    className="w-full flex items-center justify-between px-4 py-4 bg-[var(--color-card)] hover:bg-[var(--color-muted)] active:bg-[var(--color-muted)] transition-colors"
                                                >
                                                    <span className="font-bold text-sm uppercase tracking-wider">{cat.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {catInCart > 0 && (
                                                            <span className="w-5 h-5 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                                {catInCart}
                                                            </span>
                                                        )}
                                                        <ChevronDown
                                                            className={`w-4 h-4 text-[var(--color-muted-foreground)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                                        />
                                                    </div>
                                                </button>
                                                {isOpen && (
                                                    <div className="divide-y divide-[var(--color-border)] bg-[var(--color-background)]">
                                                        {catItems.map((item) => {
                                                            const cartItem = cart.find(c => c.menu_item_id === item.id);
                                                            const qty = cartItem?.qty || 0;
                                                            return (
                                                                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <p className="font-semibold text-sm truncate">{item.name}</p>
                                                                        <p className="text-[var(--color-secondary)] font-bold text-sm mt-0.5">{Number(item.price).toFixed(2)}€</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {qty > 0 && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => removeFromCart(item.id)}
                                                                                    className="w-8 h-8 rounded-full bg-[var(--color-muted)] flex items-center justify-center active:scale-90 transition-transform"
                                                                                >
                                                                                    <Minus className="w-4 h-4" />
                                                                                </button>
                                                                                <span className="w-6 text-center font-bold text-sm">{qty}</span>
                                                                            </>
                                                                        )}
                                                                        <button
                                                                            onClick={() => addToCart(item)}
                                                                            className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center active:scale-90 transition-transform shadow-md"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Floating Cart Summary & Order Button */}
                                {cart.length > 0 && (
                                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)] to-transparent pt-8 z-20">
                                        <button
                                            onClick={handlePlaceOrder}
                                            disabled={loading}
                                            className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(233,69,96,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50"
                                        >
                                            <Send className="w-5 h-5" />
                                            {loading ? 'Enviando...' : `Enviar Pedido · ${cartTotal.toFixed(2)}€`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ===== HISTORIAL ===== */}
                {activeTab === 'historial' && (
                    <div className="p-4 space-y-3 animate-fade-in">
                        <h2 className="text-lg font-bold mb-2">Sesiones Anteriores</h2>
                        {history.length === 0 ? (
                            <p className="text-sm text-[var(--color-muted-foreground)] italic">No hay historial de cuenta aún.</p>
                        ) : (
                            history.map((s) => (
                                <div key={s.id} className="glass-card p-4 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-[var(--color-muted-foreground)]">
                                                {new Date(s.closed_at || s.opened_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <span className={`badge text-[10px] mt-1 ${s.status === 'closed' ? 'badge-closed' : 'badge-voided'}`}>
                                                {s.status === 'closed' ? 'Pagada' : 'Anulada'}
                                            </span>
                                        </div>
                                        <p className="text-2xl font-black">{Number(s.total_amount).toFixed(2)}€</p>
                                    </div>

                                    {s.voucher_url && (
                                        <div className="pt-3 border-t border-[var(--color-border)]">
                                            <a
                                                href={s.voucher_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-bold text-[var(--color-info)] flex items-center gap-1 hover:underline"
                                            >
                                                <Receipt className="w-4 h-4" /> Ver Justificante de Pago
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
