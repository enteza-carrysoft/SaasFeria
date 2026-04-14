'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase';
import { updateSocioProfile } from '../actions';
import { addAutorizado, updateAutorizado, toggleAutorizadoStatus } from '@/features/staff/actions';
import { useIdentity } from '@/shared/components/IdentityGate';
import type { Socio, SocioAutorizado } from '@/shared/types/domain';

interface SocioPerfilProps {
    socio: Socio;
}

export function SocioPerfil({ socio }: SocioPerfilProps) {
    const router = useRouter();
    const { autorizados: initialAutorizados } = useIdentity();

    // ── Datos personales ──────────────────────────────────────────────────────
    const [nombre, setNombre] = useState(socio.display_name);
    const [savingNombre, setSavingNombre] = useState(false);
    const [nombreMsg, setNombreMsg] = useState('');

    async function handleSaveNombre() {
        if (nombre.trim() === socio.display_name) return;
        setSavingNombre(true);
        setNombreMsg('');
        try {
            await updateSocioProfile(socio.id, nombre.trim());
            setNombreMsg('Nombre actualizado');
            router.refresh();
        } catch (e) {
            setNombreMsg(e instanceof Error ? e.message : 'Error');
        } finally {
            setSavingNombre(false);
        }
    }

    // ── Acceso (email / contraseña) ───────────────────────────────────────────
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingAcceso, setSavingAcceso] = useState(false);
    const [accesoMsg, setAccesoMsg] = useState<{ text: string; ok: boolean } | null>(null);

    async function handleSaveAcceso(e: React.FormEvent) {
        e.preventDefault();
        if (password && password !== confirmPassword) {
            setAccesoMsg({ text: 'Las contraseñas no coinciden', ok: false });
            return;
        }
        if (!email && !password) return;

        setSavingAcceso(true);
        setAccesoMsg(null);
        try {
            const supabase = createClient();
            if (email) {
                const { error } = await supabase.auth.updateUser({ email: email.trim() });
                if (error) throw error;
            }
            if (password) {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
            }
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setAccesoMsg({
                text: email
                    ? 'Revisa tu correo para confirmar el cambio de email'
                    : 'Contraseña actualizada',
                ok: true,
            });
        } catch (e) {
            setAccesoMsg({ text: e instanceof Error ? e.message : 'Error', ok: false });
        } finally {
            setSavingAcceso(false);
        }
    }

    // ── Autorizados ───────────────────────────────────────────────────────────
    const [autorizados, setAutorizados] = useState<SocioAutorizado[]>(initialAutorizados);
    const [newAutName, setNewAutName] = useState('');
    const [savingAut, setSavingAut] = useState(false);
    const [autMsg, setAutMsg] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    async function handleAddAutorizado(e: React.FormEvent) {
        e.preventDefault();
        if (!newAutName.trim()) return;
        setSavingAut(true);
        setAutMsg('');
        try {
            await addAutorizado(socio.id, socio.booth_id, newAutName.trim());
            setAutorizados(prev => [...prev, {
                id: crypto.randomUUID(),
                socio_id: socio.id,
                booth_id: socio.booth_id,
                display_name: newAutName.trim(),
                is_active: true,
                created_at: new Date().toISOString(),
            }]);
            setNewAutName('');
            router.refresh();
        } catch (e) {
            setAutMsg(e instanceof Error ? e.message : 'Error');
        } finally {
            setSavingAut(false);
        }
    }

    async function handleSaveEdit(id: string) {
        if (!editingName.trim()) return;
        setSavingAut(true);
        try {
            await updateAutorizado(id, editingName.trim());
            setAutorizados(prev => prev.map(a => a.id === id ? { ...a, display_name: editingName.trim() } : a));
            setEditingId(null);
            router.refresh();
        } catch (e) {
            setAutMsg(e instanceof Error ? e.message : 'Error');
        } finally {
            setSavingAut(false);
        }
    }

    async function handleToggle(id: string, current: boolean) {
        try {
            await toggleAutorizadoStatus(id, !current);
            setAutorizados(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
            router.refresh();
        } catch (e) {
            setAutMsg(e instanceof Error ? e.message : 'Error');
        }
    }

    return (
        <div className="p-4 space-y-8 animate-fade-in pb-16">

            {/* ── Datos personales ── */}
            <section className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Datos personales
                </h3>
                <div>
                    <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">Nombre visible</label>
                    <input
                        type="text"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
                    />
                </div>
                {nombreMsg && (
                    <p className="text-xs text-[var(--color-success)]">{nombreMsg}</p>
                )}
                <button
                    onClick={handleSaveNombre}
                    disabled={savingNombre || nombre.trim() === socio.display_name}
                    className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40 transition active:scale-[0.98]"
                >
                    {savingNombre ? 'Guardando...' : 'Guardar nombre'}
                </button>
            </section>

            {/* ── Acceso ── */}
            <section className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Acceso a la app
                </h3>
                <form onSubmit={handleSaveAcceso} className="space-y-3">
                    <div>
                        <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">
                            Nuevo email <span className="text-[var(--color-muted-foreground)]">(dejar vacío para no cambiar)</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="nuevo@email.com"
                            className="w-full px-4 py-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">
                            Nueva contraseña <span className="text-[var(--color-muted-foreground)]">(mín. 6 caracteres)</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            minLength={6}
                            className="w-full px-4 py-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
                        />
                    </div>
                    {password && (
                        <div>
                            <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">Confirmar contraseña</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition"
                            />
                        </div>
                    )}
                    {accesoMsg && (
                        <p className={`text-xs ${accesoMsg.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {accesoMsg.text}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={savingAcceso || (!email && !password)}
                        className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40 transition active:scale-[0.98]"
                    >
                        {savingAcceso ? 'Guardando...' : 'Guardar acceso'}
                    </button>
                </form>
            </section>

            {/* ── Mis autorizados ── */}
            <section className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    Mis autorizados
                </h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                    Las personas autorizadas pueden tener su propia cuenta abierta simultáneamente.
                </p>

                <div className="space-y-2">
                    {autorizados.length === 0 && (
                        <p className="text-sm text-[var(--color-muted-foreground)] italic">Sin autorizados todavía.</p>
                    )}
                    {autorizados.map(aut => (
                        <div key={aut.id} className="flex items-center gap-3 py-1">
                            {editingId === aut.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
                                    />
                                    <button
                                        onClick={() => handleSaveEdit(aut.id)}
                                        disabled={savingAut}
                                        className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className={`flex-1 text-sm ${!aut.is_active ? 'line-through text-[var(--color-muted-foreground)]' : ''}`}>
                                        {aut.display_name}
                                    </span>
                                    <button
                                        onClick={() => { setEditingId(aut.id); setEditingName(aut.display_name); }}
                                        className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-1"
                                        title="Editar"
                                    >
                                        ✏
                                    </button>
                                    <button
                                        onClick={() => handleToggle(aut.id, aut.is_active)}
                                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                                            aut.is_active
                                                ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                                                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                                        }`}
                                    >
                                        {aut.is_active ? 'Activo' : 'Inactivo'}
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {autMsg && <p className="text-xs text-[var(--color-danger)]">{autMsg}</p>}

                <form onSubmit={handleAddAutorizado} className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                    <input
                        type="text"
                        value={newAutName}
                        onChange={e => setNewAutName(e.target.value)}
                        placeholder="Nombre del autorizado"
                        className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/50 transition"
                    />
                    <button
                        type="submit"
                        disabled={savingAut || !newAutName.trim()}
                        className="px-4 py-3 bg-[var(--color-secondary)] text-white rounded-lg font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition"
                    >
                        + Añadir
                    </button>
                </form>
            </section>
        </div>
    );
}
