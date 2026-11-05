import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '../../lib/utils'
import { dateFilter, todayISO } from '../../lib/dates'
import type { DateFilterValue, DatePreset, DateRange } from '../../types/api'

export type { DateFilterValue }

const PRESETS: { key: Exclude<DatePreset, 'CUSTOM'>; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'WEEK', label: 'This week' },
  { key: 'MONTH', label: 'This month' },
  { key: 'QUARTER', label: 'Last 90 days' },
]


/** Segmented preset control with an inline custom range. */
export function DateRangeFilter({ value, onChange, className, presets = PRESETS.map((p) => p.key) }: { value: DateFilterValue; onChange: (v: DateFilterValue) => void; className?: string; presets?: Exclude<DatePreset, 'CUSTOM'>[] }) {
  const [custom, setCustom] = useState<DateRange>(value.range)
  const today = todayISO()
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <div className="scrollbar-thin flex w-full overflow-x-auto rounded-xl bg-ink-100/80 p-1 sm:w-auto" role="group" aria-label="Date range">
        {PRESETS.filter((p) => presets.includes(p.key)).map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(dateFilter(p.key))}
            aria-pressed={value.preset === p.key}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition',
              value.preset === p.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => onChange({ preset: 'CUSTOM', range: custom })}
          aria-pressed={value.preset === 'CUSTOM'}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition',
            value.preset === 'CUSTOM' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Custom
        </button>
      </div>
      {value.preset === 'CUSTOM' && (
        <div className="flex items-center gap-2 text-[13px]">
          <input
            type="date"
            aria-label="From date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => {
              const next = { ...custom, from: e.target.value }
              setCustom(next)
              if (next.from && next.from <= next.to) onChange({ preset: 'CUSTOM', range: next })
            }}
            className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-ink-800 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
          />
          <span className="text-ink-400">to</span>
          <input
            type="date"
            aria-label="To date"
            value={custom.to}
            min={custom.from}
            max={today}
            onChange={(e) => {
              const next = { ...custom, to: e.target.value }
              setCustom(next)
              if (next.to && next.from <= next.to) onChange({ preset: 'CUSTOM', range: next })
            }}
            className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-ink-800 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
