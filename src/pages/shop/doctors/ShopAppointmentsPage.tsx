import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { CalendarCheck, CalendarX, Lock, Search, Stethoscope } from 'lucide-react'
import { errorMessage, invalidate } from '../../../hooks/useQuery'
import { patientPortalService } from '../../../services'
import { CONSULTATION_TYPE_LABEL, formatSlot } from '../../../lib/clinic'
import { formatDate, todayISO } from '../../../lib/dates'
import { formatINRWhole } from '../../../lib/money'
import { cn } from '../../../lib/utils'
import type { PortalBooking } from '../../../types/clinicApi'
import { AppointmentStatusBadge, ConsultationTypeBadge } from '../../../components/clinic/ClinicBadges'
import { Button } from '../../../components/ui/Button'
import { Field, Input } from '../../../components/ui/Form'
import { Alert, EmptyState } from '../../../components/ui/Feedback'
import { ConfirmDialog } from '../../../components/ui/Modal'
import { toast } from 'sonner'
import type { PortalLookupState } from './portalUtils'

export default function ShopAppointmentsPage() {
  const state = (useLocation().state ?? {}) as PortalLookupState
  const [phone, setPhone] = useState(state.phone ?? '')
  const [dob, setDob] = useState(state.dateOfBirth ?? '')
  const [list, setList] = useState<PortalBooking[]>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState<PortalBooking>()
  const [busy, setBusy] = useState(false)
  const autoRan = useRef(false)

  const lookup = async (p = phone, d = dob) => {
    if (p.replace(/\D/g, '').length < 10 || !d) {
      setError('Enter the mobile number and date of birth you used when booking.')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      setList(await patientPortalService.myAppointments(p, d))
    } catch (err) {
      setList(undefined)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoRan.current || !state.phone || !state.dateOfBirth) return
    autoRan.current = true
    void (async () => {
      try {
        setList(await patientPortalService.myAppointments(state.phone!, state.dateOfBirth!))
      } catch (err) {
        setError(errorMessage(err))
      }
    })()
  }, [state.phone, state.dateOfBirth])

  const doCancel = async () => {
    if (!cancelling) return
    setBusy(true)
    try {
      await patientPortalService.cancel(cancelling.appointmentNo, phone, dob)
      invalidate()
      toast.success(`Appointment ${cancelling.appointmentNo} cancelled`)
      setCancelling(undefined)
      await lookup()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const today = todayISO()
  const upcoming = (list ?? []).filter((a) => a.date >= today && ['PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'].includes(a.status))
  const past = (list ?? []).filter((a) => !upcoming.includes(a))

  const Row = ({ a }: { a: PortalBooking }) => (
    <li className={cn('flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-card sm:flex-row sm:items-center', a.appointmentNo === state.highlight ? 'border-brand-300 ring-2 ring-brand-500/15' : 'border-ink-200/70')}>
      <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-ink-50 py-2 text-center">
        <span className="text-[11px] text-ink-500">{new Date(`${a.date}T00:00`).toLocaleString('en-IN', { month: 'short' })}</span>
        <span className="num font-display text-xl font-bold text-ink-900">{Number(a.date.slice(8, 10))}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-900">{a.doctorName}</span>
          <AppointmentStatusBadge status={a.status} />
        </div>
        <div className="text-[13px] text-ink-500">{a.specialization}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
          <span>
            {formatDate(a.date)} · {formatSlot(a.start)} – {formatSlot(a.end)}
          </span>
          <ConsultationTypeBadge type={a.type} />
          <span className="font-mono text-ink-400">{a.appointmentNo}</span>
        </div>
        <div className="mt-1 text-xs text-ink-500">
          {a.reason} · Fee {formatINRWhole(a.fee)}
        </div>
      </div>
      {a.canCancel && (
        <Button variant="outline" size="sm" icon={<CalendarX className="h-4 w-4" />} onClick={() => setCancelling(a)} aria-label={`Cancel appointment ${a.appointmentNo}`}>
          Cancel
        </Button>
      )}
    </li>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">My appointments</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void lookup()
        }}
        className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Mobile number">{(id) => <Input id={id} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Used when booking" />}</Field>
          <Field label="Date of birth">{(id) => <Input id={id} type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />}</Field>
          <Button type="submit" icon={<Search className="h-4 w-4" />} loading={loading}>
            Find
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-[13px] font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-400">
          <Lock className="h-3.5 w-3.5" /> In production you’ll verify with a one-time code sent to your mobile before any appointment details are shown.
        </p>
      </form>

      {list &&
        (list.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No appointments yet" action={<Link to="/shop/doctors"><Button>Book a consultation</Button></Link>} />
        ) : (
          <>
            <section>
              <h2 className="mb-3 font-display text-[15px] font-semibold text-ink-900">Upcoming</h2>
              {upcoming.length === 0 ? (
                <Alert tone="info" action={<Link to="/shop/doctors" className="text-[13px] font-semibold text-sky-800 hover:underline">Book now</Link>}>
                  You have no upcoming appointments.
                </Alert>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((a) => (
                    <Row key={a.appointmentNo} a={a} />
                  ))}
                </ul>
              )}
            </section>
            {past.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-[15px] font-semibold text-ink-900">Past & cancelled</h2>
                <ul className="space-y-3">
                  {past.map((a) => (
                    <Row key={a.appointmentNo} a={a} />
                  ))}
                </ul>
              </section>
            )}
          </>
        ))}

      {!list && !error && (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-6 text-center text-[13px] text-ink-500">
          <Stethoscope className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          Enter your details to see your bookings, or{' '}
          <Link to="/shop/doctors" className="font-semibold text-brand-700 hover:underline">
            book a new consultation
          </Link>
          .
        </div>
      )}

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(undefined)}
        onConfirm={doCancel}
        loading={busy}
        title="Cancel this appointment?"
        confirmLabel="Cancel appointment"
        message={cancelling ? `${cancelling.doctorName} on ${formatDate(cancelling.date)} at ${formatSlot(cancelling.start)} (${CONSULTATION_TYPE_LABEL[cancelling.type]}). The slot will be released for other patients.` : ''}
      />
    </div>
  )
}
