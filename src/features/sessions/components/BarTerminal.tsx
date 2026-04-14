'use client';

import { useState, useEffect } from 'react';
import { OpenSessionModal } from './OpenSessionModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import type { Session, Socio, MenuItem } from '@/shared/types/domain';

type SessionWithSocio = Session & { socios: Pick<Socio, 'socio_number' | 'display_name'> | null };

interface BarTerminalProps {
    boothId: string;
    initialSessions: SessionWithSocio[];
    menuItems: MenuItem[];
    mobilePendingCounts: Record<string, number>;
}

export function BarTerminal({ boothId, initialSessions, menuItems, mobilePendingCounts: initialCounts }: BarTerminalProps) {
    const router = useRouter();
    const [isSessionModalOpen, setSessionModalOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionWithSocio[]>(initialSessions);
    const [mobilePendingCounts, setMobilePendingCounts] = useState<Record<string, number>>(initialCounts);
    const [searchQuery, setSearchQuery] = useState('');

    // Sync local state when server re-renders (after router.refresh())
    useEffect(() => {
        setSessions(initialSessions);
    }, [initialSessions]);

    useEffect(() => {
        setMobilePendingCounts(initialCounts);
    }, [initialCounts]);

    // Realtime: sessions changes → refresh grid; line_items changes → update badge counts
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
                        setMobilePendingCounts(prev => ({
                            ...prev,
                            [li.session_id]: (prev[li.session_id] ?? 0) + 1,
                        }));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'line_items' },
                (payload) => {
                    const li = payload.new as { session_id: string; source: string; state: string };
                    const old = payload.old as { state: string };
                    if (li.source === 'mobile' && old.state === 'pending' && li.state === 'served') {
                        setMobilePendingCounts(prev => {
                            const current = prev[li.session_id] ?? 0;
                            if (current <= 1) {
                                const next = { ...prev };
                                delete next[li.session_id];
                                return next;
                            }
                            return { ...prev, [li.session_id]: current - 1 };
                        });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [boothId, router]);

    const filteredSessions = sessions.filter(s =>
        s.socios?.socio_number?.toString().includes(searchQuery) ||
        s.socios?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredSessions.map((session) => {
                            const mobilePending = mobilePendingCounts[session.id] ?? 0;
                            return (
                                <Link
                                    href={`/bar/session/${session.id}`}
                                    key={session.id}
                                    className={`
                                        relative flex flex-col aspect-square p-4 rounded-2xl shadow-lg border transition-all hover:scale-105 active:scale-95
                                        ${session.status === 'open'
                                            ? 'bg-gradient-to-br from-[var(--color-card)] to-[#151a21] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                                            : 'bg-[var(--color-warning)] text-gray-900 border-yellow-500 animate-pulse'
                                        }
                                    `}
                                >
                                    {/* Mobile pending orders badge */}
                                    {mobilePending > 0 && (
                                        <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 bg-[var(--color-accent)] text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-lg z-10 animate-bounce">
                                            {mobilePending}
                                        </span>
                                    )}

                                    <div className="absolute top-2 right-2 flex gap-1">
                                        {session.status === 'closing' && (
                                            <span className="text-[10px] font-bold uppercase bg-black text-white px-2 py-0.5 rounded shadow">
                                                Cobrando
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-auto">
                                        <h4 className="text-3xl font-black mb-1 text-[var(--color-secondary)] drop-shadow-sm">#{session.socios?.socio_number || '??'}</h4>
                                        <p className="text-xs opacity-75 truncate">{session.socios?.display_name || 'Desconocido'}</p>
                                        <div className="mt-4 flex justify-between items-end border-t border-white/10 pt-2">
                                            <span className="text-xs opacity-50">Total</span>
                                            <span className="text-lg font-bold">{Number(session.total_amount).toFixed(2)}€</span>
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
                    onSuccess={(id) => null /* Navigate to it implicitly as Next.js will reload route, or we can push router */}
                />
            )}
        </div>
    );
}
