import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, CircleDashed, FileSignature, LogOut, Printer, ReceiptIndianRupee, Save } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { admissionService, dischargeService } from '../../services'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { ACTIVE_ADMISSION } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import type { AdmissionDetail } from '../../types/clinicApi'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { AdmissionStatusBadge, DischargeStatusBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { PrintPortal } from '../billing/PrintPortal'
import { DischargeSummaryDocument } from './DischargeSummaryDocument'

const schema = z.object({
  finalDiagnosis: z.string().trim().min(3, 'Enter the final diagnosis').max(400),
  treatmentSummary: z.string().trim().min(10, 'Summarise the treatment given').max(3000),
  medicationInstructions: z.string().trim().min(3, 'Enter medication instructions').max(2000),
  followUp: z.string().trim().min(3, 'Enter follow-up advice').max(1000),
  followUpDate: z.string().optional(),
})
type Form = z.infer<typeof schema>

function Step({ done, active, title, children }: { done: boolean; active?: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-brand-600 text-white' : active ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-400')}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className={cn('text-[13px] font-semibold', done ? 'text-ink-900' : 'text-ink-600')}>{title}</div>
        {children && <div className="mt-1 text-xs text-ink-500">{children}</div>}
      </div>
    </li>
  )
}

function SummaryForm({ detail, onSaved }: { detail: AdmissionDetail; onSaved: () => void }) {
  const can = useCan()
  const isDoctor = useSessionStore((s) => s.user?.roleId === 'DOCTOR')
  const a = detail.admission
  const s = a.discharge
  const editable = can('discharge.approve') && isDoctor && (s.status === 'REQUESTED' || s.status === 'UNDER_REVIEW')
  const [confirm, setConfirm] = useState<Form | null>(null)
  const { register, handleSubmit, getValues, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { finalDiagnosis: s.finalDiagnosis ?? a.diagnosis, treatmentSummary: s.treatmentSummary ?? '', medicationInstructions: s.medicationInstructions ?? '', followUp: s.followUp ?? '', followUpDate: s.followUpDate ?? '' },
  })
  const e = formState.errors
  const input = (v: Form) => ({ ...v, followUpDate: v.followUpDate || undefined })
  const saveDraft = useMutation(() => dischargeService.saveSummary(a.id, input(getValues())), { successMessage: 'Discharge summary saved (under review)', onSuccess: onSaved })
  const approve = useMutation((v: Form) => dischargeService.approve(a.id, input(v)), {
    successMessage: 'Discharge approved',
    onSuccess: () => {
      setConfirm(null)
      onSaved()
    },
  })
  const field = (name: keyof Form, label: string, rows: number) => (
    <Field label={label} required={name !== 'followUpDate'} error={e[name]?.message}>
      {(id) => <Textarea id={id} rows={rows} disabled={!editable} invalid={!!e[name]} {...register(name)} />}
    </Field>
  )
  return (
    <div className="space-y-4">
      {!editable && s.status !== 'APPROVED' && s.status !== 'COMPLETED' && (
        <Alert tone="info">Only the treating doctor (Doctor role) can write and approve the clinical discharge summary.</Alert>
      )}
      {field('finalDiagnosis', 'Final diagnosis', 2)}
      {field('treatmentSummary', 'Treatment summary', 4)}
      {field('medicationInstructions', 'Medication instructions', 3)}
      {field('followUp', 'Follow-up advice', 2)}
      <Field label="Follow-up date">{(id) => <Input id={id} type="date" disabled={!editable} {...register('followUpDate')} />}</Field>
      {editable && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" icon={<Save className="h-4 w-4" />} loading={saveDraft.pending} onClick={() => saveDraft.run()}>
            Save draft
          </Button>
          <Button icon={<FileSignature className="h-4 w-4" />} onClick={handleSubmit((v) => setConfirm(v))}>
            Approve discharge
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && approve.run(confirm)}
        loading={approve.pending}
        tone="primary"
        title="Approve clinical discharge?"
        confirmLabel="Sign & approve"
        message="This is your clinical sign-off as the treating doctor. The summary will be locked and recorded with your name and the time of approval. Billing can then generate the final bill."
      />
    </div>
  )
}

export function DischargeWorkspace({ admissionId, onClose }: { admissionId: string; onClose: () => void }) {
  const can = useCan()
  const q = useQuery(() => admissionService.get(admissionId), [admissionId], { tags: ['customers'] })
  const [printing, setPrinting] = useState(false)
  const [completedBed, setCompletedBed] = useState<string>()
  const stopPrint = useCallback(() => setPrinting(false), [])
  const request = useMutation(() => dischargeService.request(admissionId), { successMessage: 'Discharge requested' })
  const complete = useMutation(() => dischargeService.complete(admissionId), { onSuccess: (a) => setCompletedBed(a.bedLabel ?? 'the bed') })

  const d = q.data
  const a = d?.admission
  const s = a?.discharge
  const acc = d?.account
  const settled = acc ? acc.status === 'SETTLED' : true
  const canComplete = s?.status === 'APPROVED' && settled

  return (
    <Modal open onClose={onClose} drawer size="xl" title={a ? `Discharge · ${a.patientName}` : 'Discharge'} description={a ? `${a.admissionNo} · Bed ${a.bedLabel ?? '—'}` : undefined} icon={<LogOut className="h-4 w-4" />}>
      {q.error ? (
        <ErrorState message={q.error} onRetry={q.refetch} />
      ) : !d || !a || !s ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {completedBed && (
            <Alert tone="success" icon={<CheckCircle2 className="h-4 w-4" />} title="Discharge completed">
              {a.patientName} has been discharged and bed {completedBed} is now available.
            </Alert>
          )}
          <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-ink-200/70 bg-ink-50/50 p-4">
            <PersonAvatar name={a.patientName} />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/admissions/${a.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                  {a.patientName}
                </Link>
                <AdmissionStatusBadge status={a.status} />
                <DischargeStatusBadge status={s.status} />
              </div>
              <div className="mt-1 text-ink-500">
                {a.patientCode} · {a.patientAge} yrs · {a.department} · {a.doctorName}
              </div>
              <div className="mt-1 text-ink-600">
                Admitted {formatDateTime(a.admittedAt)} · {a.lengthOfStayDays ?? '—'} day(s) · {a.diagnosis}
              </div>
              {d.patient.allergies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.patient.allergies.map((x) => (
                    <Badge key={x} tone="danger">
                      Allergy: {x}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => setPrinting(true)}>
              Print summary
            </Button>
          </div>

          <ol className="relative">
            <Step done={s.status !== 'NOT_REQUESTED'} active={s.status === 'NOT_REQUESTED'} title="Discharge requested">
              {s.requestedAt ? `${s.requestedBy} · ${formatDateTime(s.requestedAt)}` : 'Not requested yet'}
            </Step>
            <Step done={['APPROVED', 'COMPLETED'].includes(s.status)} active={['REQUESTED', 'UNDER_REVIEW'].includes(s.status)} title="Clinical summary approved by doctor">
              {s.approvedBy ? `${s.approvedBy} · ${formatDateTime(s.approvedAt)}` : s.status === 'UNDER_REVIEW' ? 'Summary drafted — awaiting approval' : 'Awaiting doctor'}
            </Step>
            <Step done={settled} active={s.status === 'APPROVED' && !settled} title="Final bill settled">
              {acc ? `${acc.billNo ? `Bill ${acc.billNo} · ` : ''}${acc.status.toLowerCase()} · balance ${formatINR(acc.totals.balance)}` : can('billing.view') ? 'No patient account' : 'Billing details are restricted for your role'}
            </Step>
            <Step done={s.status === 'COMPLETED'} active={canComplete} title="Discharge completed & bed released">
              {s.completedAt ? `${s.completedBy} · ${formatDateTime(s.completedAt)}` : undefined}
            </Step>
          </ol>

          {s.status === 'NOT_REQUESTED' && ACTIVE_ADMISSION.includes(a.status) && (
            <Alert
              tone="info"
              title="Discharge not requested yet"
              action={
                can('discharge.request') ? (
                  <Button size="sm" loading={request.pending} onClick={() => request.run()}>
                    Request discharge
                  </Button>
                ) : undefined
              }
            >
              {can('discharge.request') ? 'Request discharge to start the clinical summary and billing steps.' : 'A doctor or nurse can request discharge.'}
            </Alert>
          )}

          {s.status !== 'NOT_REQUESTED' && (
            <section>
              <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Discharge summary</h3>
              <SummaryForm key={`${s.status}-${s.approvedAt ?? ''}`} detail={d} onSaved={q.refetch} />
            </section>
          )}

          {acc && (
            <section className="rounded-2xl border border-ink-200/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink-900">
                  <ReceiptIndianRupee className="h-4 w-4 text-brand-600" /> Billing — {acc.accountNo}
                </h3>
                <Link to={`/billing/${acc.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                  Open bill →
                </Link>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                {[
                  ['Net charges', formatINR(acc.totals.net)],
                  ['Paid', formatINR(acc.totals.paid - acc.totals.refunded)],
                  ['Balance', formatINR(acc.totals.balance)],
                  ['Accrued room (not posted)', acc.accruedRoom ? `${formatINR(acc.accruedRoom.amount)} · ${acc.accruedRoom.nights} night(s)` : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-ink-500">{k}</dt>
                    <dd className="num font-semibold text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {s.status !== 'COMPLETED' && s.status !== 'NOT_REQUESTED' && (
            <div className="flex flex-col items-stretch gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-500">
                {canComplete
                  ? 'Everything is ready. Completing the discharge releases the bed.'
                  : s.status !== 'APPROVED'
                    ? 'Waiting for the doctor to approve the discharge summary.'
                    : 'Generate the final bill and settle the balance before completing discharge.'}
              </p>
              {can('admissions.manage') && (
                <Button icon={<LogOut className="h-4 w-4" />} disabled={!canComplete} loading={complete.pending} onClick={() => complete.run()}>
                  Complete discharge
                </Button>
              )}
            </div>
          )}

          {s.followUpDate && <p className="text-xs text-ink-500">Follow-up on {formatDate(s.followUpDate)}</p>}
        </div>
      )}
      {printing && d && (
        <PrintPortal onDone={stopPrint}>
          <DischargeSummaryDocument detail={d} />
        </PrintPortal>
      )}
    </Modal>
  )
}
