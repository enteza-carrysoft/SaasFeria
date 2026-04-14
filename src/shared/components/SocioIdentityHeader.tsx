'use client';

import { useIdentity } from './IdentityGate';

interface SocioIdentityHeaderProps {
    socioNumber: number;
    socioName: string;
}

export function SocioIdentityHeader({ socioNumber, socioName }: SocioIdentityHeaderProps) {
    const { displayName, autorizados, clearIdentity } = useIdentity();
    const hasAutorizados = autorizados.filter(a => a.is_active).length > 0;
    const isAutorizado = displayName !== socioName;

    return (
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-accent)] flex items-center justify-center text-white font-black text-sm shrink-0">
                {socioNumber}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm leading-tight truncate">{displayName}</p>
                    {hasAutorizados && (
                        <button
                            onClick={clearIdentity}
                            title="Cambiar identidad"
                            className="shrink-0 text-[9px] text-[var(--color-muted-foreground)] border border-[var(--color-border)] rounded px-1.5 py-0.5 hover:bg-[var(--color-muted)] transition-colors"
                        >
                            ↕
                        </button>
                    )}
                </div>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                    {isAutorizado ? `Autorizado · Socio #${socioNumber}` : `Socio #${socioNumber}`}
                </p>
            </div>
        </div>
    );
}
