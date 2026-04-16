'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { addLineItems, closeSession, paySession, voidSession, sendToKitchen, cancelLineItem, markDelivered } from '../actions';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import { Banknote, Bell, Ban } from 'lucide-react';
import type { Session, LineItem, MenuItem, MenuCategory } from '@/shared/types/domain';

interface SessionDetailProps {
    session: Session & { socios?: { socio_number: number; display_name: string } };
    lines: LineItem[];
    menuItems: MenuItem[];
    categories: MenuCategory[];
}

function elapsedMinutes(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function SessionDetail({ session: initialSession, lines: initialLines, menuItems, categories }: SessionDetailProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set());
    const [cart, setCart] = useState<{ menu_item_id: string; qty: number; unit_price: number; name: string }[]>([]);
    const [session, setSession] = useState<SessionDetailProps['session']>(initialSession);
    const [lines, setLines] = useState<LineItem[]>(initialLines);
    const [activeCat, setActiveCat] = useState(categories[0]?.id || null);
    const [showPOS, setShowPOS] = useState(false);

    useEffect(() => { setSession(initialSession); }, [initialSession]);
    useEffect(() => { setLines(initialLines); }, [initialLines]);

    // Realtime: line items + session updates
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`session-detail-${initialSession.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items', filter: `session_id=eq.${initialSession.id}` },
                (payload) => {
                    const menuItem = menuItems.find(m => m.id === payload.new.menu_item_id);
                    setLines(prev => [...prev, {
                        ...payload.new,
                        menu_items: { name: menuItem?.name ?? 'Desconocido', prep_type: menuItem?.prep_type }
                    } as LineItem]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items', filter: `session_id=eq.${initialSession.id}` },
                (payload) => {
                    setLines(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } as LineItem : l));
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${initialSession.id}` },
                (payload) => {
                    setSession(prev => ({ ...prev, ...payload.new } as SessionDetailProps['session']));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [initialSession.id]);

    // --- Cart handlers ---
    const handleAddToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_item_id === item.id);
            if (existing) return prev.map(i => i.menu_item_id === item.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { menu_item_id: item.id, qty: 1, unit_price: item.price, name: item.name }];
        });
    };

    const handleRemoveFromCart = (itemId: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_item_id === itemId);
            if (!existing) return prev;
            if (existing.qty === 1) return prev.filter(i => i.menu_item_id !== itemId);
            return prev.map(i => i.menu_item_id === itemId ? { ...i, qty: i.qty - 1 } : i);
        });
    };

    const handleSendOrder = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            await addLineItems(session.id, cart);
            setCart([]);
        } catch (e) {
            alert('Error al marchar el pedido: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            setLoading(false);
        }
    };

    const handleVoidSession = async () => {
        if (!confirm('¿Seguro que quieres anular esta cuenta? No tiene ningún producto.')) return;
        setLoading(true);
        try {
            await voidSession(session.id);
            router.push('/bar');
        } catch (e) {
            alert('Error al anular: ' + (e instanceof Error ? e.message : 'Error'));
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        if (!confirm('¿Seguro que quieres cerrar esta mesa para cobrar?')) return;
        setLoading(true);
        try {
            await closeSession(session.id);
            setLoading(false);
        } catch (e) {
            alert('Error al pedir cuenta: ' + (e instanceof Error ? e.message : 'Error'));
            setLoading(false);
        }
    };

    const handlePay = async () => {
        setLoading(true);
        try {
            await paySession(session.id);
            router.push('/bar');
        } catch (e) {
            alert('Error al cobrar: ' + (e instanceof Error ? e.message : 'Error'));
            setLoading(false);
        }
    };

    // --- Line item action helpers ---
    const startLoading = (ids: string[]) =>
        setActionLoadingIds(prev => new Set([...prev, ...ids]));
    const stopLoading = (ids: string[]) =>
        setActionLoadingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });

    // Barra sirve directamente un item pending mobile (prep_type='bar')
    const handleServeBarItem = useCallback(async (id: string) => {
        startLoading([id]);
        setLines(prev => prev.map(l => l.id === id ? { ...l, state: 'served' } : l));
        try {
            await markDelivered([id]);
        } catch (e) {
            setLines(prev => prev.map(l => l.id === id ? { ...l, state: 'pending' } : l));
            alert('Error: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            stopLoading([id]);
        }
    }, []);

    // Camarero envía items de cocina
    const handleSendToKitchen = useCallback(async (ids: string[]) => {
        startLoading(ids);
        setLines(prev => prev.map(l => ids.includes(l.id) ? { ...l, state: 'sent_kitchen' } : l));
        try {
            await sendToKitchen(ids);
        } catch (e) {
            setLines(prev => prev.map(l => ids.includes(l.id) ? { ...l, state: 'pending' } : l));
            alert('Error: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            stopLoading(ids);
        }
    }, []);

    // Camarero cancela item agotado
    const handleCancelItem = useCallback(async (id: string) => {
        if (!confirm('¿Confirmar que este producto no está disponible?')) return;
        startLoading([id]);
        setLines(prev => prev.map(l => l.id === id ? { ...l, state: 'cancelled' } : l));
        try {
            await cancelLineItem(id);
        } catch (e) {
            setLines(prev => prev.map(l => l.id === id ? { ...l, state: 'pending' } : l));
            alert('Error: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            stopLoading([id]);
        }
    }, []);

    // Camarero marca items de cocina como entregados
    const handleMarkDelivered = useCallback(async (ids: string[]) => {
        startLoading(ids);
        let snapshot: LineItem[] = [];
        setLines(prev => {
            snapshot = prev;
            return prev.map(l => ids.includes(l.id) ? { ...l, state: 'served' } : l);
        });
        try {
            await markDelivered(ids);
        } catch (e) {
            setLines(snapshot);
            alert('Error: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            stopLoading(ids);
        }
    }, []);

    // --- Computed ---
    const pendingMobileLines = lines.filter(l => l.source === 'mobile' && l.state === 'pending');
    const kitchenLines = lines.filter(l => l.state === 'sent_kitchen');
    const servedLines = lines.filter(l => l.state === 'served');
    const cancelledLines = lines.filter(l => l.state === 'cancelled');
    const totalCart = cart.reduce((acc, c) => acc + c.qty * c.unit_price, 0);
    const hasUnsentItems = cart.length > 0;
    const allPendingAreKitchen = pendingMobileLines.every(l => l.menu_items?.prep_type === 'kitchen');
    const allPendingAreBar = pendingMobileLines.every(l => l.menu_items?.prep_type !== 'kitchen');

    return (
        <div className="h-full flex flex-col md:flex-row bg-[#0c0f12]">

            {/* Left side: POS Grid — oculto por defecto, se activa desde el header */}
            {showPOS && (
                <div className="flex-1 flex flex-col pt-4 px-2 md:px-4">
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCat(cat.id)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-colors ${activeCat === cat.id ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-card)] text-[var(--color-muted-foreground)]'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto pb-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {menuItems.filter(m => m.category_id === activeCat).map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    disabled={session.status === 'closing'}
                                    className="bg-gradient-to-b from-[var(--color-card)] to-[#151a21] border border-[var(--color-border)] p-4 rounded-xl flex flex-col items-start justify-between h-28 hover:border-[var(--color-primary)] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                >
                                    <span className="font-bold text-sm leading-tight text-[var(--color-foreground)] line-clamp-2">{item.name}</span>
                                    <span className="text-[var(--color-accent)] font-bold mt-2">{Number(item.price).toFixed(2)}€</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Right side: Ticket — siempre visible */}
            <div className={`${showPOS ? 'w-full md:w-96' : 'w-full'} bg-[var(--color-card)] border-t md:border-t-0 md:border-l border-[var(--color-border)] flex flex-col`}>
                {/* Header: siempre visible — "Socio #n" activa/oculta el POS */}
                <div className="p-4 border-b border-[var(--color-border)] bg-[#11161d] sticky top-0">
                    <div className="flex items-center gap-3">
                        <Link href="/bar" className="p-2 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition text-sm font-bold flex-shrink-0">
                            ← Volver
                        </Link>
                        <button
                            onClick={() => setShowPOS(v => !v)}
                            className="flex-1 text-left hover:opacity-80 transition"
                            title={showPOS ? 'Ocultar productos' : 'Añadir productos a la cuenta'}
                        >
                            <h2 className="text-lg font-black text-white leading-tight">
                                Socio #{session.socios?.socio_number}
                            </h2>
                            <p className="text-[10px] text-[var(--color-muted-foreground)]">
                                {showPOS ? '▲ Ocultar productos' : '▼ Añadir productos'}
                            </p>
                        </button>
                        {session.status === 'closing' && (
                            <div className="bg-[var(--color-warning)] text-black px-3 py-1 rounded-full text-[10px] font-bold animate-pulse flex-shrink-0">
                                COBRANDO
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* Cart (pendiente de marchar) */}
                    {hasUnsentItems && (
                        <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-3">
                            <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase mb-3 flex items-center justify-between">
                                Pedido sin marchar
                                <span>+{totalCart.toFixed(2)}€</span>
                            </h4>
                            <div className="space-y-2">
                                {cart.map(c => (
                                    <div key={c.menu_item_id} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                                        <p className="text-sm truncate font-medium flex-1 text-white">{c.name}</p>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleRemoveFromCart(c.menu_item_id)}
                                                className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white font-bold hover:bg-[var(--color-danger)] transition-colors"
                                            >-</button>
                                            <span className="font-black min-w-[20px] text-center text-white text-sm">{c.qty}</span>
                                            <button
                                                onClick={() => { const item = menuItems.find(m => m.id === c.menu_item_id); if (item) handleAddToCart(item); }}
                                                className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white font-bold hover:bg-[var(--color-primary)] transition-colors"
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sección A — Por revisar (mobile pending) */}
                    {pendingMobileLines.length > 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl p-3">
                            <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                                <Bell className="w-3.5 h-3.5" />
                                Por revisar ({pendingMobileLines.length})
                            </h4>
                            <div className="space-y-2 mb-3">
                                {pendingMobileLines.map(line => {
                                    const isKitchen = line.menu_items?.prep_type === 'kitchen';
                                    const isLoadingItem = actionLoadingIds.has(line.id);
                                    return (
                                        <div
                                            key={line.id}
                                            className={`flex items-center gap-2 text-sm p-2 rounded-lg ${isKitchen ? 'bg-blue-500/10' : 'bg-[#0c0f12]'}`}
                                        >
                                            <span className="text-base flex-shrink-0">{isKitchen ? '🍳' : '🍺'}</span>
                                            <span className="text-[var(--color-muted-foreground)] w-5 flex-shrink-0 text-xs">{line.qty}x</span>
                                            <span className="flex-1 truncate font-medium text-xs">{line.menu_items?.name}</span>
                                            {isKitchen ? (
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleSendToKitchen([line.id])}
                                                        disabled={isLoadingItem}
                                                        className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white text-[10px] font-bold transition-colors disabled:opacity-40"
                                                    >
                                                        {isLoadingItem ? '⟳' : '→ Cocina'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelItem(line.id)}
                                                        disabled={isLoadingItem}
                                                        className="px-2 py-1 rounded bg-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] text-[var(--color-danger)] hover:text-white text-[10px] font-bold transition-colors disabled:opacity-40"
                                                    >
                                                        ✗ No hay
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleServeBarItem(line.id)}
                                                    disabled={isLoadingItem}
                                                    className="flex-shrink-0 h-7 w-7 rounded-full bg-[var(--color-success)]/20 hover:bg-[var(--color-success)] text-[var(--color-success)] hover:text-white transition-colors flex items-center justify-center disabled:opacity-40 text-sm"
                                                    title="Servir directamente"
                                                >
                                                    {isLoadingItem ? '⟳' : '✓'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {pendingMobileLines.length > 1 && (
                                <div className="flex gap-2">
                                    {allPendingAreKitchen ? (
                                        <button
                                            onClick={() => handleSendToKitchen(pendingMobileLines.map(l => l.id))}
                                            disabled={pendingMobileLines.some(l => actionLoadingIds.has(l.id))}
                                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-40"
                                        >
                                            🍳 Todo a cocina
                                        </button>
                                    ) : allPendingAreBar ? (
                                        <button
                                            onClick={() => handleMarkDelivered(pendingMobileLines.map(l => l.id))}
                                            disabled={pendingMobileLines.some(l => actionLoadingIds.has(l.id))}
                                            className="flex-1 py-2 rounded-lg bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 text-white font-bold text-xs transition-colors disabled:opacity-40"
                                        >
                                            ✓ Servir todo
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleMarkDelivered(pendingMobileLines.filter(l => l.menu_items?.prep_type !== 'kitchen').map(l => l.id))}
                                                disabled={pendingMobileLines.some(l => actionLoadingIds.has(l.id))}
                                                className="flex-1 py-2 rounded-lg bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 text-white font-bold text-xs transition-colors disabled:opacity-40"
                                            >
                                                ✓ Barra
                                            </button>
                                            <button
                                                onClick={() => handleSendToKitchen(pendingMobileLines.filter(l => l.menu_items?.prep_type === 'kitchen').map(l => l.id))}
                                                disabled={pendingMobileLines.some(l => actionLoadingIds.has(l.id))}
                                                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors disabled:opacity-40"
                                            >
                                                🍳 Cocina
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sección B — En cocina */}
                    {kitchenLines.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-3">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                                🍳 En cocina ({kitchenLines.length})
                            </h4>
                            <div className="space-y-2 mb-3">
                                {kitchenLines.map(line => {
                                    const elapsed = elapsedMinutes(line.created_at);
                                    const isUrgent = elapsed >= 10;
                                    const isLoadingItem = actionLoadingIds.has(line.id);
                                    return (
                                        <div
                                            key={line.id}
                                            className={`flex items-center gap-2 text-sm p-2 rounded-lg ${isUrgent ? 'bg-red-500/10 animate-pulse' : 'bg-[#0c0f12]'}`}
                                        >
                                            <span className={`text-[10px] font-bold w-6 text-center flex-shrink-0 ${isUrgent ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted-foreground)]'}`}>
                                                {elapsed}m
                                            </span>
                                            <span className="text-[var(--color-muted-foreground)] w-5 flex-shrink-0 text-xs">{line.qty}x</span>
                                            <span className="flex-1 truncate font-medium text-xs">{line.menu_items?.name}</span>
                                            <button
                                                onClick={() => handleMarkDelivered([line.id])}
                                                disabled={isLoadingItem}
                                                className="flex-shrink-0 px-2 py-1 rounded-full bg-[var(--color-success)]/20 hover:bg-[var(--color-success)] text-[var(--color-success)] hover:text-white transition-colors disabled:opacity-40 text-[10px] font-bold"
                                            >
                                                {isLoadingItem ? '⟳' : '✓ Entregado'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            {kitchenLines.length > 1 && (
                                <button
                                    onClick={() => handleMarkDelivered(kitchenLines.map(l => l.id))}
                                    disabled={kitchenLines.some(l => actionLoadingIds.has(l.id))}
                                    className="w-full py-2 rounded-lg bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 text-white font-bold text-xs transition-colors disabled:opacity-40"
                                >
                                    ✓ Todo entregado
                                </button>
                            )}
                        </div>
                    )}

                    {/* Sección C — Consumos registrados */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-[var(--color-muted-foreground)] uppercase">Consumos Registrados</h4>
                        {servedLines.length === 0 && cancelledLines.length === 0 && !hasUnsentItems && pendingMobileLines.length === 0 && kitchenLines.length === 0 && (
                            <p className="text-sm text-[var(--color-muted-foreground)] italic">Mesa vacía. Añade productos.</p>
                        )}
                        {servedLines.map(line => (
                            <div key={line.id} className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                                <span className="text-[var(--color-muted-foreground)] w-6">{line.qty}x</span>
                                <span className="flex-1 truncate px-2">{line.menu_items?.name}</span>
                                <span className="font-mono text-[var(--color-accent)]">{(line.qty * line.unit_price).toFixed(2)}€</span>
                            </div>
                        ))}
                        {cancelledLines.map(line => (
                            <div key={line.id} className="flex justify-between items-center text-sm py-1 border-b border-white/5 opacity-40">
                                <span className="text-[var(--color-muted-foreground)] w-6">{line.qty}x</span>
                                <span className="flex-1 truncate px-2 line-through text-[var(--color-muted-foreground)]">{line.menu_items?.name}</span>
                                <span className="font-mono text-[var(--color-muted-foreground)] line-through">{(line.qty * line.unit_price).toFixed(2)}€</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#0a0d10] border-t border-[var(--color-border)] mt-auto sticky bottom-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[var(--color-muted-foreground)]">Total Cuenta</span>
                        <span className="text-3xl font-black text-white">{Number(session.total_amount).toFixed(2)}€</span>
                    </div>

                    <div className="flex gap-2 items-center">
                        {hasUnsentItems ? (
                            <button
                                onClick={handleSendOrder}
                                disabled={loading}
                                className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform"
                            >
                                {loading ? 'Enviando...' : `Marchar Pedido (${totalCart.toFixed(2)}€)`}
                            </button>
                        ) : session.status === 'open' && lines.length === 0 ? (
                            <button
                                onClick={handleVoidSession}
                                disabled={loading}
                                className="flex-1 py-4 bg-[var(--color-danger)] text-white font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Ban className="w-5 h-5" />
                                {loading ? 'Anulando...' : 'Anular Cuenta'}
                            </button>
                        ) : session.status === 'open' ? (
                            <button
                                onClick={handleCloseSession}
                                disabled={loading}
                                className="flex-1 py-4 bg-[var(--color-success)] text-gray-900 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {loading ? 'Cerrando...' : 'Pedir Cuenta'}
                            </button>
                        ) : session.status === 'closing' ? (
                            <button
                                onClick={handlePay}
                                disabled={loading}
                                className="flex-1 py-4 bg-[var(--color-success)] text-gray-900 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Banknote className="w-5 h-5" />
                                {loading ? 'Cerrando...' : 'Efectivo / TPV'}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

        </div>
    );
}
