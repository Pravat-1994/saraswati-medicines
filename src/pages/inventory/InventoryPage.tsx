import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowRightLeft, Bell, Boxes, History, LayoutGrid, PackagePlus, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { useQuery } from '../../hooks/useQuery'
import { inventoryService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { OverviewTab } from './OverviewTab'
import { BatchesTab } from './BatchesTab'
import { MovementsTab } from './MovementsTab'
import { AdjustmentsTab } from './AdjustmentsTab'
import { TransfersTab } from './TransfersTab'
import { AlertsTab } from './AlertsTab'
import { AddStockModal } from './dialogs'

type TabKey = 'overview' | 'batches' | 'movements' | 'adjustments' | 'transfers' | 'alerts'
const TABS: TabKey[] = ['overview', 'batches', 'movements', 'adjustments', 'transfers', 'alerts']

export default function InventoryPage() {
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as TabKey | null
  const tab: TabKey = raw && TABS.includes(raw) ? raw : 'overview'
  const [addStock, setAddStock] = useState(false)
  const alerts = useQuery(() => inventoryService.alerts(), [], { tags: ['inventory', 'settings'] })
  const pending = useQuery(() => inventoryService.adjustments('PENDING'), [], { tags: ['inventory'] })

  const setTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t }, { replace: false })

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Batch-wise stock, movements, adjustments and expiry control. Stock is allocated First-Expiry-First-Out."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Inventory' }]}
        actions={
          can('inventory.adjust') && (
            <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setAddStock(true)}>
              Add stock
            </Button>
          )
        }
      />
      <Tabs<TabKey>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Overview', icon: <LayoutGrid className="h-4 w-4" /> },
          { key: 'batches', label: 'Batches', icon: <Boxes className="h-4 w-4" /> },
          { key: 'movements', label: 'Stock movements', icon: <History className="h-4 w-4" /> },
          { key: 'adjustments', label: 'Adjustments', icon: <SlidersHorizontal className="h-4 w-4" />, count: pending.data?.length || undefined },
          { key: 'transfers', label: 'Transfers', icon: <ArrowRightLeft className="h-4 w-4" /> },
          { key: 'alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" />, count: alerts.data?.length },
        ]}
      />
      {tab === 'overview' && <OverviewTab onTab={setTab} />}
      {tab === 'batches' && <BatchesTab key={params.get('expiry') ?? 'all'} initialExpiry={params.get('expiry') ?? undefined} />}
      {tab === 'movements' && <MovementsTab />}
      {tab === 'adjustments' && <AdjustmentsTab />}
      {tab === 'transfers' && <TransfersTab />}
      {tab === 'alerts' && <AlertsTab />}
      <AddStockModal open={addStock} onClose={() => setAddStock(false)} />
    </>
  )
}
