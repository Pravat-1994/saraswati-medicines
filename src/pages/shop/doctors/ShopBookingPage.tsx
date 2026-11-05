import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Building2, CalendarCheck, CheckCircle2, Clock, FileText, Languages, Mic, Paperclip, ShieldCheck, Star, User, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../../hooks/useQuery'
import { clinicSettingsService, patientPortalService } from '../../../services'
import { CONSULTATION_TYPE_LABEL, DAY_NAMES, formatSlot, nextDays } from '../../../lib/clinic'
import { formatDate, parseISODate, todayISO } from '../../../lib/dates'
import { formatINRWhole } from '../../../lib/money'
import { cn } from '../../../lib/utils'
import { ServiceError } from '../../../types/api'
import type { ConsultationType, Gender } from '../../../types/clinic'
import type { PortalBooking } from '../../../types/clinicApi'
import { PersonAvatar } from '../../../components/clinic/DoctorAvatar'
import { Button } from '../../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../../components/ui/Form'
import { Alert, EmptyState, ErrorState, PageLoader, Skeleton } from '../../../components/ui/Feedback'
import { ACCEPTED_REPORT_TYPES, formatBytes, type PortalLookupState } from './portalUtils'

const TYPE_ICON: Record<ConsultationType, typeof Video> = { VIDEO: Video, AUDIO: Mic, IN_PERSON: User }
const TYPE_HINT: Record<ConsultationType, string> = { VIDEO: 'Join from your phone or laptop', AUDIO: 'The doctor calls you', IN_PERSON: 'Visit the clinic' }

const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: z.string().trim().refine((v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid 10-digit Indian mobile number'),
  dateOfBirth: z.string().min(1, 'Enter your date of birth').refine((v) => v <= todayISO() && v >= '1900-01-01', 'Enter a valid date of birth'),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER'], { message: 'Select an option' }),
  email: z.string().trim().regex(/^([^\s@]+@[^\s@]+\.[^\s@]{2,})?$/, 'Enter a valid email').optional(),
  reason: z.string().trim().min(3, 'Tell the doctor why you are consulting').max(200),
  symptoms: z.string().trim().max(500).optional(),
})
type Details = z.infer<typeof detailsSchema>

interface ReportFile {
  name: string
  size: number
  type: string
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-[15px] font-semibold text-ink-900">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-emerald-600 text-white' : 'bg-ink-900 text-white')}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function ShopBookingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const doctors = useQuery(() => patientPortalService.doctors(), [], { tags: ['settings'] })
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const doctor = doctors.data?.find((d) => d.id === id)
  const [type, setType] = useState<ConsultationType>()
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState<string>()
  const [reports, setReports] = useState<ReportFile[]>([])
  const [fileError, setFileError] = useState<string>()
  const [booked, setBooked] = useState<{ booking: PortalBooking; phone: string; dateOfBirth: string }>()
  const effectiveType = type ?? doctor?.consultationTypes[0]
  const days = useMemo(() => nextDays(settings.data?.bookingWindowDays ?? 14), [settings.data?.bookingWindowDays])
  const slots = useQuery(() => patientPortalService.slots(id!, date), [id, date], { enabled: !!doctor, tags: ['customers'] })
  const slot = slots.data?.find((s) => s.start === start)

  const form = useForm<Details>({ resolver: zodResolver(detailsSchema), mode: 'onTouched', defaultValues: { name: '', phone: '', dateOfBirth: '', gender: undefined, email: '', reason: '', symptoms: '' } })
  const { register, handleSubmit, formState } = form
  const errors = formState.errors

  const maxMb = settings.data?.maxReportSizeMb ?? 10
  const addFiles = (list: FileList | null) => {
    setFileError(undefined)
    const next = [...reports]
    for (const f of Array.from(list ?? [])) {
      if (!ACCEPTED_REPORT_TYPES.includes(f.type)) {
        setFileError(`${f.name}: only PDF or image files are accepted.`)
        continue
      }
      if (f.size > maxMb * 1024 * 1024) {
        setFileError(`${f.name} is larger than ${maxMb} MB.`)
        continue
      }
      if (next.length >= 5) {
        setFileError('You can attach up to 5 reports.')
        break
      }
      next.push({ name: f.name, size: f.size, type: f.type })
    }
    setReports(next)
  }

  const onSubmit = async (v: Details) => {
    if (!doctor || !effectiveType || !start) {
      toast.error('Choose a consultation type, date and time slot first.')
      return
    }
    try {
      const booking = await patientPortalService.book(
        { name: v.name, phone: v.phone, dateOfBirth: v.dateOfBirth, gender: v.gender as Gender, email: v.email || undefined },
        { doctorId: doctor.id, type: effectiveType, date, start, reason: v.reason, symptoms: v.symptoms || undefined, reports },
      )
      invalidate()
      setBooked({ booking, phone: v.phone, dateOfBirth: v.dateOfBirth })
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err instanceof ServiceError && err.code === 'SLOT_TAKEN') {
        toast.error('That slot was just taken — please pick another time.')
        setStart(undefined)
        slots.refetch()
        return
      }
      toast.error(errorMessage(err))
    }
  }

  if (doctors.error) return <ErrorState message={doctors.error} onRetry={doctors.refetch} />
  if (!doctors.data) return <PageLoader />
  if (!doctor) {
    return (
      <div className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
        <h1 className="sr-only">Doctor not found</h1>
        <EmptyState title="Doctor not found" description="This doctor may no longer be taking appointments." action={<Link to="/shop/doctors"><Button>See all doctors</Button></Link>} />
      </div>
    )
  }

  if (booked) {
    const b = booked.booking
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-card sm:p-8">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">Appointment requested</h1>
          <p className="mt-1 text-sm text-ink-600">The clinic will confirm your appointment shortly. We’ll contact you on your mobile number.</p>
          <dl className="mt-6 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-500">Appointment no.</dt>
              <dd className="font-mono font-semibold text-ink-900">{b.appointmentNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Patient ID</dt>
              <dd className="font-mono font-semibold text-ink-900">{b.patientCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Doctor</dt>
              <dd className="font-medium text-ink-900">{b.doctorName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">When</dt>
              <dd className="font-medium text-ink-900">
                {formatDate(b.date)}, {formatSlot(b.start)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Type</dt>
              <dd className="font-medium text-ink-900">{CONSULTATION_TYPE_LABEL[b.type]}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Status</dt>
              <dd className="font-medium text-amber-700">Pending confirmation</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-500">Fee {formatINRWhole(b.fee)} — payable at the clinic or when you join the consultation.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => navigate('/shop/appointments', { state: { phone: booked.phone, dateOfBirth: booked.dateOfBirth, highlight: b.appointmentNo } satisfies PortalLookupState })} icon={<CalendarCheck className="h-4 w-4" />}>
              View my appointments
            </Button>
            <Link to="/shop/doctors">
              <Button variant="outline" className="w-full">
                Book another
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link to="/shop/doctors" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> All doctors
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <PersonAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="xl" online={doctor.online} />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">{doctor.name}</h1>
                <p className="text-sm font-medium text-brand-700">{doctor.specialization}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">{doctor.qualifications}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
                  <span>{doctor.experienceYears} years experience</span>
                  <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-ink-400" /> {doctor.languages.join(', ')}</span>
                  <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-ink-400" /> {doctor.affiliation}</span>
                  {doctor.reviewCount > 0 && doctor.rating !== undefined && (
                    <span className="flex items-center gap-1 font-medium text-ink-800"><Star className="h-4 w-4 fill-accent-400 text-accent-400" /> {doctor.rating.toFixed(1)} <span className="font-normal text-ink-500">({doctor.reviewCount} reviews)</span></span>
                  )}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-600">{doctor.bio}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Reg. {doctor.registrationNo} · {doctor.registrationCouncil}
                </p>
              </div>
            </div>
          </section>

          <Step n={1} title="Consultation type" done={!!effectiveType}>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Consultation type">
              {doctor.consultationTypes.map((t) => {
                const Icon = TYPE_ICON[t]
                const active = effectiveType === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(t)}
                    className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-left transition', active ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15' : 'border-ink-200 hover:border-ink-300')}
                  >
                    <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', active ? 'text-brand-700' : 'text-ink-400')} />
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">{CONSULTATION_TYPE_LABEL[t]}</span>
                      <span className="block text-xs text-ink-500">{TYPE_HINT[t]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Step>

          <Step n={2} title="Date & time" done={!!slot?.available}>
            <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Choose a date">
              {days.map((d) => {
                const dt = parseISODate(d)
                const active = d === date
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDate(d)
                      setStart(undefined)
                    }}
                    className={cn('flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition', active ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300')}
                  >
                    <span className={cn('text-[11px] font-medium', active ? 'text-brand-100' : 'text-ink-400')}>{d === todayISO() ? 'Today' : DAY_NAMES[dt.getDay()]}</span>
                    <span className="num font-display text-lg font-bold">{dt.getDate()}</span>
                    <span className={cn('text-[10px]', active ? 'text-brand-100' : 'text-ink-400')}>{dt.toLocaleString('en-IN', { month: 'short' })}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              {slots.loading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : slots.error ? (
                <ErrorState message={slots.error} onRetry={slots.refetch} />
              ) : !slots.data || slots.data.length === 0 ? (
                <p className="rounded-xl bg-ink-50 px-4 py-6 text-center text-[13px] text-ink-500">The doctor is not available on this day — try another date.</p>
              ) : slots.data.every((s) => !s.available) ? (
                <p className="rounded-xl bg-ink-50 px-4 py-6 text-center text-[13px] text-ink-500">All slots for this day are booked or have passed — try another date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Time slot">
                  {slots.data.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      role="radio"
                      aria-checked={start === s.start}
                      disabled={!s.available}
                      onClick={() => setStart(s.start)}
                      title={s.available ? undefined : s.reason === 'BOOKED' ? 'Already booked' : 'Time has passed'}
                      className={cn(
                        'num h-10 rounded-lg border text-[13px] font-medium transition disabled:cursor-not-allowed',
                        start === s.start ? 'border-brand-600 bg-brand-600 text-white' : s.available ? 'border-ink-200 bg-white text-ink-800 hover:border-brand-300 hover:bg-brand-50' : 'border-ink-100 bg-ink-50 text-ink-300 line-through',
                      )}
                    >
                      {formatSlot(s.start)}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3.5 w-3.5" /> {doctor.slotMinutes}-minute consultation
              </p>
            </div>
          </Step>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5" id="booking-form">
            <Step n={3} title="Patient details">
              <p className="mb-4 text-[13px] text-ink-500">Your mobile number and date of birth identify you as a returning patient — we ask for nothing more than needed to book.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={errors.name?.message}>
                  {(fid) => <Input id={fid} autoComplete="name" invalid={!!errors.name} {...register('name')} />}
                </Field>
                <Field label="Mobile number" required error={errors.phone?.message}>
                  {(fid) => <Input id={fid} inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" invalid={!!errors.phone} {...register('phone')} />}
                </Field>
                <Field label="Date of birth" required error={errors.dateOfBirth?.message}>
                  {(fid) => <Input id={fid} type="date" max={todayISO()} invalid={!!errors.dateOfBirth} {...register('dateOfBirth')} />}
                </Field>
                <Field label="Gender" required error={errors.gender?.message}>
                  {(fid) => (
                    <Select
                      id={fid}
                      invalid={!!errors.gender}
                      placeholder="Select"
                      options={[
                        { value: 'FEMALE', label: 'Female' },
                        { value: 'MALE', label: 'Male' },
                        { value: 'OTHER', label: 'Other / prefer to self-describe' },
                      ]}
                      {...register('gender')}
                    />
                  )}
                </Field>
                <Field label="Email" hint="Optional — for appointment updates" error={errors.email?.message} className="sm:col-span-2">
                  {(fid) => <Input id={fid} type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />}
                </Field>
              </div>
            </Step>

            <Step n={4} title="Reason for consultation">
              <div className="grid gap-4">
                <Field label="Reason" required error={errors.reason?.message}>
                  {(fid) => <Input id={fid} placeholder="e.g. Fever for 3 days, follow-up for diabetes" invalid={!!errors.reason} {...register('reason')} />}
                </Field>
                <Field label="Symptoms" hint="Optional — when they started, anything that makes them better or worse">
                  {(fid) => <Textarea id={fid} rows={3} {...register('symptoms')} />}
                </Field>
                <Field label="Medical reports" hint={`Optional · PDF or images · up to ${maxMb} MB each`} error={fileError}>
                  {(fid) => (
                    <div className="space-y-2">
                      <label htmlFor={fid} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-4 py-3 text-[13px] text-ink-600 hover:border-brand-400 hover:bg-brand-50/40">
                        <Paperclip className="h-4 w-4 text-brand-600" />
                        <span className="flex-1">Attach lab reports, X-rays or previous prescriptions</span>
                        <input id={fid} type="file" multiple accept={ACCEPTED_REPORT_TYPES.join(',')} className="sr-only" onChange={(e) => {
                          addFiles(e.target.files)
                          e.target.value = ''
                        }} />
                      </label>
                      {reports.length > 0 && (
                        <ul className="space-y-1.5">
                          {reports.map((r, i) => (
                            <li key={`${r.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-[13px]">
                              <FileText className="h-4 w-4 text-ink-400" />
                              <span className="flex-1 truncate">{r.name}</span>
                              <span className="text-xs text-ink-400">{formatBytes(r.size)}</span>
                              <button type="button" onClick={() => setReports(reports.filter((_, j) => j !== i))} className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${r.name}`}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[11px] text-ink-400">Demo mode records file names only. Once connected to Decisions, reports are uploaded securely and shared only with your doctor.</p>
                    </div>
                  )}
                </Field>
              </div>
            </Step>
          </form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
            <h2 className="border-b border-ink-100 px-5 py-4 font-display text-[15px] font-semibold text-ink-900">Review & confirm</h2>
            <dl className="space-y-3 px-5 py-4 text-[13px]">
              <div className="flex items-center gap-3">
                <PersonAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="sm" />
                <div>
                  <dt className="sr-only">Doctor</dt>
                  <dd className="font-semibold text-ink-900">{doctor.name}</dd>
                  <dd className="text-xs text-ink-500">{doctor.specialization}</dd>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Type</dt>
                <dd className="font-medium text-ink-900">{effectiveType ? CONSULTATION_TYPE_LABEL[effectiveType] : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Date</dt>
                <dd className="font-medium text-ink-900">{formatDate(date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Time</dt>
                <dd className={cn('font-medium', slot ? 'text-ink-900' : 'text-amber-700')}>{slot ? `${formatSlot(slot.start)} – ${formatSlot(slot.end)}` : 'Choose a slot'}</dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-ink-100 pt-3">
                <dt className="text-ink-600">Consultation fee</dt>
                <dd className="num font-display text-2xl font-bold text-ink-950">{formatINRWhole(doctor.consultationFee)}</dd>
              </div>
            </dl>
            <div className="space-y-3 border-t border-ink-100 px-5 py-4">
              <p className="text-[11px] leading-relaxed text-ink-500">Pay at the clinic, or when you join an online consultation. Your booking is pending until the clinic confirms it.</p>
              {!slot && <Alert tone="info">Pick a time slot to continue.</Alert>}
              <Button type="submit" form="booking-form" size="lg" className="w-full" disabled={!slot || !effectiveType} loading={formState.isSubmitting}>
                Confirm appointment
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
