import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ChevronDown, ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { NAVIGATION, type BadgeKey, type NavItem } from '../../app/navigation'
import { safeStorage } from '../../lib/storage'
import { cn } from '../../lib/utils'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import { BrandLogo } from './BrandLogo'
import { appConfig } from '../../config/env'

export type NavBadges = Partial<Record<BadgeKey, number>>

const GROUPS_KEY = 'saraswati-medicines.nav-collapsed'

function isActive(item: NavItem, pathname: string) {
  if (item.to === '/') return pathname === '/'
  return item.matchPrefix ? pathname === item.to || pathname.startsWith(`${item.to}/`) : pathname === item.to
}

function SidebarContent({ collapsed, badges, onNavigate }: { collapsed: boolean; badges: NavBadges; onNavigate?: () => void }) {
  const can = useCan()
  const { pathname } = useLocation()
  const role = useSessionStore((s) => s.role)
  const groups = NAVIGATION.map((g) => ({ ...g, items: g.items.filter((i) => (Array.isArray(i.permission) ? i.permission.some(can) : can(i.permission))) })).filter((g) => g.items.length > 0)
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      return JSON.parse(safeStorage.get(GROUPS_KEY) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const toggle = (key: string) => {
    const next = closed.includes(key) ? closed.filter((k) => k !== key) : [...closed, key]
    setClosed(next)
    safeStorage.set(GROUPS_KEY, JSON.stringify(next))
  }
  return (
    <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      {groups.map((g) => (
        <div key={g.key} className="mb-4">
          {!collapsed && g.items.length > 1 ? (
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={!closed.includes(g.key) || g.items.some((i) => isActive(i, pathname))}
              className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-brand-200/50 uppercase transition hover:text-brand-100"
            >
              {g.label}
              <ChevronDown className={cn('h-3 w-3 transition-transform', closed.includes(g.key) && !g.items.some((i) => isActive(i, pathname)) && '-rotate-90')} />
            </button>
          ) : (
            !collapsed && <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-brand-200/50 uppercase">{g.label}</div>
          )}
          <ul className={cn('space-y-0.5', !collapsed && closed.includes(g.key) && !g.items.some((i) => isActive(i, pathname)) && 'hidden')}>
            {g.items.map((item) => {
              const active = isActive(item, pathname)
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all duration-150',
                      collapsed && 'justify-center px-0',
                      active ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]' : 'text-brand-100/70 hover:bg-white/6 hover:text-white',
                    )}
                  >
                    {active && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-300" aria-hidden />}
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-accent-300' : 'text-brand-200/60 group-hover:text-brand-100')} strokeWidth={1.9} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={cn(
                          'num rounded-full bg-accent-400 text-[10px] font-bold text-ink-950',
                          collapsed ? 'absolute top-1 right-1.5 h-4 min-w-4 px-1 leading-4' : 'px-1.5 py-px',
                        )}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {!collapsed && role && (
        <div className="mx-1 mt-2 rounded-xl border border-white/8 bg-white/5 p-3 text-[11.5px] leading-relaxed text-brand-100/70">
          Signed in as <span className="font-semibold text-white">{role.name}</span>. Menu items reflect your role’s permissions.
          {appConfig.demoMode && <span className="block pt-1 text-brand-200/50">Switch role from the profile menu to preview access.</span>}
        </div>
      )}
    </nav>
  )
}

export function Sidebar({ badges }: { badges: NavBadges }) {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useUiStore()
  return (
    <>
      <aside
        className={cn(
          'brand-gradient no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-black/10 transition-[width] duration-200 lg:flex',
          sidebarCollapsed ? 'w-[76px]' : 'w-[264px]',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-white/8', sidebarCollapsed ? 'justify-center px-2' : 'px-5')}>
          <BrandLogo collapsed={sidebarCollapsed} inverted />
        </div>
        <SidebarContent collapsed={sidebarCollapsed} badges={badges} />
        <button
          onClick={toggleSidebar}
          className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-brand-100/60 transition hover:bg-white/6 hover:text-white"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /> Collapse</>)}
        </button>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/50" onClick={() => setMobileNav(false)} aria-hidden />
          <aside className="brand-gradient relative flex h-full w-[280px] animate-slide-in flex-col shadow-pop" style={{ animationDirection: 'normal' }}>
            <div className="flex h-16 items-center justify-between border-b border-white/8 px-5">
              <BrandLogo inverted />
              <button onClick={() => setMobileNav(false)} className="rounded-lg p-1.5 text-brand-100/70 hover:bg-white/10 hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent collapsed={false} badges={badges} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
