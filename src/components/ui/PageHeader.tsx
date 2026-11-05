import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({ title, description, actions, breadcrumbs, badge }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: Crumb[]; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500">
            {breadcrumbs.map((b, i) => (
              <span key={`${b.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-ink-300" />}
                {b.to ? (
                  <Link to={b.to} className="hover:text-brand-700">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-ink-700">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[28px]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
