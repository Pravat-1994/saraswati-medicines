import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden />
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-brand-100/50 blur-xl" aria-hidden />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-100 bg-gradient-to-b from-white to-brand-50 text-brand-600 shadow-sm">
          {icon ?? <Inbox className="h-5 w-5" />}
        </div>
      </div>
      <h3 className="font-display text-[15px] font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)} role="alert">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="font-display text-[15px] font-semibold text-ink-900">We couldn’t load this</h3>
      <p className="mt-1 max-w-md text-[13px] text-ink-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Alert({ tone = 'info', title, children, icon, className, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string; action?: ReactNode }) {
  const styles = {
    info: 'border-sky-200 bg-sky-50/70 text-sky-900',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
    danger: 'border-red-200 bg-red-50/80 text-red-900',
    success: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
  }[tone]
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]', styles, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="space-y-6 p-1" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'amber' | 'red' | 'blue'; className?: string }) {
  const color = { brand: 'bg-brand-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-sky-500' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
