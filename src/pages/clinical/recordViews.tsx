import { Activity, FileText, NotebookPen, Paperclip, Pill, Stethoscope } from 'lucide-react'
import { CLINICAL_KIND_LABEL, vitalFlags } from '../../lib/clinic'
import { formatDateTime, formatShortDay, formatTime } from '../../lib/dates'
import { cn } from '../../lib/utils'
import type { ClinicalEntry, Vitals } from '../../types/clinic'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Feedback'
import { SERIES, TrendChart } from '../../components/charts/Charts'

const VITAL_META: { key: keyof Vitals; label: string; unit: string }[] = [
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' },
  { key: 'temperatureC', label: 'Temperature', unit: '°C' },
  { key: 'respiratoryRate', label: 'Resp. rate', unit: '/min' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
]

export function VitalChips({ v }: { v: Vitals }) {
  const flags = vitalFlags(v)
  const chip = (label: string, value: string, flag?: 'high' | 'low') => (
    <span
      key={label}
      className={cn(
        'num inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ring-1 ring-inset',
        flag ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-ink-50 text-ink-700 ring-ink-200/70',
      )}
      title={flag ? `Outside usual adult range (${flag})` : undefined}
    >
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold">{value}</span>
      {flag && <span aria-label={flag === 'high' ? 'high' : 'low'}>{flag === 'high' ? '↑' : '↓'}</span>}
    </span>
  )
  const out = []
  if (v.systolic !== undefined || v.diastolic !== undefined) out.push(chip('BP', `${v.systolic ?? '–'}/${v.diastolic ?? '–'}`, flags.systolic ?? flags.diastolic))
  for (const m of VITAL_META) if (v[m.key] !== undefined) out.push(chip(m.label, `${v[m.key]} ${m.unit}`, flags[m.key]))
  return <div className="flex flex-wrap gap-1.5">{out}</div>
}

const KIND_ICON = { VITALS: Activity, MEDICATION: Pill, DOCUMENT: Paperclip, ASSESSMENT: Stethoscope, DOCTOR_NOTE: Stethoscope, TREATMENT_PLAN: FileText, PROGRESS: NotebookPen, FOLLOW_UP: FileText } as const

export function EntryItem({ e }: { e: ClinicalEntry }) {
  const Icon = KIND_ICON[e.kind]
  return (
    <li className="relative pl-12">
      <span className={cn('absolute top-0 left-0 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', e.byRole === 'Doctor' ? 'bg-brand-50 text-brand-700 ring-brand-100' : 'bg-sky-50 text-sky-700 ring-sky-100')}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[13px] font-semibold text-ink-900">{e.kind === 'VITALS' || e.kind === 'MEDICATION' ? CLINICAL_KIND_LABEL[e.kind] : e.title || CLINICAL_KIND_LABEL[e.kind]}</span>
        <span className="text-[11px] text-ink-500">
          {formatDateTime(e.at)} · {e.by} <span className="text-ink-400">({e.byRole})</span>
        </span>
      </div>
      {e.kind !== 'VITALS' && e.kind !== 'MEDICATION' && e.title && e.title !== CLINICAL_KIND_LABEL[e.kind] && <div className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{CLINICAL_KIND_LABEL[e.kind]}</div>}
      <div className="mt-1.5">
        {e.vitals && <VitalChips v={e.vitals} />}
        {e.medication && (
          <p className="text-[13px] text-ink-700">
            <span className="font-medium text-ink-900">{e.medication.name}</span> · {e.medication.dose} · {e.medication.route} · given {formatTime(e.medication.givenAt)}
          </p>
        )}
        {e.file && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-2 py-1 text-xs text-ink-700">
            <Paperclip className="h-3.5 w-3.5" /> {e.file.name} · {(e.file.size / 1024).toFixed(0)} KB
          </p>
        )}
        {e.text && <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink-700">{e.text}</p>}
      </div>
    </li>
  )
}

export function EntryList({ entries, empty }: { entries: ClinicalEntry[]; empty: string }) {
  if (entries.length === 0) return <EmptyState compact title={empty} />
  return <ol className="space-y-5">{entries.map((e) => <EntryItem key={e.id} e={e} />)}</ol>
}

export function VitalsPanel({ entries }: { entries: ClinicalEntry[] }) {
  const readings = entries.filter((e) => e.kind === 'VITALS' && e.vitals).sort((a, b) => a.at.localeCompare(b.at))
  if (readings.length === 0) return <Card><EmptyState title="No vital signs recorded" description="Use Add entry → Record vitals." /></Card>
  const latest = readings[readings.length - 1]
  const points = readings.map((r) => ({ at: r.at, ...r.vitals }))
  const label = (iso: string) => `${formatShortDay(iso.slice(0, 10))} ${formatTime(iso)}`
  const fmtX = (iso: string) => label(iso)
  const charts: { title: string; unit: string; series: { key: keyof Vitals; label: string; color: string }[] }[] = [
    { title: 'Blood pressure', unit: 'mmHg', series: [{ key: 'systolic', label: 'Systolic', color: SERIES[2] }, { key: 'diastolic', label: 'Diastolic', color: SERIES[1] }] },
    { title: 'Heart rate', unit: 'bpm', series: [{ key: 'heartRate', label: 'Heart rate', color: SERIES[0] }] },
    { title: 'Temperature', unit: '°C', series: [{ key: 'temperatureC', label: 'Temperature', color: SERIES[3] }] },
    { title: 'SpO₂', unit: '%', series: [{ key: 'spo2', label: 'SpO₂', color: SERIES[1] }] },
    { title: 'Respiratory rate', unit: '/min', series: [{ key: 'respiratoryRate', label: 'Resp. rate', color: SERIES[0] }] },
  ]
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Latest reading" description={`${formatDateTime(latest.at)} · ${latest.by}`} />
        <CardBody>
          <VitalChips v={latest.vitals!} />
          <p className="mt-3 text-[11px] text-ink-400">↑/↓ marks values outside common adult reference ranges. This is a display aid only — clinical interpretation is the responsibility of the treating clinician.</p>
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((c) => {
          const data = points.filter((p) => c.series.some((s) => p[s.key] !== undefined))
          return (
            <Card key={c.title}>
              <CardHeader title={c.title} description={`${c.unit} · ${data.length} readings`} action={c.series.length > 1 ? <span className="flex gap-3 text-xs text-ink-600">{c.series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />{s.label}</span>)}</span> : undefined} />
              <CardBody>
                {data.length < 2 ? (
                  <p className="py-8 text-center text-xs text-ink-400">Need at least two readings to show a trend.</p>
                ) : (
                  <TrendChart data={data} xKey="at" formatX={fmtX} money={false} height={180} series={c.series.map((s) => ({ key: s.key as never, label: s.label, color: s.color, type: 'line' as const }))} />
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>
      <Card>
        <CardHeader title="All readings" />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-ink-50/80 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-3 py-2 text-right">BP</th>
                {VITAL_META.map((m) => (
                  <th key={m.key} className="px-3 py-2 text-right">
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {[...readings].reverse().map((r) => {
                const f = vitalFlags(r.vitals!)
                return (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(r.at)}</td>
                    <td className={cn('num px-3 py-2 text-right', (f.systolic || f.diastolic) && 'font-semibold text-amber-700')}>{r.vitals!.systolic !== undefined ? `${r.vitals!.systolic}/${r.vitals!.diastolic ?? '–'}` : '—'}</td>
                    {VITAL_META.map((m) => (
                      <td key={m.key} className={cn('num px-3 py-2 text-right', f[m.key] && 'font-semibold text-amber-700')}>
                        {r.vitals![m.key] ?? '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-ink-600">{r.by}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
