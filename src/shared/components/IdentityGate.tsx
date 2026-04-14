'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { SocioAutorizado } from '@/shared/types/domain';

// ─── Context ─────────────────────────────────────────────────────────────────

interface IdentityValue {
    autorizadoId: string | null;   // null = titular
    displayName: string;
    autorizados: SocioAutorizado[];
    clearIdentity: () => void;
}

const IdentityContext = createContext<IdentityValue>({
    autorizadoId: null,
    displayName: '',
    autorizados: [],
    clearIdentity: () => {},
});

export function useIdentity() {
    return useContext(IdentityContext);
}

// ─── Gate ────────────────────────────────────────────────────────────────────

interface IdentityGateProps {
    socioId: string;
    socioName: string;
    autorizados: SocioAutorizado[];
    children: React.ReactNode;
}

type StoredIdentity = { autorizadoId: string | null; displayName: string };

export function IdentityGate({ socioId, socioName, autorizados, children }: IdentityGateProps) {
    const storageKey = `caseta_identity_${socioId}`;
    const activeAutorizados = autorizados.filter(a => a.is_active);

    const [identity, setIdentity] = useState<StoredIdentity | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            try { setIdentity(JSON.parse(raw)); } catch { localStorage.removeItem(storageKey); }
        }
        setHydrated(true);
    }, [storageKey]);

    function selectIdentity(autorizadoId: string | null, displayName: string) {
        const val: StoredIdentity = { autorizadoId, displayName };
        localStorage.setItem(storageKey, JSON.stringify(val));
        setIdentity(val);
    }

    function clearIdentity() {
        localStorage.removeItem(storageKey);
        setIdentity(null);
    }

    // Mientras se lee localStorage no renderizamos nada (evita parpadeo)
    if (!hydrated) return null;

    // Si hay autorizados activos y aún no hay identidad → pantalla de selección
    if (activeAutorizados.length > 0 && !identity) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-background)]">
                <div className="glass-card p-8 w-full max-w-sm animate-fade-in">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-accent)] mb-4">
                            <span className="text-3xl">👋</span>
                        </div>
                        <h1 className="text-xl font-bold">¿Quién accede?</h1>
                        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
                            Selecciona tu nombre para ver tu cuenta
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => selectIdentity(null, socioName)}
                            className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all active:scale-[0.98]"
                        >
                            <p className="font-bold">{socioName}</p>
                            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">Titular del socio</p>
                        </button>

                        {activeAutorizados.map(aut => (
                            <button
                                key={aut.id}
                                onClick={() => selectIdentity(aut.id, aut.display_name)}
                                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/5 transition-all active:scale-[0.98]"
                            >
                                <p className="font-bold">{aut.display_name}</p>
                                <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">Autorizado</p>
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-center">
                        <form action="/auth/signout" method="POST">
                            <button type="submit" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
                                Cerrar sesión
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    const current = identity ?? { autorizadoId: null, displayName: socioName };

    return (
        <IdentityContext.Provider value={{
            autorizadoId: current.autorizadoId,
            displayName: current.displayName,
            autorizados,
            clearIdentity,
        }}>
            {children}
        </IdentityContext.Provider>
    );
}
