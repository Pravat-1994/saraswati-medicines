import { vitalFlags } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import type { Vitals } from '../../types/clinic'

/** Compact vital-signs tiles; out-of-range readings are flagged (display aid only). */
export function VitalsGrid({ vitals, compact }: { vitals: Vitals; compact?: boolean }) {
  const flags = vitalFlags(vitals)
  const items: { key: keyof Vitals | 'bp'; label: string; value?: string; flag?: 'high' | 'low' }[] = [
    { key: 'bp', label: 'Blood pressure', value: vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic} mmHg` : undefined, flag: flags.systolic ?? flags.diastolic },
    { key: 'heartRate', label: 'Heart rate', value: vitals.heartRate ? `${vitals.heartRate} bpm` : undefined, flag: flags.heartRate },
    { key: 'temperatureC', label: 'Temperature', value: vitals.temperatureC ? `${vitals.temperatureC.toFixed(1)} °C` : undefined, flag: flags.temperatureC },
    { key: 'respiratoryRate', label: 'Resp. rate', value: vitals.respiratoryRate ? `${vitals.respiratoryRate} /min` : undefined, flag: flags.respiratoryRate },
    { key: 'spo2', label: 'SpO₂', value: vitals.spo2 ? `${vitals.spo2}%` : undefined, flag: flags.spo2 },
    { key: 'weightKg', label: 'Weight', value: vitals.weightKg ? `${vitals.weightKg} kg` : undefined },
  ]
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
      {items
        .filter((i) => i.value)
        .map((i) => (
          <div key={i.key} className={cn('rounded-xl border px-3 py-2', i.flag ? 'border-amber-200 bg-amber-50/70' : 'border-ink-100 bg-ink-50/60')}>
            <div className="text-[11px] text-ink-500">{i.label}</div>
            <div className="num flex items-center gap-1 text-sm font-semibold text-ink-900">
              {i.value}
              {i.flag && <span className="text-[10px] font-semibold text-amber-700 uppercase">{i.flag}</span>}
            </div>
          </div>
        ))}
    </div>
  )
}
