'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import { markItemsServed, type KitchenOrderItem } from '../actions';

interface KitchenDisplayProps {
    boothId: string;
    initialItems: KitchenOrderItem[];
}

type SessionGroup = {
    session_id: string;
    socio_number: number;
    display_name: string;
    items: KitchenOrderItem[];
    since: string;
};

function groupBySession(items: KitchenOrderItem[]): SessionGroup[] {
    const map = new Map<string, SessionGroup>();
    for (const item of items) {
        if (!map.has(item.session_id)) {
            map.set(item.session_id, {
                session_id: item.session_id,
                socio_number: item.socio_number,
                display_name: item.display_name,
                items: [],
                since: item.created_at,
            });
        }
        map.get(item.session_id)!.items.push(item);
    }
    return Array.from(map.values());
}

function elapsedMinutes(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function KitchenDisplay({ boothId, initialItems }: KitchenDisplayProps) {
    const router = useRouter();
    const [items, setItems] = useState<KitchenOrderItem[]>(initialItems);
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(
        () => new Set(initialItems.map(i => i.session_id))
    );

    // Sync from server re-renders
    useEffect(() => {
        setItems(initialItems);
        setActiveSessionIds(new Set(initialItems.map(i => i.session_id)));
    }, [initialItems]);

    // Realtime: line_items changes
    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel(`kitchen-display-${boothId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items' },
                (payload) => {
                    const li = payload.new as { id: string; session_id: string; state: string; source: string; qty: number; unit_price: number; created_at: string };
                    // Only add if this session belongs to our booth and is pending
                    if (li.state === 'pending' && activeSessionIds.has(li.session_id)) {
                        // We need item_name, socio info — do a refresh to get complete data
                        router.refresh();
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items' },
                (payload) => {
                    const updated = payload.new as { id: string; state: string };
                    if (updated.state === 'served') {
                        setItems(prev => prev.filter(i => i.id !== updated.id));
                    }
                }
            )
            // Watch sessions to know about new opens / closes for this booth
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions', filter: `booth_id=eq.${boothId}` },
                (payload) => {
                    const sess = payload.new as { id: string; status: string } | undefined;
                    if (!sess) return;
                    if (sess.status === 'open' || sess.status === 'closing') {
                        setActiveSessionIds(prev => new Set([...prev, sess.id]));
                    } else {
                        // Closed/voided — remove from set and remove its items
                        setActiveSessionIds(prev => {
                            const next = new Set(prev);
                            next.delete(sess.id);
                            return next;
                        });
                        setItems(prev => prev.filter(i => i.session_id !== sess.id));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [boothId, router, activeSessionIds]);

    const handleMarkServed = useCallback(async (ids: string[]) => {
        setLoadingIds(prev => new Set([...prev, ...ids]));
        // Optimistic: remove from display immediately
        setItems(prev => prev.filter(i => !ids.includes(i.id)));
        try {
            await markItemsServed(ids);
        } catch {
            // On error, refresh to restore correct state
            router.refresh();
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    }, [router]);

    const groups = groupBySession(items);

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] opacity-60 select-none">
                <div className="text-7xl mb-4">🍽️</div>
                <p className="text-2xl font-bold">Cocina al día</p>
                <p className="text-sm mt-2">No hay pedidos pendientes</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 overflow-y-auto">
            {groups.map(group => {
                const elapsed = elapsedMinutes(group.since);
                const isUrgent = elapsed >= 10;
                const allIds = group.items.map(i => i.id);
                const allLoading = allIds.every(id => loadingIds.has(id));

                return (
                    <div
                        key={group.session_id}
                        className={`
                            flex flex-col rounded-2xl border shadow-lg overflow-hidden
                            ${isUrgent
                                ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5 animate-pulse'
                                : 'border-[var(--color-border)] bg-[var(--color-card)]'
                            }
                        `}
                    >
                        {/* Header */}
                        <div className={`
                            flex items-center justify-between px-4 py-3 border-b
                            ${isUrgent ? 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30' : 'border-[var(--color-border)]'}
                        `}>
                            <div>
                                <span className="text-2xl font-black text-[var(--color-secondary)]">
                                    #{group.socio_number}
                                </span>
                                <p className="text-xs text-[var(--color-muted-foreground)] truncate max-w-[120px]">
                                    {group.display_name}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className={`text-sm font-bold ${isUrgent ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted-foreground)]'}`}>
                                    {elapsed}m
                                </span>
                                <p className="text-[10px] text-[var(--color-muted-foreground)]">esperando</p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="flex-1 divide-y divide-[var(--color-border)]">
                            {group.items.map(item => {
                                const isLoading = loadingIds.has(item.id);
                                return (
                                    <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-lg font-black text-[var(--color-accent)] w-6 text-center flex-shrink-0">
                                                {item.qty}×
                                            </span>
                                            <span className="text-sm font-medium truncate">{item.item_name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleMarkServed([item.id])}
                                            disabled={isLoading}
                                            className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--color-success)]/20 hover:bg-[var(--color-success)] text-[var(--color-success)] hover:text-white transition-colors flex items-center justify-center disabled:opacity-40"
                                            title="Marcar listo"
                                        >
                                            {isLoading ? (
                                                <span className="text-xs animate-spin">⟳</span>
                                            ) : (
                                                <span className="text-sm">✓</span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer: Todo Listo */}
                        {group.items.length > 1 && (
                            <div className="px-4 py-3 border-t border-[var(--color-border)]">
                                <button
                                    onClick={() => handleMarkServed(allIds)}
                                    disabled={allLoading}
                                    className="w-full py-2 rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 text-white font-bold text-sm transition-colors disabled:opacity-40"
                                >
                                    {allLoading ? 'Procesando...' : '✓ Todo Listo'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
