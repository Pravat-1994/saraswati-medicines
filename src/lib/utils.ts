import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]): string => clsx(inputs)

let counter = 0

/** Collision-resistant client id. Decisions will issue authoritative ids once integrated. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}

/** Indian financial year label (Apr–Mar), e.g. "26-27". */
export function financialYear(date: Date = new Date()): string {
  const fyStart = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`
}

/** Formats a running document number, e.g. SMS/26-27/00123. */
export function documentNumber(prefix: string, seq: number, date: Date = new Date()): string {
  return `${prefix}/${financialYear(date)}/${String(seq).padStart(5, '0')}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

export function sortBy<T>(items: T[], getter: (item: T) => string | number, dir: 'asc' | 'desc' = 'asc'): T[] {
  const mult = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const av = getter(a)
    const bv = getter(b)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
    return String(av).localeCompare(String(bv), 'en-IN', { numeric: true }) * mult
  })
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Percentage change vs a previous value (undefined when previous is 0 and current is not). */
export const pctChange = (current: number, previous: number): number | undefined =>
  previous === 0 ? (current === 0 ? 0 : undefined) : ((current - previous) / Math.abs(previous)) * 100
