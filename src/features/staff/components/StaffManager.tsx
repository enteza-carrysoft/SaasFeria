'use client';

import { useState } from 'react';
import { addStaff, toggleStaffStatus, addSocio, toggleSocioStatus } from '../actions';
import type { Database } from '@/shared/types/database';

type StaffUser = Database['public']['Tables']['staff_users']['Row'];
type Socio = Database['public']['Tables']['socios']['Row'];

interface StaffManagerProps {
    boothId: string;
    staff: StaffUser[];
    socios: Socio[];
}

export function StaffManager({ boothId, staff, socios }: StaffManagerProps) {
    const [loading, setLoading] = useState(false);

    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'kitchen' | 'owner'>('waiter');
    const [newStaffPin, setNewStaffPin] = useState('');

    const [newSocioNum, setNewSocioNum] = useState('');
    const [newSocioName, setNewSocioName] = useState('');

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addStaff(boothId, newStaffName, newStaffRole, newStaffPin);
            setNewStaffName('');
            setNewStaffPin('');
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSocio = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addSocio(boothId, parseInt(newSocioNum), newSocioName);
            setNewSocioNum('');
            setNewSocioName('');
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-12 animate-fade-in">
            {/* Staff Section */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold border-b border-[var(--color-border)] pb-2">Empleados / Dispositivos</h2>

                <form onSubmit={handleAddStaff} className="glass-card p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nombre / Identificador</label>
                        <input type="text" className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" placeholder="Ej: Barra Izquierda 1" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required />
                    </div>
                    <div className="w-full md:w-40">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Rol</label>
                        <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newStaffRole} onChange={e => setNewStaffRole(e.target.value as any)}>
                            <option value="waiter">Camarero</option>
                            <option value="kitchen">Cocina</option>
                            <option value="owner">Gestor</option>
                        </select>
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">PIN (Login)</label>
                        <input type="password" maxLength={6} className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none text-center tracking-widest" placeholder="1234" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)} required />
                    </div>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-[var(--color-primary)] text-white font-bold rounded w-full md:w-auto mt-4 md:mt-0">
                        Añadir Staff
                    </button>
                </form>

                <div className="glass-card overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)] bg-[var(--color-background)] bg-opacity-50">
                                <th className="p-4 font-medium">Nombre</th>
                                <th className="p-4 font-medium">Rol</th>
                                <th className="p-4 font-medium">Staff PIN</th>
                                <th className="p-4 font-medium text-center">Activo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map(s => (
                                <tr key={s.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                                    <td className="p-4 font-semibold">{s.display_name}</td>
                                    <td className="p-4 uppercase text-xs font-bold text-[var(--color-muted-foreground)]">{s.staff_role}</td>
                                    <td className="p-4 font-mono text-xs">{s.pin_hash ? '••••' : 'No set'}</td>
                                    <td className="p-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={s.is_active}
                                            onChange={(e) => toggleStaffStatus(s.id, e.target.checked)}
                                            className="w-4 h-4 cursor-pointer accent-[var(--color-primary)]"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Socios Section */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold border-b border-[var(--color-border)] pb-2 text-[var(--color-secondary-foreground)]">Censo de Socios</h2>

                <form onSubmit={handleAddSocio} className="glass-card p-4 flex flex-col md:flex-row gap-4 items-end border-l-4 border-l-[var(--color-secondary)]">
                    <div className="w-full md:w-32">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nº Socio</label>
                        <input type="number" min="1" className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newSocioNum} onChange={e => setNewSocioNum(e.target.value)} required />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nombre Completo</label>
                        <input type="text" className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newSocioName} onChange={e => setNewSocioName(e.target.value)} required />
                    </div>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-[var(--color-secondary)] text-white font-bold rounded w-full md:w-auto mt-4 md:mt-0">
                        Añadir Socio
                    </button>
                </form>

                <div className="glass-card overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)] bg-[var(--color-background)] bg-opacity-50">
                                <th className="p-4 font-medium w-24">Número</th>
                                <th className="p-4 font-medium">Nombre del Socio</th>
                                <th className="p-4 font-medium">Usuario (App)</th>
                                <th className="p-4 font-medium text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {socios.map(s => (
                                <tr key={s.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                                    <td className="p-4 font-bold text-lg text-[var(--color-secondary-foreground)]"># {s.socio_number}</td>
                                    <td className="p-4">{s.display_name}</td>
                                    <td className="p-4 text-[var(--color-muted-foreground)] text-xs truncate max-w-[150px]">
                                        {s.user_id ? 'Vinculado' : 'No registrado'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <select
                                            value={s.status}
                                            onChange={(e) => toggleSocioStatus(s.id, e.target.value as any)}
                                            className={`text-xs uppercase font-bold px-2 py-1 rounded outline-none cursor-pointer ${s.status === 'active' ? 'bg-[var(--color-success)] text-gray-900' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                                                }`}
                                        >
                                            <option value="active">Activo</option>
                                            <option value="inactive">Debaja</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
