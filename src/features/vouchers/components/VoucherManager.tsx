'use client';

import { useState } from 'react';
import { toggleReconciliation } from '../actions';
import { Receipt, CheckCircle, Circle, Eye } from 'lucide-react';
import type { Session, Socio } from '@/shared/types/domain';

type VoucherSession = Session & { socios: Pick<Socio, 'socio_number' | 'display_name'> | null };

interface VoucherManagerProps {
    sessions: VoucherSession[];
}

export function VoucherManager({ sessions }: VoucherManagerProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleToggle = async (session: VoucherSession) => {
        setLoadingId(session.id);
        try {
            await toggleReconciliation(session.id, session.is_reconciled ?? false);
        } catch (e) {
            alert('Error al conciliar: ' + (e instanceof Error ? e.message : 'Error'));
        } finally {
            setLoadingId(null);
        }
    };

    if (sessions.length === 0) {
        return (
            <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                <Receipt className="w-12 h-12 text-[var(--color-muted-foreground)] mb-4" />
                <h3 className="text-xl font-bold mb-2">Sin Talones</h3>
                <p className="text-[var(--color-muted-foreground)]">No hay cuentas cerradas con justificantes fotográficos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-black text-[var(--color-primary)]">Conciliación de Talones</h1>
            <p className="text-[var(--color-muted-foreground)]">Revise las cuentas cerradas con pago por transferencia/talón físico y concilie el cobro con su cuenta bancaria.</p>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/30">
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">Socio</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">Fecha Cierre</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">Total</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">Justificante</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] text-right">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {sessions.map(session => (
                            <tr key={session.id} className="hover:bg-[var(--color-muted)]/10 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-accent)] flex items-center justify-center text-white font-black text-xs">
                                            {session.socios?.socio_number}
                                        </div>
                                        <span className="font-bold text-sm hidden sm:inline">{session.socios?.display_name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-sm whitespace-nowrap">
                                    {new Date(session.closed_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-4 font-black">
                                    {Number(session.total_amount).toFixed(2)}€
                                </td>
                                <td className="p-4">
                                    <a
                                        href={session.voucher_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded hover:bg-[var(--color-info)] hover:text-white transition-colors text-xs font-bold"
                                    >
                                        <Eye className="w-4 h-4" /> Ver Foto
                                    </a>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleToggle(session)}
                                        disabled={loadingId === session.id}
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${session.is_reconciled
                                                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20'
                                                : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20'
                                            }`}
                                    >
                                        {loadingId === session.id ? (
                                            '...'
                                        ) : session.is_reconciled ? (
                                            <><CheckCircle className="w-4 h-4" /> Conciliado</>
                                        ) : (
                                            <><Circle className="w-4 h-4" /> Pendiente</>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
