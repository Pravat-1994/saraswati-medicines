import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Card({ children, className, padded = false }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn('rounded-2xl border border-ink-200/70 bg-white shadow-card', padded && 'p-5', className)}>{children}</div>
}

export function CardHeader({ title, description, action, icon, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold text-ink-900">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>
}

export type StatTone = 'brand' | 'blue' | 'amber' | 'red' | 'violet' | 'ink'

const iconTone: Record<StatTone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  ink: 'bg-ink-100 text-ink-700 ring-ink-200',
}

export interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: StatTone
  /** Percentage change vs previous period. */
  delta?: number
  deltaLabel?: string
  /** For metrics where lower is better (e.g. expired stock). */
  invertDelta?: boolean
  footer?: ReactNode
  onClick?: () => void
  className?: string
}

export function StatCard({ label, value, icon, tone = 'brand', delta, deltaLabel, invertDelta, footer, onClick, className }: StatCardProps) {
  const good = delta !== undefined && (invertDelta ? delta < 0 : delta > 0)
  const bad = delta !== undefined && (invertDelta ? delta > 0 : delta < 0)
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-4 text-left shadow-card transition-all duration-200 sm:p-5',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        {icon && <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', iconTone[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[26px]">{value}</div>
      {(delta !== undefined || footer) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {delta !== undefined && Number.isFinite(delta) && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold',
                good && 'bg-emerald-50 text-emerald-700',
                bad && 'bg-red-50 text-red-600',
                !good && !bad && 'bg-ink-100 text-ink-600',
              )}
            >
              {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {deltaLabel && <span className="text-ink-500">{deltaLabel}</span>}
          {footer && <span className="text-ink-500">{footer}</span>}
        </div>
      )}
    </Comp>
  )
}

export function InfoRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-900">{value ?? '—'}</dd>
    </div>
  )
}
