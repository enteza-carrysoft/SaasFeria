'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { addLineItems, closeSession, paySession } from '../actions';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import { Upload, CreditCard, Banknote } from 'lucide-react';

interface SessionDetailProps {
    session: any;
    lines: any[];
    menuItems: any[];
    categories: { id: string; name: string; sort_order: number }[];
}

export function SessionDetail({ session: initialSession, lines: initialLines, menuItems, categories }: SessionDetailProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState<{ menu_item_id: string; qty: number; unit_price: number; name: string }[]>([]);
    const [session, setSession] = useState(initialSession);
    const [lines, setLines] = useState(initialLines);

    const [activeCat, setActiveCat] = useState(categories[0]?.id || null);

    // Sync state when server re-renders (edge case: direct URL navigation)
    useEffect(() => { setSession(initialSession); }, [initialSession]);
    useEffect(() => { setLines(initialLines); }, [initialLines]);

    // Realtime: line items (new bar/mobile orders) + session total & status
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`session-detail-${initialSession.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'line_items', filter: `session_id=eq.${initialSession.id}` },
                (payload) => {
                    const menuItem = menuItems.find((m: any) => m.id === payload.new.menu_item_id);
                    setLines(prev => [...prev, { ...payload.new, menu_items: { name: menuItem?.name ?? 'Desconocido' } }]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${initialSession.id}` },
                (payload) => {
                    setSession((prev: any) => ({ ...prev, ...payload.new }));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [initialSession.id]);


    const handleAddToCart = (item: any) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_item_id === item.id);
            if (existing) {
                return prev.map(i => i.menu_item_id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { menu_item_id: item.id, qty: 1, unit_price: item.price, name: item.name }];
        });
    };

    const handleRemoveFromCart = (itemId: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.menu_item_id === itemId);
            if (!existing) return prev;
            if (existing.qty === 1) return prev.filter(i => i.menu_item_id !== itemId);
            return prev.map(i => i.menu_item_id === itemId ? { ...i, qty: i.qty - 1 } : i);
        });
    };

    const handleSendOrder = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            await addLineItems(session.id, cart);
            setCart([]);
            // Auto reload handled by revalidatePath in action
        } catch (e: any) {
            alert('Error al marchar el pedido: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        if (!confirm('¿Seguro que quieres cerrar esta mesa para cobrar?')) return;
        setLoading(true);
        try {
            await closeSession(session.id);
            // Will re-render with status = 'closing'
            setLoading(false);
        } catch (e: any) {
            alert('Error al pedir cuenta: ' + e.message);
            setLoading(false);
        }
    };

    const handlePay = async (method: 'cash' | 'voucher', file?: File) => {
        setLoading(true);
        try {
            let voucherUrl = null;
            if (method === 'voucher' && file) {
                const supabase = createClient();
                const ext = file.name.split('.').pop();
                const fileName = `${session.booth_id}/${session.id}_${Date.now()}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(fileName, file);

                if (uploadError) throw new Error('Error subiendo foto: ' + uploadError.message);

                const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
                voucherUrl = data.publicUrl;
            }

            await paySession(session.id, voucherUrl);
            router.push('/bar');
        } catch (e: any) {
            alert('Error al cobrar: ' + e.message);
            setLoading(false);
        }
    };

    const totalCart = cart.reduce((acc, c) => acc + (c.qty * c.unit_price), 0);
    const hasUnsentItems = cart.length > 0;

    return (
        <div className="h-full flex flex-col md:flex-row bg-[#0c0f12]">

            {/* Left side: Menu / POS Grid */}
            <div className="flex-1 flex flex-col pt-4 px-2 md:px-4">
                {/* Header (Back button + Session Info) */}
                <div className="flex items-center gap-4 mb-4">
                    <Link href="/bar" className="p-3 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition">
                        ← Volver
                    </Link>
                    <div>
                        <h2 className="text-2xl font-black text-[var(--color-secondary)]">Socio #{session.socios?.socio_number}</h2>
                        <p className="text-sm text-[var(--color-muted-foreground)]">{session.socios?.display_name}</p>
                    </div>
                    {session.status === 'closing' && (
                        <div className="ml-auto bg-[var(--color-warning)] text-black px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                            PENDIENTE COBRO
                        </div>
                    )}
                </div>

                {/* Categories Tab */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCat(cat.id)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-colors ${activeCat === cat.id ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-card)] text-[var(--color-muted-foreground)]'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Menu Items Grid */}
                <div className="flex-1 overflow-y-auto pb-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {menuItems.filter(m => m.category_id === activeCat).map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleAddToCart(item)}
                                disabled={session.status === 'closing'}
                                className="bg-gradient-to-b from-[var(--color-card)] to-[#151a21] border border-[var(--color-border)] p-4 rounded-xl flex flex-col items-start justify-between h-28 hover:border-[var(--color-primary)] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                            >
                                <span className="font-bold text-sm leading-tight text-[var(--color-foreground)] line-clamp-2">{item.name}</span>
                                <span className="text-[var(--color-secondary)] font-bold mt-2">{Number(item.price).toFixed(2)}€</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right side: Ticket / Cart */}
            <div className="w-full md:w-96 bg-[var(--color-card)] border-t md:border-t-0 md:border-l border-[var(--color-border)] flex flex-col">
                <div className="p-4 border-b border-[var(--color-border)] bg-[#11161d] sticky top-0">
                    <h3 className="text-lg font-bold">Resumen de Cuenta</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Unsent Cart Items (Drafts) */}
                    {hasUnsentItems && (
                        <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-3">
                            <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase mb-3 flex items-center justify-between">
                                Pedido Pendiente (Sin marchar)
                                <span>+{totalCart.toFixed(2)}€</span>
                            </h4>
                            <div className="space-y-3">
                                {cart.map(c => (
                                    <div key={c.menu_item_id} className="flex justify-between items-center bg-[#0c0f12] p-2 rounded">
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm truncate pr-2 font-medium">{c.name}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleRemoveFromCart(c.menu_item_id)} className="w-6 h-6 rounded bg-[var(--color-card)] text-white hover:bg-[var(--color-danger)] transition-colors">-</button>
                                            <span className="font-bold min-w-[20px] text-center">{c.qty}</span>
                                            <button onClick={() => handleAddToCart(menuItems.find(m => m.id === c.menu_item_id))} className="w-6 h-6 rounded bg-[var(--color-card)] text-white hover:bg-[var(--color-primary)] transition-colors">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Fired Items (Lines in DB) */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-[var(--color-muted-foreground)] uppercase">Consumos Registrados</h4>
                        {lines.length === 0 && !hasUnsentItems && (
                            <p className="text-sm text-[var(--color-muted-foreground)] italic">Mesa vacía. Añade productos.</p>
                        )}
                        <div className="space-y-2">
                            {lines.map(line => (
                                <div key={line.id} className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                                    <span className="text-[var(--color-muted-foreground)] w-6">{line.qty}x</span>
                                    <span className="flex-1 truncate px-2">{line.menu_items?.name}</span>
                                    <span className="font-mono text-[var(--color-secondary)]">{(line.qty * line.unit_price).toFixed(2)}€</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Action Area */}
                <div className="p-4 bg-[#0a0d10] border-t border-[var(--color-border)] mt-auto sticky bottom-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[var(--color-muted-foreground)]">Total Cuenta</span>
                        <span className="text-3xl font-black text-white">{Number(session.total_amount).toFixed(2)}€</span>
                    </div>

                    <div className="flex gap-2 items-center">
                        {hasUnsentItems ? (
                            <button
                                onClick={handleSendOrder}
                                disabled={loading}
                                className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform"
                            >
                                {loading ? 'Enviando...' : `Marchar Pedido (${totalCart.toFixed(2)}€)`}
                            </button>
                        ) : session.status === 'open' ? (
                            <button
                                onClick={handleCloseSession}
                                disabled={loading || lines.length === 0}
                                className="flex-1 py-4 bg-[var(--color-success)] text-gray-900 font-bold rounded-xl text-lg uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {loading ? 'Cerrando...' : 'Pedir Cuenta'}
                            </button>
                        ) : session.status === 'closing' ? (
                            <div className="flex-1 flex gap-2">
                                <button
                                    onClick={() => handlePay('cash')}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
                                >
                                    <Banknote className="w-5 h-5" />
                                    <span className="text-xs font-bold">Efectivo/TPV</span>
                                </button>
                                <label
                                    className={`flex-1 ${loading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'} py-3 bg-[var(--color-info)] text-white rounded-xl flex flex-col items-center justify-center gap-1 hover:brightness-110 transition-colors`}
                                >
                                    <Upload className="w-5 h-5" />
                                    <span className="text-xs font-bold">Foto Talón</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handlePay('voucher', e.target.files[0]);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

        </div>
    );
}
