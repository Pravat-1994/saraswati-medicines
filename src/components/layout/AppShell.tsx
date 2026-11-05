import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useQuery } from '../../hooks/useQuery'
import { clinicSettingsService, inventoryService, onlineOrderService, salesService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { PageLoader } from '../ui/Feedback'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../stores/uiStore'

export function AppShell() {
  const can = useCan()
  const { pathname } = useLocation()
  const alerts = useQuery(() => inventoryService.alerts(), [], { tags: ['inventory', 'settings'] })
  const approvals = useQuery(
    async () => {
      const [returns, adjustments] = await Promise.all([
        can('returns.approve') ? salesService.returns('PENDING') : Promise.resolve([]),
        can('inventory.approve') ? inventoryService.adjustments('PENDING') : Promise.resolve([]),
      ])
      return { returns: returns.length, adjustments: adjustments.length }
    },
    [can('returns.approve'), can('inventory.approve')],
    { tags: ['sales', 'inventory'] },
  )
  const orders = useQuery(() => onlineOrderService.counts(), [], { tags: ['sales', 'inventory'], enabled: can('orders.view') })
  const clinic = useQuery(() => clinicSettingsService.snapshot(), [], { tags: ['customers', 'sales', 'inventory'], enabled: can('appointments.view') || can('admissions.view') || can('prescriptions.view') })
  const alertList = alerts.data ?? []
  const fullBleed = pathname === '/pos'
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex min-h-screen" style={{ '--sidebar-w': collapsed ? '76px' : '264px' } as React.CSSProperties}>
      <Sidebar
        badges={{
          alerts: alertList.filter((a) => a.severity !== 'info').length,
          approvals: approvals.data?.returns,
          orders: orders.data?.PLACED,
          appointments: clinic.data?.pendingAppointments,
          admissions: can('admissions.approve') || can('beds.manage') ? clinic.data?.pendingAdmissions : undefined,
          discharges: clinic.data?.pendingDischarges,
          rx: can('prescriptions.fulfil') ? clinic.data?.rxToFulfil : undefined,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar alerts={alertList} />
        <main className={cn('flex-1', fullBleed ? 'p-3 sm:p-4 lg:p-5' : 'px-4 py-6 sm:px-6 lg:px-8 lg:py-8')}>
          <div className={cn('mx-auto w-full', !fullBleed && 'max-w-[1440px]')}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
