import { useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, CalendarClock, Languages, Plus, Star, Stethoscope } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { clinicSettingsService, doctorService } from '../../services'
import { formatSlot } from '../../lib/clinic'
import { formatShortDay, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan } from '../../stores/sessionStore'
import type { ConsultationType } from '../../types/clinic'
import type { DoctorFilters, DoctorListItem } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { ConsultationTypeBadge } from '../../components/clinic/ClinicBadges'
import { DoctorFormModal } from './DoctorFormModal'

function DoctorCard({ d }: { d: DoctorListItem }) {
  return (
    <Link to={`/doctors/${d.id}`} className="group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised">
      <div className="flex items-start gap-4">
        <PersonAvatar name={d.name} photoUrl={d.photoUrl} size="lg" online={d.online} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] font-semibold text-ink-950 group-hover:text-brand-800">{d.name}</h3>
          <p className="text-[13px] font-medium text-brand-700">{d.specialization}</p>
          <p className="truncate text-xs text-ink-500">{d.qualifications}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span>{d.experienceYears} yrs exp.</span>
            {d.reviewCount > 0 && d.rating !== undefined && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-ink-800">
                <Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" /> {d.rating.toFixed(1)}
                <span className="font-normal text-ink-400">({d.reviewCount})</span>
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
      <div className="mt-3 space-y-1 text-xs text-ink-600">
        <p className="flex items-center gap-1.5 truncate">
          <BadgeCheck className="h-3.5 w-3.5 text-ink-400" /> {d.affiliation}
        </p>
        <p className="flex items-center gap-1.5 truncate">
          <Languages className="h-3.5 w-3.5 text-ink-400" /> {d.languages.join(', ')}
        </p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-ink-100 pt-3">
        <div>
          <div className="num font-display text-lg font-bold text-ink-950">{formatINR(d.consultationFee)}</div>
          <div className="text-[11px] text-ink-400">per consultation</div>
        </div>
        <div className="text-right text-xs">
          {d.nextAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 font-medium text-brand-800">
              <CalendarClock className="h-3.5 w-3.5" />
              {d.nextAvailable.date === todayISO() ? 'Today' : formatShortDay(d.nextAvailable.date)}, {formatSlot(d.nextAvailable.start)}
            </span>
          ) : (
            <span className="text-ink-400">No slots in booking window</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function DoctorsPage() {
  const can = useCan()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<DoctorFilters>({ availability: 'ALL' })
  const [adding, setAdding] = useState(false)
  const debounced = useDebounced(search)
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const all = useQuery(() => doctorService.list({}), [], { tags: ['users'] })
  const list = useQuery(() => doctorService.list({ ...filters, search: debounced || undefined }), [debounced, JSON.stringify(filters)], { tags: ['users', 'customers'] })
  const languages = [...new Set((all.data ?? []).flatMap((d) => d.languages))].sort()
  const active = !!(search || filters.specialization || filters.language || filters.type || filters.maxFee || filters.minExperience || (filters.availability && filters.availability !== 'ALL'))
  const set = (patch: Partial<DoctorFilters>) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div>
      <PageHeader
        title="Doctor directory"
        description="Browse doctors, their specialities, fees and live availability."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Healthcare' }, { label: 'Doctors' }]}
        actions={
          can('doctors.manage') && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add doctor
            </Button>
          )
        }
      />
      <Card className="mb-5">
        <FilterBar
          className="border-b-0"
          active={active}
          onReset={() => {
            setSearch('')
            setFilters({ availability: 'ALL' })
          }}
          actions={<span className="text-xs text-ink-500">{list.data ? `${list.data.length} doctors` : ''}</span>}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search doctor, speciality or hospital" />
          <FilterSelect label="Speciality" value={filters.specialization ?? ''} onChange={(v) => set({ specialization: v || undefined })} options={(settings.data?.specializations ?? []).map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Language" value={filters.language ?? ''} onChange={(v) => set({ language: v || undefined })} options={languages.map((l) => ({ value: l, label: l }))} />
          <FilterSelect
            label="Type"
            value={filters.type ?? ''}
            onChange={(v) => set({ type: (v || undefined) as ConsultationType | undefined })}
            options={[
              { value: 'VIDEO', label: 'Video' },
              { value: 'AUDIO', label: 'Audio' },
              { value: 'IN_PERSON', label: 'In-person' },
            ]}
          />
          <FilterSelect
            label="Fee"
            allLabel="Any"
            value={filters.maxFee ? String(filters.maxFee) : ''}
            onChange={(v) => set({ maxFee: v ? Number(v) : undefined })}
            options={[400, 500, 700, 1000].map((n) => ({ value: String(n), label: `Up to ${formatINR(n).replace('.00', '')}` }))}
          />
          <FilterSelect
            label="Experience"
            allLabel="Any"
            value={filters.minExperience ? String(filters.minExperience) : ''}
            onChange={(v) => set({ minExperience: v ? Number(v) : undefined })}
            options={[5, 10, 15].map((n) => ({ value: String(n), label: `${n}+ years` }))}
          />
          <FilterSelect
            label="Availability"
            allLabel="Any"
            value={filters.availability === 'ALL' ? '' : (filters.availability ?? '')}
            onChange={(v) => set({ availability: (v || 'ALL') as DoctorFilters['availability'] })}
            options={[
              { value: 'ONLINE', label: 'Online now' },
              { value: 'TODAY', label: 'Slots today' },
            ]}
          />
        </FilterBar>
      </Card>
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : !list.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Stethoscope className="h-5 w-5" />} title="No doctors match" description="Try removing a filter." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((d) => (
            <DoctorCard key={d.id} d={d} />
          ))}
        </div>
      )}
      <DoctorFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
