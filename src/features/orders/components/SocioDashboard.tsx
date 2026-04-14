'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { placeMobileOrder, getSocioSessionLines } from '../actions';
import { SocioPerfil } from './SocioPerfil';
import { ShoppingCart, Clock, Receipt, Plus, Minus, Send, ChevronDown, Volume2, Image, X, Settings } from 'lucide-react';
import { createClient } from '@/shared/lib/supabase';
import { useAlertSound, type AlertType } from '@/shared/hooks/useAlertSound';
import { useIdentity } from '@/shared/components/IdentityGate';
import type { Socio, Session, LineItem, MenuCategory, MenuItem } from '@/shared/types/domain';

interface SocioDashboardProps {
    socio: Socio;
    sessions: Session[];
    categories: MenuCategory[];
    menuItems: MenuItem[];
    history: Session[];
}

type Tab = 'cuenta' | 'pedir' | 'historial' | 'perfil';

export function SocioDashboard({ socio, sessions, categories, menuItems, history }: SocioDashboardProps) {
    const { autorizadoId, autorizados } = useIdentity();

    // Sesión activa para esta identidad
    const findMySession = (list: Session[]) =>
        list.find(s => autorizadoId === null ? s.autorizado_id === null : s.autorizado_id === autorizadoId) ?? null;

    const [activeTab, setActiveTab] = useState<Tab>(() => findMySession(sessions) ? 'cuenta' : 'pedir');
    const [cart, setCart] = useState<{ menu_item_id: string; qty: number; unit_price: number; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [session, setSession] = useState<Session | null>(() => findMySession(sessions));
    const [lines, setLines] = useState<LineItem[]>([]);
    const [notifStatus, setNotifStatus] = useState<'default' | 'granted'>('default');
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
    const [inAppAlert, setInAppAlert] = useState<{ message: string; id: number } | null>(null);
    const [pendingCallAlert, setPendingCallAlert] = useState(false);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [sessionLinesCache, setSessionLinesCache] = useState<Record<string, LineItem[]>>({});
    const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const router = useRouter();
    const { alert: playAlert } = useAlertSound();
    // Refs — never go in Realtime useEffect deps (stable, no channel recreation)
    const prevSessionRef = useRef<Session | null>(findMySession(sessions));
    const autorizadoIdRef = useRef<string | null>(autorizadoId);
    const menuItemsRef = useRef<MenuItem[]>(menuItems);
    const triggerAlertRef = useRef<((msg: string, type: AlertType) => void) | null>(null);

    const toggleCategory = (catId: string) => {
        setOpenCategories(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    // Mantener ref de autorizadoId actualizado para handlers de Realtime
    useEffect(() => { autorizadoIdRef.current = autorizadoId; }, [autorizadoId]);

    // Sync sesión desde re-renders del servidor (polling) + disparar alertas si cambia
    useEffect(() => {
        const matched = findMySession(sessions);
        const prev = prevSessionRef.current;
        prevSessionRef.current = matched;
        setSession(matched);

        if (prev?.id === matched?.id && prev?.status === matched?.status && prev?.total_amount === matched?.total_amount) return;

        const alert = triggerAlertRef.current;
        if (!alert) return;

        if (prev === null && matched !== null) {
            setActiveTab('cuenta');
            alert('🍻 El camarero ha abierto tu cuenta', 'account_opened');
        } else if (prev !== null && matched !== null) {
            if (matched.total_amount > prev.total_amount) {
                alert('✅ Pedido servido — importe actualizado', 'order_served');
            }
            if (matched.status === 'closing' && prev.status !== 'closing') {
                alert('💳 Tu cuenta está lista para pagar', 'account_closing');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessions, autorizadoId]);

    // Cargar líneas cuando cambia la sesión activa
    useEffect(() => {
        if (!session?.id) { setLines([]); return; }
        getSocioSessionLines(session.id).then(l => setLines(l as LineItem[]));
    }, [session?.id]);

    useEffect(() => { menuItemsRef.current = menuItems; }, [menuItems]);

    // Track notification permission for the test button (send push only if granted)
    useEffect(() => {
        if ('Notification' in window) {
            setNotifStatus(Notification.permission === 'granted' ? 'granted' : 'default');
        }
    }, []);

    // Show in-app alert banner with sound
    const triggerAlert = useCallback((message: string, type: AlertType = 'generic') => {
        playAlert({ type });
        setInAppAlert({ message, id: Date.now() });
        if (type === 'order_served') {
            setPendingCallAlert(true);
        }
    }, [playAlert]);

    // Keep ref current so Realtime handlers can call it without being in deps
    useEffect(() => { triggerAlertRef.current = triggerAlert; }, [triggerAlert]);

    // Auto-dismiss in-app alert after 4s
    useEffect(() => {
        if (!inAppAlert) return;
        const t = setTimeout(() => setInAppAlert(null), 4000);
        return () => clearTimeout(t);
    }, [inAppAlert]);

    // Realtime: watch sessions filtradas por identidad
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`socio-session-${socio.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions', filter: `socio_id=eq.${socio.id}` },
                (payload) => {
                    const myAutorizadoId = autorizadoIdRef.current;
                    const data = payload.new as Session;
                    // Solo reaccionar a sesiones de nuestra identidad
                    const isMySession = myAutorizadoId === null
                        ? data.autorizado_id === null
                        : data.autorizado_id === myAutorizadoId;
                    if (!isMySession) return;

                    const alert = triggerAlertRef.current;
                    if (payload.eventType === 'INSERT') {
                        prevSessionRef.current = data;
                        setSession(data);
                        setActiveTab('cuenta');
                        alert?.('🍻 El camarero ha abierto tu cuenta', 'account_opened');
                    } else if (payload.eventType === 'UPDATE') {
                        const prev = prevSessionRef.current;
                        prevSessionRef.current = data;
                        setSession(cur => cur ? { ...cur, ...data } : data);
                        if (prev !== null && data.total_amount > prev.total_amount) {
                            alert?.('✅ Pedido servido — importe actualizado', 'order_served');
                        }
                        if (data.status === 'closing' && prev?.status !== 'closing') {
                            alert?.('💳 Tu cuenta está lista para pagar', 'account_closing');
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [socio.id]); // socio.id estable — autorizadoId via ref

    // Realtime: watch line_items — recreates only when session ID actually changes
    // session?.id is a primitive string — stable across re-renders with same session
    useEffect(() => {
        if (!session?.id) return;
        const sid = session.id;
        const supabase = createClient();
        const channel = supabase
            .channel(`socio-lines-${sid}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items', filter: `session_id=eq.${sid}` },
                (payload) => {
                    const menuItem = menuItemsRef.current.find(m => m.id === payload.new.menu_item_id);
                    setLines(prev => [...prev, { ...payload.new, menu_items: { name: menuItem?.name ?? 'Desconocido' } } as LineItem]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items', filter: `session_id=eq.${sid}` },
                (payload) => {
                    setLines(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } as LineItem : l));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session?.id]); // string primitive — only recreates when session truly changes

    // Polling fallback: garantiza actualizaciones aunque Realtime no esté configurado en Supabase.
    // router.refresh() re-renderiza los Server Components y pasa nuevos props a este componente.
    // El useEffect([initialSession]) detecta cambios y dispara alertas si el total sube o el estado cambia.
    // router NO está en ningún deps de los canales Realtime → el polling no destruye los canales.
    useEffect(() => {
        const interval = setInterval(() => { router.refresh(); }, 4000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // empty deps — router is stable (singleton), interval lives for the whole session


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

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'cuenta',   label: 'Mi Cuenta', icon: <Receipt className="w-4 h-4" /> },
        { id: 'pedir',    label: 'Pedir',     icon: <ShoppingCart className="w-4 h-4" /> },
        { id: 'historial',label: 'Historial', icon: <Clock className="w-4 h-4" /> },
        { id: 'perfil',   label: 'Perfil',    icon: <Settings className="w-4 h-4" /> },
    ];

    const handleToggleHistorySession = useCallback(async (sessionId: string) => {
        if (expandedSessionId === sessionId) {
            setExpandedSessionId(null);
            return;
        }
        setExpandedSessionId(sessionId);
        if (sessionLinesCache[sessionId]) return; // ya cargado
        setLoadingSessionId(sessionId);
        try {
            const lines = await getSocioSessionLines(sessionId);
            setSessionLinesCache(prev => ({ ...prev, [sessionId]: lines as LineItem[] }));
        } finally {
            setLoadingSessionId(null);
        }
    }, [expandedSessionId, sessionLinesCache]);

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

                                    {/* Importe — parpadea rojo cuando hay pedido listo sin confirmar */}
                                    <button
                                        onClick={() => setPendingCallAlert(false)}
                                        className={`text-5xl font-black w-full text-center transition-colors ${pendingCallAlert ? 'animate-call-blink cursor-pointer' : 'text-[var(--color-foreground)] cursor-default'}`}
                                        aria-label={pendingCallAlert ? 'Pedido listo — toca para confirmar' : undefined}
                                    >
                                        {Number(session.total_amount).toFixed(2)}€
                                    </button>

                                    {pendingCallAlert && (
                                        <p className="text-xs text-[var(--color-danger)] font-bold mt-1 animate-pulse">
                                            ¡Tu pedido está listo! Toca el importe para confirmar
                                        </p>
                                    )}

                                    <div className="flex items-center justify-center gap-2 mt-3">
                                        <span className={`badge ${session.status === 'open' ? 'badge-open' : 'badge-closing'}`}>
                                            {session.status === 'open' ? 'Cuenta Abierta' : 'Pendiente de Cobro'}
                                        </span>
                                    </div>

                                    {/* Test in-app alert */}
                                    <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-center">
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
                            history.map((s) => {
                                const isExpanded = expandedSessionId === s.id;
                                const isLoading = loadingSessionId === s.id;
                                const cachedLines = sessionLinesCache[s.id];

                                return (
                                    <div key={s.id} className="glass-card overflow-hidden">
                                        {/* Cabecera — toca para expandir */}
                                        <button
                                            onClick={() => handleToggleHistorySession(s.id)}
                                            className="w-full p-4 flex justify-between items-center active:bg-[var(--color-muted)] transition-colors"
                                        >
                                            <div className="text-left">
                                                <p className="text-xs text-[var(--color-muted-foreground)]">
                                                    {new Date(s.closed_at || s.opened_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className={`badge text-[10px] ${s.status === 'closed' ? 'badge-closed' : 'badge-voided'}`}>
                                                        {s.status === 'closed' ? 'Pagada' : 'Anulada'}
                                                    </span>
                                                    {s.autorizado_id && (() => {
                                                        const aut = autorizados.find(a => a.id === s.autorizado_id);
                                                        return aut ? (
                                                            <span className="badge text-[10px] bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                                                                {aut.display_name}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-2xl font-black">{Number(s.total_amount).toFixed(2)}€</p>
                                                <ChevronDown className={`w-4 h-4 text-[var(--color-muted-foreground)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Detalle expandido */}
                                        {isExpanded && (
                                            <div className="border-t border-[var(--color-border)] p-4 space-y-4 animate-fade-in">
                                                {/* Lista de consumiciones */}
                                                {isLoading ? (
                                                    <p className="text-sm text-[var(--color-muted-foreground)] text-center py-2">Cargando...</p>
                                                ) : cachedLines && cachedLines.length > 0 ? (
                                                    <div>
                                                        <p className="text-xs font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-2">Consumiciones</p>
                                                        <div className="space-y-1.5">
                                                            {cachedLines.map(line => (
                                                                <div key={line.id} className="flex items-center text-sm">
                                                                    <span className="text-[var(--color-muted-foreground)] w-6 shrink-0">{line.qty}x</span>
                                                                    <span className="flex-1 truncate px-2">{line.menu_items?.name ?? '—'}</span>
                                                                    <span className="font-mono font-bold shrink-0">{(line.qty * line.unit_price).toFixed(2)}€</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-[var(--color-border)] mt-2">
                                                                <span>Total</span>
                                                                <span className="font-mono">{Number(s.total_amount).toFixed(2)}€</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : cachedLines ? (
                                                    <p className="text-sm text-[var(--color-muted-foreground)] italic">Sin consumiciones registradas.</p>
                                                ) : null}

                                                {/* Foto del ticket */}
                                                {s.voucher_url && (
                                                    <button
                                                        onClick={() => setPhotoUrl(s.voucher_url)}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-muted)] active:bg-[var(--color-muted)] transition-colors"
                                                    >
                                                        <Image className="w-4 h-4" />
                                                        Ver foto del ticket
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ===== PERFIL ===== */}
                {activeTab === 'perfil' && (
                    <SocioPerfil socio={socio} />
                )}

                {/* ===== PHOTO MODAL ===== */}
                {photoUrl && (
                    <div
                        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
                        onClick={() => setPhotoUrl(null)}
                    >
                        <button
                            onClick={() => setPhotoUrl(null)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
                            aria-label="Cerrar"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <p className="text-white/60 text-xs mb-3">Toca para cerrar</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={photoUrl}
                            alt="Foto del ticket"
                            className="max-w-full max-h-[80dvh] object-contain rounded-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
