'use client';

import { useState } from 'react';
import { addCategory, addItem, toggleItemState, updateItemPrice } from '../actions';
import type { Database } from '@/shared/types/database';

type Category = Database['public']['Tables']['menu_categories']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];

interface CatalogManagerProps {
    boothId: string;
    categories: Category[];
    items: MenuItem[];
}

export function CatalogManager({ boothId, categories, items }: CatalogManagerProps) {
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [loading, setLoading] = useState(false);

    // Quick Add Item
    const [newItemCatId, setNewItemCatId] = useState<string>('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemPrep, setNewItemPrep] = useState<'bar' | 'kitchen'>('bar');

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        setLoading(true);
        try {
            await addCategory(boothId, newCatName, categories.length);
            setNewCatName('');
            setIsAddingCategory(false);
        } catch (error) {
            console.error(error);
            alert('Error al añadir categoría');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim() || !newItemCatId || !newItemPrice) return;
        setLoading(true);
        try {
            await addItem({
                booth_id: boothId,
                category_id: newItemCatId,
                name: newItemName,
                price: parseFloat(newItemPrice),
                prep_type: newItemPrep
            });
            setNewItemName('');
            setNewItemPrice('');
        } catch (error) {
            console.error(error);
            alert('Error al añadir producto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-card p-4">
                <h2 className="text-xl font-bold">Gestión de Catálogo</h2>
                <button
                    onClick={() => setIsAddingCategory(true)}
                    className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition font-semibold disabled:opacity-50"
                >
                    + Nueva Categoría
                </button>
            </div>

            {isAddingCategory && (
                <form onSubmit={handleAddCategory} className="glass-card p-4 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nombre Categoría</label>
                        <input
                            type="text"
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 focus:border-[var(--color-primary)] outline-none"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-[var(--color-success)] text-gray-900 font-bold rounded">
                        Guardar
                    </button>
                    <button type="button" onClick={() => setIsAddingCategory(false)} className="px-4 py-2 bg-[var(--color-muted)] rounded">
                        Cancelar
                    </button>
                </form>
            )}

            {/* Quick Add Form (only if there are categories) */}
            {categories.length > 0 && (
                <form onSubmit={handleAddItem} className="glass-card p-4 flex flex-col md:flex-row gap-4 items-end bg-gradient-to-r from-[var(--color-card)] to-transparent border-l-4 border-l-[var(--color-accent)]">
                    <div className="flex-1">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Categoría</label>
                        <select
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none"
                            value={newItemCatId}
                            onChange={(e) => setNewItemCatId(e.target.value)}
                            required
                        >
                            <option value="">Seleccionar...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Nombre Producto</label>
                        <input type="text" className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newItemName} onChange={e => setNewItemName(e.target.value)} required />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Precio (€)</label>
                        <input type="number" step="0.10" min="0" className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} required />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-sm text-[var(--color-muted-foreground)] mb-1">Prep.</label>
                        <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded p-2 outline-none" value={newItemPrep} onChange={e => setNewItemPrep(e.target.value as any)}>
                            <option value="bar">Barra</option>
                            <option value="kitchen">Cocina</option>
                        </select>
                    </div>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-[var(--color-success)] text-gray-900 font-bold rounded w-full md:w-auto mt-4 md:mt-0">
                        + Añadir
                    </button>
                </form>
            )}

            {/* Catalog Grid */}
            <div className="space-y-6">
                {categories.length === 0 ? (
                    <div className="text-center p-12 text-[var(--color-muted-foreground)] glass-card">
                        Aún no hay categorías. Empieza creando una categoría como "Bebidas" o "Tapas".
                    </div>
                ) : (
                    categories.map(cat => {
                        const catItems = items.filter(i => i.category_id === cat.id);
                        return (
                            <div key={cat.id} className="glass-card p-6 border-t-2 border-t-[var(--color-primary)]">
                                <h3 className="text-xl font-bold mb-4">{cat.name}</h3>
                                {catItems.length === 0 ? (
                                    <p className="text-sm text-[var(--color-muted-foreground)] italic">Sin productos.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                                                    <th className="pb-2 font-medium">Producto</th>
                                                    <th className="pb-2 font-medium">Precio</th>
                                                    <th className="pb-2 font-medium">Prep</th>
                                                    <th className="pb-2 font-medium text-center">Activo</th>
                                                    <th className="pb-2 font-medium text-center" title="Aparece primero en barra">Top 8</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {catItems.map(item => (
                                                    <tr key={item.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                                                        <td className="py-3 font-semibold">{item.name}</td>
                                                        <td className="py-3">
                                                            <div className="flex items-center gap-1">
                                                                {item.price.toFixed(2)}€
                                                                <button onClick={() => {
                                                                    const newPrice = prompt(`Nuevo precio para ${item.name}:`, item.price.toString());
                                                                    if (newPrice && !isNaN(parseFloat(newPrice))) updateItemPrice(item.id, parseFloat(newPrice));
                                                                }} className="text-xs ml-2 text-[var(--color-primary)] hover:underline">Edit</button>
                                                            </div>
                                                        </td>
                                                        <td className="py-3">
                                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${item.prep_type === 'kitchen' ? 'bg-[var(--color-warning)] text-gray-900' : 'bg-[var(--color-info)] text-white'}`}>
                                                                {item.prep_type}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.is_active}
                                                                onChange={(e) => toggleItemState(item.id, 'is_active', e.target.checked)}
                                                                className="w-4 h-4 cursor-pointer accent-[var(--color-primary)]"
                                                            />
                                                        </td>
                                                        <td className="py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.is_top8}
                                                                onChange={(e) => toggleItemState(item.id, 'is_top8', e.target.checked)}
                                                                className="w-4 h-4 cursor-pointer accent-[var(--color-accent)]"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
}
