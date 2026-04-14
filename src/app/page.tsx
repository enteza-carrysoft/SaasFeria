import Link from 'next/link';
import { InstallPWA } from '@/shared/components/InstallPWA';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-4">
            {/* Hero Section */}
            <div className="text-center animate-fade-in max-w-2xl">
                {/* Logo / Branding */}
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] mb-4 shadow-lg">
                        <span className="text-4xl">🎪</span>
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight mb-3">
                        <span className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] bg-clip-text text-transparent">
                            CasetaApp
                        </span>
                    </h1>
                    <p className="text-xl text-[var(--color-muted-foreground)] max-w-md mx-auto leading-relaxed">
                        Tu caseta de feria, digitalizada. Pedidos, consumos y cuentas en tiempo real.
                    </p>
                </div>

                {/* Feature highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl mb-2">⚡</div>
                        <h3 className="font-semibold text-sm mb-1">Ultra-rápido</h3>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                            Acción de camarero en ≤2 segundos
                        </p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl mb-2">📱</div>
                        <h3 className="font-semibold text-sm mb-1">Pedidos Móvil</h3>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                            El socio pide desde su teléfono
                        </p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-2xl mb-2">📸</div>
                        <h3 className="font-semibold text-sm mb-1">Foto del Talón</h3>
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                            Evidencia digital de cada cierre
                        </p>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/login"
                        className="btn-touch px-8 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white rounded-xl shadow-lg hover:shadow-[var(--shadow-glow)] transition-all"
                    >
                        Iniciar Sesión
                    </Link>
                    <Link
                        href="/register"
                        className="btn-touch px-8 border border-[var(--color-border)] text-[var(--color-foreground)] rounded-xl hover:bg-[var(--color-muted)] transition-all"
                    >
                        Registrarse
                    </Link>
                </div>

                {/* PWA Install Button — shown automatically when browser allows */}
                <div className="flex justify-center mt-4">
                    <InstallPWA />
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-6 text-center text-xs text-[var(--color-muted-foreground)]">
                <p>© 2026 CasetaApp • Gestión digital para casetas de feria</p>
            </footer>
        </main>
    );
}
