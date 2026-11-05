import { useEffect, useRef, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { patientService } from '../../services'
import { maskPhone } from '../../lib/clinic'
import type { PatientListItem } from '../../types/clinicApi'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { PersonAvatar } from './DoctorAvatar'

/** Search-and-select a registered patient (name, patient ID or phone). */
export function PatientPicker({ value, onChange, onRegisterNew, invalid, placeholder = 'Search by name, patient ID or mobile' }: { value?: PatientListItem; onChange: (p?: PatientListItem) => void; onRegisterNew?: () => void; invalid?: boolean; placeholder?: string }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(term, 150)
  const wrap = useRef<HTMLDivElement>(null)
  const results = useQuery(() => patientService.search(debounced), [debounced], { enabled: open && debounced.trim().length > 0, tags: ['customers'] })

  useEffect(() => {
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
        <PersonAvatar name={value.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink-900">{value.name}</div>
          <div className="truncate text-xs text-ink-500">
            {value.patientCode} · {value.age} yrs · {value.gender.toLowerCase()} · {maskPhone(value.phone)}
          </div>
        </div>
        {value.allergies.length > 0 && <Badge tone="danger">Allergies</Badge>}
        <button type="button" onClick={() => onChange(undefined)} className="rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-ink-700" aria-label="Change patient">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={wrap}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Find patient"
            aria-invalid={invalid || undefined}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white pr-3 pl-9 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none aria-[invalid=true]:border-red-400"
          />
        </div>
        {onRegisterNew && (
          <Button type="button" variant="outline" icon={<UserPlus className="h-4 w-4" />} onClick={onRegisterNew}>
            New
          </Button>
        )}
      </div>
      {open && debounced.trim().length > 0 && (
        <div className="absolute z-40 mt-1.5 w-full animate-pop-in overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
          <ul className="max-h-72 overflow-y-auto p-1">
            {(results.data ?? []).slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p)
                    setTerm('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50"
                >
                  <PersonAvatar name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{p.name}</span>
                    <span className="block truncate text-[11px] text-ink-500">
                      {p.patientCode} · {p.age} yrs · {maskPhone(p.phone)}
                    </span>
                  </span>
                  {p.activeAdmission && <Badge tone="violet">Inpatient</Badge>}
                </button>
              </li>
            ))}
            {results.data && results.data.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-500">No patients found{onRegisterNew ? ' — register a new patient' : ''}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
