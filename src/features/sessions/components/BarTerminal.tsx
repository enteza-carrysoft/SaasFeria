'use client';

import { useState, useEffect } from 'react';
import { OpenSessionModal } from './OpenSessionModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import type { Session, Socio, MenuItem } from '@/shared/types/domain';

type SessionWithSocio = Session & {
    socios: Pick<Socio, 'socio_number' | 'display_name'> | null;
    socio_autorizados: { display_name: string } | null;
};

interface BarTerminalProps {
    boothId: string;
    initialSessions: SessionWithSocio[];
    menuItems: MenuItem[];
    pendingCounts: Record<string, number>;    // mobile items por revisar (state=pending)
    kitchenCounts: Record<string, number>;   // items en cocina (state=sent_kitchen)
}

export function BarTerminal({ boothId, initialSessions, menuItems, pendingCounts: initialPending, kitchenCounts: initialKitchen }: BarTerminalProps) {
    const router = useRouter();
    const [isSessionModalOpen, setSessionModalOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionWithSocio[]>(initialSessions);
    const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(initialPending);
    const [kitchenCounts, setKitchenCounts] = useState<Record<string, number>>(initialKitchen);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { setSessions(initialSessions); }, [initialSessions]);
    useEffect(() => { setPendingCounts(initialPending); }, [initialPending]);
    useEffect(() => { setKitchenCounts(initialKitchen); }, [initialKitchen]);

    // Realtime: sessions → refresh grid; line_items → actualizar badges
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`bar-terminal-${boothId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions', filter: `booth_id=eq.${boothId}` },
                () => router.refresh()
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items' },
                (payload) => {
                    const li = payload.new as { session_id: string; source: string; state: string };
                    if (li.source === 'mobile' && li.state === 'pending') {
                        setPendingCounts(prev => ({ ...prev, [li.session_id]: (prev[li.session_id] ?? 0) + 1 }));
                    }
                    if (li.state === 'sent_kitchen') {
                        setKitchenCounts(prev => ({ ...prev, [li.session_id]: (prev[li.session_id] ?? 0) + 1 }));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items' },
                (payload) => {
                    const li = payload.new as { session_id: string; source: string; state: string };
                    const old = payload.old as { state: string };

                    // pending → cualquier otra cosa: decrementar pending
                    if (old.state === 'pending') {
                        setPendingCounts(prev => {
                            const n = (prev[li.session_id] ?? 1) - 1;
                            if (n <= 0) { const next = { ...prev }; delete next[li.session_id]; return next; }
                            return { ...prev, [li.session_id]: n };
                        });
                    }

                    // → sent_kitchen: incrementar kitchen
                    if (li.state === 'sent_kitchen' && old.state !== 'sent_kitchen') {
                        setKitchenCounts(prev => ({ ...prev, [li.session_id]: (prev[li.session_id] ?? 0) + 1 }));
                    }

                    // sent_kitchen → served/cancelled: decrementar kitchen
                    if (old.state === 'sent_kitchen' && li.state !== 'sent_kitchen') {
                        setKitchenCounts(prev => {
                            const n = (prev[li.session_id] ?? 1) - 1;
                            if (n <= 0) { const next = { ...prev }; delete next[li.session_id]; return next; }
                            return { ...prev, [li.session_id]: n };
                        });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [boothId, router]);

    const filteredSessions = sessions.filter(s => {
        const name = (s.socio_autorizados?.display_name ?? s.socios?.display_name ?? '').toLowerCase();
        return s.socios?.socio_number?.toString().includes(searchQuery) ||
            name.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col pt-4 px-4 pb-0 bg-gradient-to-br from-[#0c0f12] to-[#1a1f26]">
            {/* Action Bar */}
            <div className="flex gap-4 items-center mb-6">
                <input
                    type="text"
                    placeholder="Buscar mesa o socio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 max-w-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)] transition"
                />
                <button
                    onClick={() => setSessionModalOpen(true)}
                    className="h-12 px-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(230,57,70,0.3)] transition transform active:scale-95"
                >
                    + ABRIR CUENTA
                </button>
            </div>

            {/* Sessions Grid */}
            <div className="flex-1 overflow-y-auto pb-8">
                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] opacity-50">
                        <div className="text-6xl mb-4">🍻</div>
                        <p className="text-xl">No hay cuentas abiertas</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {filteredSessions.map((session) => {
                            const pending = pendingCounts[session.id] ?? 0;
                            const kitchen = kitchenCounts[session.id] ?? 0;
                            const hasAlerts = pending > 0 || kitchen > 0;

                            const cardStyle =
                                session.status !== 'open'
                                    ? 'bg-[var(--color-warning)] text-gray-900 border-yellow-500 animate-pulse'
                                    : pending > 0 || kitchen > 0
                                        ? 'bg-gradient-to-br from-amber-500/30 to-amber-900/20 border-amber-400/80 shadow-[0_0_14px_rgba(245,166,35,0.35)]'
                                        : 'bg-gradient-to-br from-[var(--color-card)] to-[#151a21] border-[var(--color-border)] hover:border-[var(--color-accent)]';

                            return (
                                <Link
                                    href={`/bar/session/${session.id}`}
                                    key={session.id}
                                    className={`relative flex flex-col w-[150px] h-[90px] p-3 rounded-xl shadow-lg border transition-all hover:scale-105 active:scale-95 ${cardStyle}`}
                                >
                                    <div className="absolute top-1.5 right-1.5">
                                        {session.status === 'closing' && (
                                            <span className="text-[9px] font-bold uppercase bg-black text-white px-1.5 py-0.5 rounded shadow">
                                                Cobrando
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-auto">
                                        {/* Badges dobles */}
                                        {hasAlerts && (
                                            <div className="flex flex-col gap-0.5 mb-0.5">
                                                {pending > 0 && (
                                                    <p className="text-[10px] font-bold text-amber-300 leading-tight">
                                                        📱 {pending} por revisar
                                                    </p>
                                                )}
                                                {kitchen > 0 && (
                                                    <p className="text-[10px] font-bold text-blue-300 leading-tight">
                                                        🍳 {kitchen} en cocina
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <h4 className="text-xl font-black leading-none text-white">#{session.socios?.socio_number || '??'}</h4>
                                        <p className="text-[10px] opacity-60 truncate mt-0.5">
                                            {session.socio_autorizados?.display_name ?? session.socios?.display_name ?? 'Desconocido'}
                                        </p>
                                        <div className="mt-2 border-t border-white/10 pt-1.5 text-right">
                                            <span className="text-xs font-bold">{Number(session.total_amount).toFixed(2)}€</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {isSessionModalOpen && (
                <OpenSessionModal
                    boothId={boothId}
                    onClose={() => setSessionModalOpen(false)}
                    onSuccess={(_id) => null}
                />
            )}
        </div>
    );
}
