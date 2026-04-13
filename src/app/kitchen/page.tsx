import { getKitchenOrders, getBoothIdForStaff } from '@/features/kitchen/actions';
import { KitchenDisplay } from '@/features/kitchen/components/KitchenDisplay';

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
    const boothId = await getBoothIdForStaff();
    const items = await getKitchenOrders(boothId);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-[#0c0f12] to-[#1a1f26]">
            {/* Status bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)]/50">
                <span className="text-sm text-[var(--color-muted-foreground)]">
                    Pedidos pendientes:
                </span>
                <span className="text-sm font-bold text-[var(--color-accent)]">
                    {items.length} ítem{items.length !== 1 ? 's' : ''}
                </span>
            </div>

            <KitchenDisplay boothId={boothId} initialItems={items} />
        </div>
    );
}
