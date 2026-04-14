'use client';

import { useState } from 'react';
import {
    updateSocio,
    toggleSocioStatus,
    createSocioAccount,
    updateSocioCredentials,
    addAutorizado,
    updateAutorizado,
    toggleAutorizadoStatus,
} from '../actions';

interface Autorizado {
    id: string;
    display_name: string;
    is_active: boolean;
}

interface SocioRowProps {
    socio: {
        id: string;
        booth_id: string;
        socio_number: number;
        display_name: string;
        status: 'active' | 'inactive';
        user_id: string | null;
        socio_autorizados: Autorizado[];
    };
}

export function SocioRow({ socio }: SocioRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Datos del socio
    const [editNum, setEditNum] = useState(String(socio.socio_number));
    const [editName, setEditName] = useState(socio.display_name);
    const [dirtyDatos, setDirtyDatos] = useState(false);

    // Acceso app
    const [showCredForm, setShowCredForm] = useState(false);
    const [credEmail, setCredEmail] = useState('');
    const [credPassword, setCredPassword] = useState('');

    // Autorizados
    const [autorizados, setAutorizados] = useState<Autorizado[]>(socio.socio_autorizados);
    const [newAutName, setNewAutName] = useState('');
    const [editingAutId, setEditingAutId] = useState<string | null>(null);
    const [editingAutName, setEditingAutName] = useState('');

    async function handleSaveDatos() {
        setLoading(true);
        setError('');
        try {
            await updateSocio(socio.id, parseInt(editNum), editName.trim());
            setDirtyDatos(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveCredentials() {
        if (!credEmail && !credPassword) return;
        setLoading(true);
        setError('');
        try {
            if (!socio.user_id) {
                if (!credEmail || !credPassword) {
                    setError('Email y contraseña son obligatorios para crear el acceso');
                    return;
                }
                await createSocioAccount(socio.id, credEmail.trim(), credPassword);
            } else {
                const updates: { email?: string; password?: string } = {};
                if (credEmail.trim()) updates.email = credEmail.trim();
                if (credPassword) updates.password = credPassword;
                await updateSocioCredentials(socio.user_id, updates);
            }
            setCredEmail('');
            setCredPassword('');
            setShowCredForm(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al guardar credenciales');
        } finally {
            setLoading(false);
        }
    }

    async function handleAddAutorizado(e: React.FormEvent) {
        e.preventDefault();
        if (!newAutName.trim()) return;
        setLoading(true);
        setError('');
        try {
            await addAutorizado(socio.id, socio.booth_id, newAutName.trim());
            setAutorizados(prev => [...prev, {
                id: crypto.randomUUID(),
                display_name: newAutName.trim(),
                is_active: true,
            }]);
            setNewAutName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al añadir autorizado');
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveAutorizado(autorizadoId: string) {
        if (!editingAutName.trim()) return;
        setLoading(true);
        setError('');
        try {
            await updateAutorizado(autorizadoId, editingAutName.trim());
            setAutorizados(prev => prev.map(a =>
                a.id === autorizadoId ? { ...a, display_name: editingAutName.trim() } : a
            ));
            setEditingAutId(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al actualizar');
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleAutorizado(autorizadoId: string, isActive: boolean) {
        try {
            await toggleAutorizadoStatus(autorizadoId, isActive);
            setAutorizados(prev => prev.map(a =>
                a.id === autorizadoId ? { ...a, is_active: isActive } : a
            ));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error');
        }
    }

    return (
        <>
            {/* Fila principal */}
            <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                <td className="p-4 font-bold text-lg text-[var(--color-secondary-foreground)]">
                    # {socio.socio_number}
                </td>
                <td className="p-4">{socio.display_name}</td>
                <td className="p-4 text-xs text-[var(--color-muted-foreground)]">
                    {socio.user_id ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-success)] font-medium">
                            <span>●</span> Vinculado
                        </span>
                    ) : (
                        <span className="text-[var(--color-muted-foreground)]">Sin acceso</span>
                    )}
                </td>
                <td className="p-4 text-center">
                    <select
                        value={socio.status}
                        onChange={(e) => toggleSocioStatus(socio.id, e.target.value as 'active' | 'inactive')}
                        className={`text-xs uppercase font-bold px-2 py-1 rounded outline-none cursor-pointer ${
                            socio.status === 'active'
                                ? 'bg-[var(--color-success)] text-gray-900'
                                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                        }`}
                    >
                        <option value="active">Activo</option>
                        <option value="inactive">De baja</option>
                    </select>
                </td>
                <td className="p-4 text-center">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors px-2"
                        title={expanded ? 'Cerrar' : 'Editar'}
                    >
                        {expanded ? '▲' : '▼'}
                    </button>
                </td>
            </tr>

            {/* Panel expandible */}
            {expanded && (
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/30">
                    <td colSpan={5} className="p-4">
                        <div className="space-y-6">
                            {error && (
                                <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm">
                                    {error}
                                </div>
                            )}

                            {/* ── Datos del socio ── */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
                                    Datos del socio
                                </h4>
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="w-28">
                                        <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">Nº Socio</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editNum}
                                            onChange={e => { setEditNum(e.target.value); setDirtyDatos(true); }}
                                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">Nombre completo</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => { setEditName(e.target.value); setDirtyDatos(true); }}
                                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                    {dirtyDatos && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveDatos}
                                                disabled={loading}
                                                className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded font-medium disabled:opacity-50"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                onClick={() => { setEditNum(String(socio.socio_number)); setEditName(socio.display_name); setDirtyDatos(false); }}
                                                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded font-medium"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── Acceso a la app ── */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
                                    Acceso a la aplicación
                                </h4>
                                {!showCredForm ? (
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm">
                                            {socio.user_id
                                                ? <span className="text-[var(--color-success)]">● Cuenta vinculada</span>
                                                : <span className="text-[var(--color-muted-foreground)]">Sin cuenta de acceso</span>
                                            }
                                        </span>
                                        <button
                                            onClick={() => setShowCredForm(true)}
                                            className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded hover:bg-[var(--color-muted)] transition-colors"
                                        >
                                            {socio.user_id ? 'Cambiar credenciales' : 'Crear acceso'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">
                                                {socio.user_id ? 'Nuevo email (dejar vacío para no cambiar)' : 'Email'}
                                            </label>
                                            <input
                                                type="email"
                                                value={credEmail}
                                                onChange={e => setCredEmail(e.target.value)}
                                                placeholder="socio@email.com"
                                                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">
                                                {socio.user_id ? 'Nueva contraseña (dejar vacía para no cambiar)' : 'Contraseña'}
                                            </label>
                                            <input
                                                type="password"
                                                value={credPassword}
                                                onChange={e => setCredPassword(e.target.value)}
                                                minLength={6}
                                                placeholder="Mín. 6 caracteres"
                                                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveCredentials}
                                                disabled={loading}
                                                className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded font-medium disabled:opacity-50"
                                            >
                                                {socio.user_id ? 'Actualizar' : 'Crear'}
                                            </button>
                                            <button
                                                onClick={() => { setShowCredForm(false); setCredEmail(''); setCredPassword(''); setError(''); }}
                                                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded font-medium"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* ── Autorizados ── */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
                                    Personas autorizadas
                                </h4>
                                <div className="space-y-2 mb-3">
                                    {autorizados.length === 0 && (
                                        <p className="text-sm text-[var(--color-muted-foreground)]">Sin autorizados todavía.</p>
                                    )}
                                    {autorizados.map(aut => (
                                        <div key={aut.id} className="flex items-center gap-3">
                                            {editingAutId === aut.id ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editingAutName}
                                                        onChange={e => setEditingAutName(e.target.value)}
                                                        className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded p-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                                    />
                                                    <button
                                                        onClick={() => handleSaveAutorizado(aut.id)}
                                                        disabled={loading}
                                                        className="text-xs px-3 py-1.5 bg-[var(--color-primary)] text-white rounded disabled:opacity-50"
                                                    >
                                                        Guardar
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingAutId(null)}
                                                        className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded"
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
                                                        onClick={() => { setEditingAutId(aut.id); setEditingAutName(aut.display_name); }}
                                                        className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-2"
                                                        title="Editar nombre"
                                                    >
                                                        ✏
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleAutorizado(aut.id, !aut.is_active)}
                                                        className={`text-xs px-2 py-1 rounded font-medium ${
                                                            aut.is_active
                                                                ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                                                                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                                                        }`}
                                                        title={aut.is_active ? 'Desactivar' : 'Activar'}
                                                    >
                                                        {aut.is_active ? 'Activo' : 'Inactivo'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleAddAutorizado} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={newAutName}
                                        onChange={e => setNewAutName(e.target.value)}
                                        placeholder="Nombre del autorizado"
                                        className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !newAutName.trim()}
                                        className="px-4 py-2 text-sm bg-[var(--color-secondary)] text-white rounded font-medium disabled:opacity-50"
                                    >
                                        + Añadir
                                    </button>
                                </form>
                            </section>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
