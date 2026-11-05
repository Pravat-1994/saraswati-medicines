import type { DateFilterValue, DatePreset, DateRange } from '../types/api'
import type { ISODate } from '../types/domain'

const DAY_MS = 86_400_000

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayISO = (): ISODate => toISODate(new Date())

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseISODate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Local calendar day (YYYY-MM-DD) of an ISO date-time string. */
export function localDay(value: string): ISODate {
  return value.length === 10 ? value : toISODate(new Date(value))
}

/** Whole days from today until the given date (negative if past). */
export function daysUntil(value: string, from: Date = new Date()): number {
  const target = startOfDay(parseISODate(value)).getTime()
  return Math.round((target - startOfDay(from).getTime()) / DAY_MS)
}

export function isWithinRange(value: string, range: DateRange): boolean {
  const day = localDay(value)
  return day >= range.from && day <= range.to
}

export function presetRange(preset: Exclude<DatePreset, 'CUSTOM'>, now: Date = new Date()): DateRange {
  const today = startOfDay(now)
  switch (preset) {
    case 'TODAY':
      return { from: toISODate(today), to: toISODate(today) }
    case 'WEEK': {
      // Week starts Monday (Indian business convention).
      const dow = (today.getDay() + 6) % 7
      return { from: toISODate(addDays(today, -dow)), to: toISODate(today) }
    }
    case 'MONTH':
      return { from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toISODate(today) }
    case 'QUARTER':
      return { from: toISODate(addDays(today, -89)), to: toISODate(today) }
  }
}

/** The range of equal length immediately preceding `range`, for period comparisons. */
export function previousRange(range: DateRange): DateRange {
  const from = parseISODate(range.from)
  const to = parseISODate(range.to)
  const len = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
  return { from: toISODate(addDays(from, -len)), to: toISODate(addDays(from, -1)) }
}

export function eachDay(range: DateRange): ISODate[] {
  const out: ISODate[] = []
  let d = parseISODate(range.from)
  const end = parseISODate(range.to)
  while (d <= end) {
    out.push(toISODate(d))
    d = addDays(d, 1)
  }
  return out
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const monthYearFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' })
const shortDayFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' })

export const formatDate = (v?: string): string => (v ? dateFmt.format(parseISODate(v)) : '—')
export const formatDateTime = (v?: string): string => (v ? dateTimeFmt.format(new Date(v)) : '—')
export const formatMonthYear = (v?: string): string => (v ? monthYearFmt.format(parseISODate(v)) : '—')
export const formatShortDay = (v: string): string => shortDayFmt.format(parseISODate(v))
export const formatTime = (v: string): string => timeFmt.format(new Date(v))

export function relativeTime(value: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(value).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return formatDate(value)
}

export const describeRange = (r: DateRange): string =>
  r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`

/** Date filter value for a preset (Today, This week, ...). */
export const dateFilter = (preset: Exclude<DatePreset, 'CUSTOM'>): DateFilterValue => ({ preset, range: presetRange(preset) })
