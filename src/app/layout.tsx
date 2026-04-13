import '@/app/globals.css';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { ServiceWorkerRegistration } from '@/shared/components/ServiceWorkerRegistration';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
    title: 'CasetaApp — Gestión de Pedidos en Feria',
    description:
        'Sistema digital para gestión de consumos y pedidos de socios en casetas de feria. Cuentas efímeras, pedidos desde el móvil, y tiempo real.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'CasetaApp',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#1a1a2e',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className="min-h-screen bg-background text-[var(--color-foreground)] antialiased">
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    {children}
                    <ServiceWorkerRegistration />
                </ThemeProvider>
            </body>
        </html>
    );
}
