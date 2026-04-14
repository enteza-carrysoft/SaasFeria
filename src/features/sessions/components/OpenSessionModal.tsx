'use client';

import { useState } from 'react';
import { openSession, getAutorizadosBySocioNumber } from '@/features/sessions/actions';

interface OpenSessionModalProps {
    boothId: string;
    onClose: () => void;
    onSuccess: (sessionId: string) => void;
}

type Step = 'numero' | 'identidad';

interface AutorizadoInfo { id: string; display_name: string }
interface SocioInfo     { id: string; display_name: string }

export function OpenSessionModal({ boothId, onClose, onSuccess }: OpenSessionModalProps) {
    const [step, setStep] = useState<Step>('numero');
    const [socioNumber, setSocioNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Paso 2
    const [socioInfo, setSocioInfo] = useState<SocioInfo | null>(null);
    const [autorizados, setAutorizados] = useState<AutorizadoInfo[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null); // null = titular

    // ── Paso 1: buscar socio ──────────────────────────────────────────────────
    const handleBuscar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socioNumber) return;
        setLoading(true);
        setError('');

        try {
            const result = await getAutorizadosBySocioNumber(boothId, parseInt(socioNumber));

            if ('error' in result) {
                setError(result.error ?? 'Error desconocido');
                return;
            }

            if (result.autorizados.length === 0) {
                // Sin autorizados → abrir directamente
                const sessionId = await openSession(boothId, parseInt(socioNumber));
                onSuccess(sessionId);
                return;
            }

            // Con autorizados → ir a paso 2
            setSocioInfo({ id: result.socio.id, display_name: result.socio.display_name });
            setAutorizados(result.autorizados);
            setSelectedId(null); // titular por defecto
            setStep('identidad');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al buscar socio');
        } finally {
            setLoading(false);
        }
    };

    // ── Paso 2: abrir con identidad seleccionada ──────────────────────────────
    const handleAbrir = async () => {
        setLoading(true);
        setError('');
        try {
            const sessionId = await openSession(boothId, parseInt(socioNumber), selectedId);
            onSuccess(sessionId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al abrir cuenta');
        } finally {
            setLoading(false);
        }
    };

    const handleNumpad = (key: string) => {
        if (key === 'DEL')   { setSocioNumber(prev => prev.slice(0, -1)); return; }
        if (key === 'CLEAR') { setSocioNumber(''); return; }
        setSocioNumber(prev => prev + key);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="glass-card w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-card)]">
                    <div className="flex items-center gap-3">
                        {step === 'identidad' && (
                            <button
                                onClick={() => { setStep('numero'); setError(''); }}
                                className="w-7 h-7 rounded-full bg-[var(--color-muted)] hover:bg-[var(--color-border)] flex items-center justify-center text-sm transition"
                            >
                                ←
                            </button>
                        )}
                        <h3 className="text-lg font-bold">
                            {step === 'numero' ? 'Abrir Cuenta' : '¿Para quién?'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-[var(--color-muted)] hover:bg-[var(--color-border)] transition flex items-center justify-center"
                    >
                        ✕
                    </button>
                </div>

                {/* ── PASO 1: Número de socio ── */}
                {step === 'numero' && (
                    <form onSubmit={handleBuscar} className="p-6 flex flex-col gap-6">
                        <div>
                            <label className="text-sm text-[var(--color-muted-foreground)] block text-center mb-2">
                                Nº de Socio
                            </label>
                            <input
                                type="text"
                                value={socioNumber}
                                onChange={(e) => setSocioNumber(e.target.value.replace(/\D/g, ''))}
                                className="w-full text-center text-5xl font-bold bg-transparent border-b-2 border-[var(--color-primary)] outline-none py-2 tracking-widest"
                                placeholder="000"
                                autoFocus
                            />
                            {error && (
                                <p className="text-center text-[var(--color-danger)] text-sm mt-3 animate-slide-up">
                                    {error}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'CLEAR', 0, 'DEL'].map((key, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleNumpad(key.toString())}
                                    className="h-16 rounded-lg bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-xl font-bold transition-transform active:scale-95"
                                >
                                    {key === 'DEL' ? '⌫' : key === 'CLEAR' ? 'C' : key}
                                </button>
                            ))}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !socioNumber}
                            className="w-full h-16 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xl uppercase tracking-wider disabled:opacity-50 mt-2 active:scale-[0.98] transition-transform"
                        >
                            {loading ? 'Buscando...' : 'Continuar'}
                        </button>
                    </form>
                )}

                {/* ── PASO 2: Selección de identidad ── */}
                {step === 'identidad' && socioInfo && (
                    <div className="p-6 flex flex-col gap-5">
                        <p className="text-sm text-[var(--color-muted-foreground)] text-center">
                            Socio <strong>#{socioNumber} — {socioInfo.display_name}</strong>
                        </p>

                        <div className="space-y-3">
                            {/* Titular */}
                            <button
                                onClick={() => setSelectedId(null)}
                                className={`w-full p-4 text-left rounded-xl border-2 transition-all active:scale-[0.98] ${
                                    selectedId === null
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        selectedId === null ? 'border-[var(--color-primary)]' : 'border-[var(--color-muted-foreground)]'
                                    }`}>
                                        {selectedId === null && <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{socioInfo.display_name}</p>
                                        <p className="text-xs text-[var(--color-muted-foreground)]">Titular</p>
                                    </div>
                                </div>
                            </button>

                            {/* Autorizados */}
                            {autorizados.map(aut => (
                                <button
                                    key={aut.id}
                                    onClick={() => setSelectedId(aut.id)}
                                    className={`w-full p-4 text-left rounded-xl border-2 transition-all active:scale-[0.98] ${
                                        selectedId === aut.id
                                            ? 'border-[var(--color-secondary)] bg-[var(--color-secondary)]/10'
                                            : 'border-[var(--color-border)] hover:border-[var(--color-secondary)]/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            selectedId === aut.id ? 'border-[var(--color-secondary)]' : 'border-[var(--color-muted-foreground)]'
                                        }`}>
                                            {selectedId === aut.id && <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)]" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{aut.display_name}</p>
                                            <p className="text-xs text-[var(--color-muted-foreground)]">Autorizado</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {error && (
                            <p className="text-center text-[var(--color-danger)] text-sm animate-slide-up">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleAbrir}
                            disabled={loading}
                            className="w-full h-16 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xl uppercase tracking-wider disabled:opacity-50 active:scale-[0.98] transition-transform"
                        >
                            {loading ? 'Abriendo...' : 'Abrir Cuenta'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
