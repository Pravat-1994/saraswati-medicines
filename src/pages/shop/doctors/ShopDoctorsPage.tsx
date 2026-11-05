import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, Languages, Search, ShieldCheck, Star, Stethoscope } from 'lucide-react'
import { useQuery } from '../../../hooks/useQuery'
import { useDebounced } from '../../../hooks/useTableState'
import { patientPortalService } from '../../../services'
import { CONSULTATION_TYPE_LABEL } from '../../../lib/clinic'
import { nextAvailableLabel } from './portalUtils'
import { formatINRWhole } from '../../../lib/money'
import { cn } from '../../../lib/utils'
import type { ConsultationType } from '../../../types/clinic'
import type { DoctorListItem } from '../../../types/clinicApi'
import { PersonAvatar } from '../../../components/clinic/DoctorAvatar'
import { ConsultationTypeBadge } from '../../../components/clinic/ClinicBadges'
import { Select } from '../../../components/ui/Form'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'

function DoctorCard({ d }: { d: DoctorListItem }) {
  return (
    <Link
      to={`/shop/doctors/${d.id}`}
      className="group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised"
    >
      <div className="flex items-start gap-4">
        <PersonAvatar name={d.name} photoUrl={d.photoUrl} size="lg" online={d.online} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-semibold text-ink-950 group-hover:text-brand-800">{d.name}</h3>
          <p className="text-[13px] font-medium text-brand-700">{d.specialization}</p>
          <p className="mt-0.5 truncate text-xs text-ink-500">{d.qualifications}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span>{d.experienceYears} yrs experience</span>
            {d.rating !== undefined && d.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                <Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" aria-hidden />
                {d.rating.toFixed(1)} <span className="font-normal text-ink-400">({d.reviewCount})</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {d.consultationTypes.map((t) => (
          <ConsultationTypeBadge key={t} type={t} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <Languages className="h-3.5 w-3.5 shrink-0" /> {d.languages.join(', ')}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink-100 pt-4">
        <div>
          <div className="text-[11px] text-ink-400">Consultation fee</div>
          <div className="num font-display text-lg font-bold text-ink-950">{formatINRWhole(d.consultationFee)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-400">Next available</div>
          <div className={cn('text-[12.5px] font-semibold', d.nextAvailable ? 'text-emerald-700' : 'text-ink-400')}>{nextAvailableLabel(d)}</div>
        </div>
      </div>
    </Link>
  )
}

export default function ShopDoctorsPage() {
  const [search, setSearch] = useState('')
  const [spec, setSpec] = useState<string>()
  const [type, setType] = useState<ConsultationType | ''>('')
  const [language, setLanguage] = useState('')
  const debounced = useDebounced(search, 200)
  const doctors = useQuery(() => patientPortalService.doctors(), [], { tags: ['settings'] })

  const all = doctors.data ?? []
  const specs = [...new Set(all.map((d) => d.specialization))].sort()
  const languages = [...new Set(all.flatMap((d) => d.languages))].sort()
  const q = debounced.trim().toLowerCase()
  const list = all.filter(
    (d) =>
      (!q || `${d.name} ${d.specialization} ${d.qualifications}`.toLowerCase().includes(q)) &&
      (!spec || d.specialization === spec) &&
      (!type || d.consultationTypes.includes(type)) &&
      (!language || d.languages.includes(language)),
  )

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-800 to-ink-900 px-6 py-8 text-white shadow-raised sm:px-10">
        <div className="pointer-events-none absolute -top-16 -right-10 h-60 w-60 rounded-full bg-brand-300/20 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">Consult a doctor</h1>
          <p className="mt-2 text-sm text-violet-100/85 sm:text-base">Video, audio or in-person consultations with registered doctors. Book a slot in under a minute.</p>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctor, speciality or condition…"
              aria-label="Search doctors"
              className="h-13 w-full rounded-2xl border-0 bg-white pr-4 pl-12 text-[15px] text-ink-900 shadow-pop placeholder:text-ink-400 focus:ring-4 focus:ring-accent-300/50 focus:outline-none"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-violet-100/90">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent-300" /> Registered practitioners</span>
            <span className="flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-accent-300" /> Real-time slot availability</span>
            <span className="flex items-center gap-1.5"><Stethoscope className="h-4 w-4 text-accent-300" /> Prescriptions filled at our pharmacy</span>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Speciality">
          {[undefined, ...specs].map((s) => (
            <button
              key={s ?? 'all'}
              onClick={() => setSpec(s)}
              aria-pressed={spec === s}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition',
                spec === s ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
              )}
            >
              {s ?? 'All specialities'}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Consultation type"
            selectSize="sm"
            className="sm:w-52"
            value={type}
            onChange={(e) => setType(e.target.value as ConsultationType | '')}
            options={[{ value: '', label: 'Any consultation type' }, ...(['VIDEO', 'AUDIO', 'IN_PERSON'] as const).map((t) => ({ value: t, label: CONSULTATION_TYPE_LABEL[t] }))]}
          />
          <Select aria-label="Language" selectSize="sm" className="sm:w-52" value={language} onChange={(e) => setLanguage(e.target.value)} options={[{ value: '', label: 'Any language' }, ...languages.map((l) => ({ value: l, label: l }))]} />
        </div>
      </div>

      {doctors.error ? (
        <ErrorState message={doctors.error} onRetry={doctors.refetch} />
      ) : !doctors.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-5 w-5" />} title="No doctors match" description="Try another speciality or clear the filters." />
      ) : (
        <>
          <p className="text-[13px] text-ink-500">{list.length} doctors</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d) => (
              <DoctorCard key={d.id} d={d} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
