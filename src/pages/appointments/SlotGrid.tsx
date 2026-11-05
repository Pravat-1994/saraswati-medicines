import { CalendarX2 } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { doctorService } from '../../services'
import { formatSlot } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Feedback'
import { DAY_NAMES, nextDays } from '../../lib/clinic'
import { parseISODate } from '../../lib/dates'

/** Horizontal date chips for the booking window. */
export function DateStrip({ value, onChange, days = 14 }: { value: string; onChange: (d: string) => void; days?: number }) {
  const dates = nextDays(days)
  return (
    <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Choose date">
      {dates.map((d) => {
        const dt = parseISODate(d)
        const active = d === value
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={active}
            className={cn(
              'flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-center transition',
              active ? 'border-brand-500 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300',
            )}
          >
            <span className={cn('text-[10px] font-semibold uppercase', active ? 'text-brand-100' : 'text-ink-400')}>{DAY_NAMES[dt.getDay()]}</span>
            <span className="num font-display text-lg leading-tight font-bold">{dt.getDate()}</span>
            <span className={cn('text-[10px]', active ? 'text-brand-100' : 'text-ink-400')}>{dt.toLocaleString('en-IN', { month: 'short' })}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Slot buttons for one doctor + date. Booked and past slots are shown but disabled. */
export function SlotGrid({ doctorId, date, value, onChange, refreshKey = 0, readOnly }: { doctorId?: string; date: string; value?: string; onChange?: (start: string) => void; refreshKey?: number; readOnly?: boolean }) {
  const slots = useQuery(() => doctorService.slots(doctorId!, date), [doctorId, date, refreshKey], { enabled: !!doctorId, tags: ['customers'] })
  if (!doctorId) return <p className="text-[13px] text-ink-500">Select a doctor to see available times.</p>
  if (slots.loading)
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    )
  const list = slots.data ?? []
  if (list.length === 0)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink-200 px-4 py-4 text-[13px] text-ink-500">
        <CalendarX2 className="h-4 w-4" /> The doctor is not available on this day.
      </div>
    )
  const free = list.filter((s) => s.available).length
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {list.map((s) => {
          const active = value === s.start
          return (
            <button
              key={s.start}
              type="button"
              disabled={!s.available || readOnly}
              onClick={() => onChange?.(s.start)}
              aria-pressed={active}
              title={s.available ? 'Available' : s.reason === 'BOOKED' ? 'Already booked' : 'Time has passed'}
              className={cn(
                'num h-9 rounded-lg border text-[12.5px] font-medium transition',
                s.available
                  ? active
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-brand-200 bg-brand-50/60 text-brand-800 hover:border-brand-400 hover:bg-brand-50'
                  : s.reason === 'BOOKED'
                    ? 'cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400 line-through'
                    : 'cursor-not-allowed border-ink-100 bg-white text-ink-300',
                readOnly && s.available && 'cursor-default',
              )}
            >
              {formatSlot(s.start)}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <span>{free} free of {list.length}</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-brand-300 bg-brand-50" /> Available</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-ink-200" /> Booked</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-ink-100 bg-white" /> Past</span>
      </div>
    </div>
  )
}
