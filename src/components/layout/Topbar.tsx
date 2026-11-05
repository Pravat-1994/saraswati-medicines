import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, ChevronDown, Command, FlaskConical, LogOut, Menu as MenuIcon, RotateCcw, Search, Store, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { appConfig } from '../../config/env'
import { clearAuthToken, redirectToLogin } from '../../Auth'
import { invalidate, useQuery } from '../../hooks/useQuery'
import { formatDate } from '../../lib/dates'
import { cn, initials } from '../../lib/utils'
import { userService } from '../../services'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { usePosStore } from '../../stores/posStore'
import { Badge } from '../ui/Badge'
import { Menu } from '../ui/Menu'
import { ConfirmDialog } from '../ui/Modal'
import type { InventoryAlert } from '../../types/views'

function AlertsMenu({ alerts }: { alerts: InventoryAlert[] }) {
  const navigate = useNavigate()
  const critical = alerts.filter((a) => a.severity === 'critical').length
  return (
    <Menu
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Inventory alerts (${alerts.length})`}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
        >
          <Bell className="h-[18px] w-[18px]" />
          {alerts.length > 0 && <span className={cn('absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-white', critical ? 'bg-red-500' : 'bg-amber-500')} />}
        </button>
      )}
      header={
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-900">Inventory alerts</span>
          <Badge tone={critical ? 'danger' : 'warning'}>{alerts.length}</Badge>
        </div>
      }
      items={[
        ...alerts.slice(0, 6).map((a) => ({
          label: (
            <span className="flex min-w-60 flex-col">
              <span className="text-ink-900">{a.medicineName}</span>
              <span className="text-xs font-normal text-ink-500">
                {a.kind === 'OUT_OF_STOCK' && 'Out of stock'}
                {a.kind === 'LOW_STOCK' && `Low stock — ${a.quantity} left (min ${a.minStockLevel})`}
                {a.kind === 'EXPIRED' && `Batch ${a.batchNumber} expired ${formatDate(a.expiryDate)}`}
                {a.kind === 'NEAR_EXPIRY' && `Batch ${a.batchNumber} expires in ${a.daysToExpiry} days`}
              </span>
            </span>
          ),
          icon: <span className={cn('block h-2 w-2 rounded-full', a.severity === 'critical' ? 'bg-red-500' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-sky-500')} />,
          onSelect: () => navigate(`/medicines/${a.medicineId}`),
        })),
        'divider' as const,
        { label: 'View all alerts', onSelect: () => navigate('/inventory?tab=alerts') },
      ]}
    />
  )
}

export function Topbar({ alerts }: { alerts: InventoryAlert[] }) {
  const { user, role, roles, switchUser } = useSessionStore()
  const store = useSettingsStore((s) => s.settings?.store)
  const setMobileNav = useUiStore((s) => s.setMobileNav)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)
  const clearCart = usePosStore((s) => s.clear)
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const users = useQuery(() => userService.list(), [], { tags: ['users'], enabled: appConfig.demoMode })

  const logout = () => {
    clearAuthToken()
    redirectToLogin()
  }

  const doReset = async () => {
    setResetting(true)
    try {
      await userService.resetDemoData()
      clearCart()
      await useSettingsStore.getState().load()
      await useSessionStore.getState().init()
      invalidate()
      toast.success('Demo data has been reset to a fresh sample dataset.')
      setConfirmReset(false)
      navigate('/')
    } finally {
      setResetting(false)
    }
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <button onClick={() => setMobileNav(true)} className="-ml-1 rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Open menu">
        <MenuIcon className="h-5 w-5" />
      </button>

      <button
        onClick={() => setCommandOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50/60 px-3 text-left text-[13px] text-ink-400 transition hover:border-ink-300 hover:bg-white"
        aria-label="Search medicines, customers and invoices"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate">Search medicines, customers, invoices…</span>
        <kbd className="hidden items-center gap-0.5 rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 sm:inline-flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {appConfig.demoMode && (
          <span className="hidden items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700 md:inline-flex" title="Running on local sample data">
            <FlaskConical className="h-3.5 w-3.5" /> Demo mode
          </span>
        )}
        <span className="hidden text-xs text-ink-500 xl:block">{formatDate(new Date().toISOString())}</span>
        <AlertsMenu alerts={alerts} />
        <div className="mx-1 hidden h-6 w-px bg-ink-200 sm:block" />
        <Menu
          trigger={({ toggle, open }) => (
            <button onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2.5 rounded-xl py-1 pr-1.5 pl-1 transition hover:bg-ink-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-bold text-white ring-2 ring-white">
                {user ? initials(user.name) : '?'}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-36 truncate text-[13px] font-semibold text-ink-900">{user?.name}</span>
                <span className="block text-[11px] text-ink-500">{role?.name}</span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 md:block" />
            </button>
          )}
          header={
            <div>
              <div className="text-sm font-semibold text-ink-900">{user?.name}</div>
              <div className="text-xs text-ink-500">{user?.email}</div>
              <div className="mt-1.5 text-[11px] text-ink-400">{store?.name}</div>
            </div>
          }
          items={[
            ...(appConfig.demoMode
              ? (users.data ?? [])
                  .filter((u) => u.isActive && u.id !== user?.id)
                  .map((u) => ({
                    label: (
                      <span className="flex flex-col">
                        <span>Act as {u.name}</span>
                        <span className="text-xs font-normal text-ink-500">{roles.find((r) => r.id === u.roleId)?.name}</span>
                      </span>
                    ),
                    icon: <UserCog className="h-4 w-4" />,
                    onSelect: () => {
                      void switchUser(u.id).then(() => {
                        invalidate()
                        toast.success(`Now acting as ${u.name}`)
                        navigate('/')
                      })
                    },
                  }))
              : []),
            'divider' as const,
            {
              label: (
                <span className="flex flex-col">
                  <span>Preview as customer</span>
                  <span className="text-xs font-normal text-ink-500">Open the online storefront & doctor booking</span>
                </span>
              ),
              icon: <Store className="h-4 w-4" />,
              onSelect: () => {
                useUiStore.getState().setCustomerPreview(true)
                navigate('/shop')
              },
            },
            ...(appConfig.demoMode ? ['divider' as const, { label: 'Reset demo data', icon: <RotateCcw className="h-4 w-4" />, onSelect: () => setConfirmReset(true) }] : []),
            ...(appConfig.requireDecisionsAuth ? ['divider' as const, { label: 'Sign out', icon: <LogOut className="h-4 w-4" />, danger: true, onSelect: logout }] : []),
          ]}
        />
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        loading={resetting}
        title="Reset demo data?"
        confirmLabel="Reset data"
        message="All sample records — including sales, purchases and edits you made — will be replaced with a freshly generated dataset. This only affects data stored in this browser."
      />
    </header>
  )
}