/**
 * Chart building blocks. Colours follow the validated categorical order in
 * index.css (--color-series-*); one y-axis per chart; tooltips on every plot;
 * legends for ≥ 2 series; text stays in ink tokens.
 */
import type { ReactNode } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '../../lib/utils'
import { formatINR, formatINRShort, formatNumber } from '../../lib/money'

export const SERIES = ['#0b8a64', '#2a78d6', '#eb6834', '#6250d6', '#eda100', '#e87ba4'] as const
const GRID = '#e8ecef'
const AXIS = '#8593a7'

interface TooltipRow {
  name: string
  value: number
  color: string
}

function TooltipBox({ title, rows, format }: { title: ReactNode; rows: TooltipRow[]; format: (v: number) => string }) {
  return (
    <div className="min-w-44 rounded-xl border border-ink-200/80 bg-white/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur">
      <div className="mb-1.5 font-semibold text-ink-900">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-600">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="num font-semibold text-ink-900">{format(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value !== undefined && <span className="num font-semibold text-ink-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  )
}

export interface TrendSeries<T> {
  key: keyof T & string
  label: string
  color: string
  type: 'area' | 'line' | 'bar'
}

/** Time-series chart (shared ₹ axis). */
export function TrendChart<T extends object>({ data, xKey, series, height = 280, formatX, money = true }: { data: T[]; xKey: keyof T & string; series: TrendSeries<T>[]; height?: number; formatX?: (v: string) => string; money?: boolean }) {
  const fmt = money ? formatINR : formatNumber
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data as unknown as Record<string, unknown>[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series
              .filter((s) => s.type === 'area')
              .map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
          <XAxis dataKey={xKey as string} tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={formatX} minTickGap={24} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v: number) => (money ? formatINRShort(v) : formatNumber(v))} width={58} />
          <Tooltip
            cursor={{ stroke: '#b1bccb', strokeDasharray: '3 3' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatX ? formatX(String(label)) : String(label)}
                  format={fmt}
                  rows={payload.map((p) => ({ name: String(series.find((s) => s.key === p.dataKey)?.label ?? p.name), value: Number(p.value), color: String(p.color ?? p.stroke) }))}
                />
              ) : null
            }
          />
          {series.map((s) =>
            s.type === 'area' ? (
              <Area key={s.key} type="monotone" dataKey={s.key as string} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            ) : s.type === 'line' ? (
              <Line key={s.key} type="monotone" dataKey={s.key as string} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            ) : (
              <Bar key={s.key} dataKey={s.key as string} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Vertical bar chart for a single measure across categories/periods. */
export function ColumnChart<T extends object>({ data, xKey, yKey, label, color = SERIES[0], height = 260, money = true }: { data: T[]; xKey: keyof T & string; yKey: keyof T & string; label: string; color?: string; height?: number; money?: boolean }) {
  const fmt = money ? formatINR : formatNumber
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as unknown as Record<string, unknown>[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey as string} tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} dy={6} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v: number) => (money ? formatINRShort(v) : formatNumber(v))} width={58} />
          <Tooltip
            cursor={{ fill: 'rgb(11 138 100 / 0.06)' }}
            content={({ active, payload, label: l }) => (active && payload?.length ? <TooltipBox title={String(l)} format={fmt} rows={[{ name: label, value: Number(payload[0].value), color }]} /> : null)}
          />
          <Bar dataKey={yKey as string} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Ranked horizontal bars rendered in HTML (crisp labels, hover detail). */
export function RankedBars({ items, color = SERIES[0], format = formatINR, secondary }: { items: { key: string; label: string; value: number; sub?: string }[]; color?: string; format?: (v: number) => string; secondary?: (item: { value: number }) => ReactNode }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((i, idx) => (
        <li key={i.key} className="group" title={`${i.label}: ${format(i.value)}${i.sub ? ` · ${i.sub}` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="num w-4 shrink-0 text-xs font-semibold text-ink-400">{idx + 1}</span>
              <span className="truncate font-medium text-ink-800">{i.label}</span>
              {i.sub && <span className="hidden shrink-0 text-xs text-ink-400 sm:inline">{i.sub}</span>}
            </span>
            <span className="num shrink-0 font-semibold text-ink-900">{secondary ? secondary(i) : format(i.value)}</span>
          </div>
          <div className="ml-6 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full transition-all duration-500 group-hover:brightness-110" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Part-to-whole as one segmented bar with a legend (≤ 6 parts). */
export function SegmentedBar({ parts, format = formatINR, height = 14 }: { parts: { label: string; value: number; color: string }[]; format?: (v: number) => string; height?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div className="@container">
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-ink-100" style={{ height }} role="img" aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}>
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div
                key={p.label}
                className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-85"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                title={`${p.label}: ${format(p.value)} (${((p.value / total) * 100).toFixed(1)}%)`}
              />
            ))}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2.5 @lg:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-ink-600">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
              {p.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="num font-semibold text-ink-900">{format(p.value)}</span>
              <span className="num w-11 text-right text-xs text-ink-400">{total > 0 ? `${((p.value / total) * 100).toFixed(0)}%` : '0%'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
