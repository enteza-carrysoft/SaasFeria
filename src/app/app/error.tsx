'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[/app error]', error);
    }, [error]);

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="glass-card p-8 w-full max-w-md animate-fade-in text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <h1 className="text-xl font-bold mb-2">Error al cargar la aplicación</h1>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-2">
                    {error.message || 'Se produjo un error inesperado.'}
                </p>
                {error.digest && (
                    <p className="text-xs text-[var(--color-muted-foreground)] mb-6 font-mono">
                        Ref: {error.digest}
                    </p>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="btn-touch px-6 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold"
                    >
                        Reintentar
                    </button>
                    <Link
                        href="/login"
                        className="btn-touch px-6 border border-[var(--color-border)] rounded-xl text-sm"
                    >
                        Volver al login
                    </Link>
                </div>
            </div>
        </main>
    );
}
