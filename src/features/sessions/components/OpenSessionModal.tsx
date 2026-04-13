'use client';

import { useState } from 'react';
import { openSession } from '@/features/sessions/actions';

interface OpenSessionModalProps {
    boothId: string;
    onClose: () => void;
    onSuccess: (sessionId: string) => void;
}

export function OpenSessionModal({ boothId, onClose, onSuccess }: OpenSessionModalProps) {
    const [socioNumber, setSocioNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socioNumber) return;

        setLoading(true);
        setError('');

        try {
            const sessionId = await openSession(boothId, parseInt(socioNumber));
            onSuccess(sessionId);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Simple numpad for quick input
    const handleNumpad = (num: string) => {
        if (num === 'DEL') {
            setSocioNumber(prev => prev.slice(0, -1));
        } else if (num === 'CLEAR') {
            setSocioNumber('');
        } else {
            setSocioNumber(prev => prev + num);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="glass-card w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-card)]">
                    <h3 className="text-lg font-bold">Abrir Cuenta</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--color-muted)] hover:bg-[var(--color-border)] transition flex items-center justify-center">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                    <div>
                        <label className="text-sm text-[var(--color-muted-foreground)] block text-center mb-2">Nº de Socio</label>
                        <input
                            type="text"
                            value={socioNumber}
                            onChange={(e) => setSocioNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-center text-5xl font-bold bg-transparent border-b-2 border-[var(--color-primary)] outline-none py-2 tracking-widest"
                            placeholder="000"
                            autoFocus
                        />
                        {error && <p className="text-center text-[var(--color-danger)] text-sm mt-3 animate-slide-up">{error}</p>}
                    </div>

                    {/* Tablet-friendly Numpad */}
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
                        {loading ? 'Abriendo...' : 'Abrir Mesa'}
                    </button>
                </form>
            </div>
        </div>
    );
}
