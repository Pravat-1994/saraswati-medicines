import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowRightLeft, BedDouble, Ban, Check, CheckCircle2, ClipboardList, FileHeart, LogOut, ReceiptIndianRupee, ShieldAlert, UserCheck } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { admissionService, bedService, dischargeService, roomService } from '../../services'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { ADMISSION_TYPE_LABEL, CLINICAL_KIND_LABEL, ROOM_TYPE_LABEL } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { useCan } from '../../stores/sessionStore'
import type { AdmissionStatus } from '../../types/clinic'
import type { AdmissionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { Field, Textarea } from '../../components/ui/Form'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { AdmissionStatusBadge, DischargeStatusBadge, FulfilmentBadge } from '../../components/clinic/ClinicBadges'
import { BedGrid, BedPickerModal } from './BedPicker'
import { VitalsGrid } from '../patients/VitalsGrid'

const STEPS = ['Find / register patient', 'Admission request', 'Reason recorded', 'Doctor assigned', 'Bed availability', 'Bed allocated', 'Admission confirmed', 'Inpatient record', 'Treatment & progress', 'Discharge']

/** Index of the current (in-progress) step; steps before it are complete. */
function currentStep(a: AdmissionView): number {
  const s: Record<AdmissionStatus, number> = { REQUESTED: 4, APPROVED: a.bedId ? 6 : 5, ADMITTED: 8, UNDER_TREATMENT: 8, DISCHARGE_REQUESTED: 9, DISCHARGED: 10, CANCELLED: -1 }
  return s[a.status]
}

function Stepper({ a }: { a: AdmissionView }) {
  const cur = currentStep(a)
  return (
    <ol className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1" aria-label="Admission workflow">
      {STEPS.map((label, i) => {
        const done = cur === 10 || i < cur
        const active = i === cur
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className={cn('flex min-w-[118px] flex-1 flex-col gap-1.5 rounded-xl border px-2.5 py-2', done ? 'border-brand-200 bg-brand-50/60' : active ? 'border-accent-300 bg-accent-50 ring-2 ring-accent-300/30' : 'border-ink-200 bg-white')}>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', done ? 'bg-brand-600 text-white' : active ? 'bg-accent-400 text-ink-950' : 'bg-ink-100 text-ink-500')}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
            <span className={cn('text-[11.5px] leading-tight font-medium', done ? 'text-ink-800' : active ? 'text-ink-950' : 'text-ink-400')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function AdmissionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const q = useQuery(() => admissionService.get(id!), [id], { tags: ['customers', 'sales'] })
  const rooms = useQuery(() => roomService.list(), [], { tags: ['customers'] })
  const bedName = (bedId: string) => {
    const r = rooms.data?.find((x) => x.beds.some((b) => b.id === bedId))
    const b = r?.beds.find((x) => x.id === bedId)
    return b && r ? `${b.label} (${ROOM_TYPE_LABEL[r.type]})` : 'Bed'
  }
  const [dialog, setDialog] = useState<'allocate' | 'transfer' | 'cancel' | 'discharge' | null>(null)
  const [reason, setReason] = useState('')
  const [quickBed, setQuickBed] = useState<string>()
  const close = () => setDialog(null)

  const approve = useMutation(() => admissionService.approve(id!), { successMessage: 'Admission approved' })
  const confirm = useMutation(() => admissionService.confirm(id!), { successMessage: (a) => `${a.patientName} admitted to bed ${a.bedLabel}` })
  const cancel = useMutation(() => admissionService.cancel(id!, reason), { successMessage: 'Admission cancelled', onSuccess: close })
  const discharge = useMutation(() => dischargeService.request(id!, reason || undefined), { successMessage: 'Discharge requested — awaiting the doctor’s summary', onSuccess: close })
  const allocateInline = useMutation(() => bedService.allocate(id!, quickBed!), { successMessage: (a) => `Bed ${a.bedLabel} reserved` })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { admission: a, patient, doctor, bed, account, clinical, prescriptions } = q.data
  const active = ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'].includes(a.status)
  const latestVitals = clinical.find((c) => c.kind === 'VITALS')
  const transfers = a.bedHistory

  return (
    <div>
      <PageHeader
        title={a.admissionNo}
        badge={<AdmissionStatusBadge status={a.status} />}
        description={`${ADMISSION_TYPE_LABEL[a.type]} · ${a.department} · ${a.doctorName}${a.admittedAt ? ` · admitted ${formatDateTime(a.admittedAt)}` : ` · requested ${formatDateTime(a.requestedAt)}`}`}
        breadcrumbs={[{ label: 'Admissions', to: '/admissions' }, { label: a.admissionNo }]}
        actions={
          <>
            {['REQUESTED', 'APPROVED'].includes(a.status) && can('admissions.manage') && (
              <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => { setReason(''); setDialog('cancel') }}>
                Cancel
              </Button>
            )}
            {can('clinical.view') && a.status !== 'REQUESTED' && a.status !== 'CANCELLED' && (
              <Button variant="outline" icon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate(`/clinical?patient=${a.patientId}&admission=${a.id}`)}>
                Clinical records
              </Button>
            )}
            {account && (
              <Button variant="outline" icon={<ReceiptIndianRupee className="h-4 w-4" />} onClick={() => navigate(`/billing/${account.id}`)}>
                Bill
              </Button>
            )}
            {active && can('beds.manage') && (
              <Button variant="outline" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setDialog('transfer')}>
                Transfer bed
              </Button>
            )}
            {['ADMITTED', 'UNDER_TREATMENT'].includes(a.status) && can('discharge.request') && (
              <Button variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={() => { setReason(''); setDialog('discharge') }}>
                Request discharge
              </Button>
            )}
            {(a.status === 'DISCHARGE_REQUESTED' || a.discharge.status !== 'NOT_REQUESTED') && a.status !== 'DISCHARGED' && (
              <Button variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={() => navigate('/discharges')}>
                Discharge workflow
              </Button>
            )}
            {a.status === 'REQUESTED' && can('admissions.approve') && (
              <Button icon={<UserCheck className="h-4 w-4" />} loading={approve.pending} onClick={() => approve.run()}>
                Approve admission
              </Button>
            )}
            {a.status === 'APPROVED' && can('beds.manage') && (
              <Button variant={a.bedId ? 'outline' : 'primary'} icon={<BedDouble className="h-4 w-4" />} onClick={() => setDialog('allocate')}>
                {a.bedId ? 'Change bed' : 'Allocate bed'}
              </Button>
            )}
            {a.status === 'APPROVED' && a.bedId && can('admissions.manage') && (
              <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={confirm.pending} onClick={() => confirm.run()}>
                Confirm admission
              </Button>
            )}
          </>
        }
      />

      {a.status === 'CANCELLED' ? (
        <Alert tone="danger" className="mb-5" title="Admission cancelled">
          {a.cancelReason}
        </Alert>
      ) : (
        <Card className="mb-5 p-4">
          <Stepper a={a} />
          <p className="mt-3 text-[13px] text-ink-600">
            {a.status === 'REQUESTED' && 'Waiting for approval by an authorised doctor or manager.'}
            {a.status === 'APPROVED' && !a.bedId && 'Approved — check availability and allocate a bed.'}
            {a.status === 'APPROVED' && a.bedId && `Bed ${a.bedLabel} is reserved. Confirm the admission when the patient arrives — this creates the inpatient record and opens the patient account.`}
            {a.status === 'ADMITTED' && 'Admitted. Treatment starts with the first clinical entry (assessment, vitals or treatment plan).'}
            {a.status === 'UNDER_TREATMENT' && 'Under treatment — record vitals, medication and progress in Clinical records.'}
            {a.status === 'DISCHARGE_REQUESTED' && `Discharge ${a.discharge.status.toLowerCase().replace('_', ' ')}. The doctor completes the summary; billing settles the final bill; reception completes discharge and releases the bed.`}
            {a.status === 'DISCHARGED' && `Discharged ${formatDateTime(a.discharge.completedAt)}. Bed released.`}
          </p>
        </Card>
      )}

      {a.status === 'APPROVED' && !a.bedId && can('beds.manage') && (
        <Card className="mb-5">
          <CardHeader title="Available beds" description="Select a bed to reserve it for this patient." icon={<BedDouble className="h-4 w-4" />} action={<Button size="sm" disabled={!quickBed} loading={allocateInline.pending} onClick={() => allocateInline.run()}>Reserve selected bed</Button>} />
          <CardBody>
            <BedGrid value={quickBed} onChange={setQuickBed} preferredType={a.preferredRoomType} />
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Clinical summary" />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Reason for admission" value={a.reason} className="sm:col-span-2" />
                <InfoRow label="Diagnosis" value={a.diagnosis || 'Not recorded'} />
                <InfoRow label="Expected discharge" value={a.expectedDischarge ? formatDate(a.expectedDischarge) : 'Not set'} />
                <InfoRow label="Initial observations" value={a.initialObservations || '—'} className="sm:col-span-2" />
              </dl>
            </CardBody>
          </Card>

          {can('clinical.view') && (
            <Card>
              <CardHeader
                title="Latest clinical entries"
                icon={<ClipboardList className="h-4 w-4" />}
                action={active && <Link to={`/clinical?patient=${a.patientId}&admission=${a.id}`} className="text-xs font-semibold text-brand-700 hover:underline">All records →</Link>}
              />
              <CardBody className="space-y-4">
                {latestVitals?.vitals && (
                  <div>
                    <div className="mb-2 text-xs text-ink-500">
                      Vitals · {formatDateTime(latestVitals.at)} · {latestVitals.by}
                    </div>
                    <VitalsGrid vitals={latestVitals.vitals} compact />
                  </div>
                )}
                {clinical.length === 0 ? (
                  <EmptyState compact title="No clinical entries yet" />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {clinical
                      .filter((c) => c.kind !== 'VITALS')
                      .slice(0, 5)
                      .map((c) => (
                        <li key={c.id} className="py-2.5 text-[13px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink-900">{c.title ?? CLINICAL_KIND_LABEL[c.kind]}</span>
                            <span className="text-xs text-ink-500">{formatDateTime(c.at)}</span>
                          </div>
                          <p className="line-clamp-2 text-ink-600">{c.medication ? `${c.medication.name} · ${c.medication.dose} · ${c.medication.route}` : c.text ?? c.file?.name}</p>
                          <p className="text-[11px] text-ink-400">
                            {c.by} · {c.byRole}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          {prescriptions.length > 0 && (
            <Card>
              <CardHeader title="Prescriptions" icon={<FileHeart className="h-4 w-4" />} />
              <ul className="divide-y divide-ink-100 px-5 pb-3">
                {prescriptions.map((r) => (
                  <li key={r.id}>
                    <Link to={`/prescriptions/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-brand-700">
                      <span>
                        <span className="font-mono font-semibold">{r.rxNo}</span> · {r.diagnosis}
                        <span className="block text-xs text-ink-500">
                          {r.doctorName} · {formatDate(r.createdAt)}
                        </span>
                      </span>
                      {r.status === 'DRAFT' ? <Badge>Draft</Badge> : <FulfilmentBadge status={r.fulfilment} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Activity" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-ink-200 pl-5">
                {[...a.history].reverse().map((e, i) => (
                  <li key={`${e.at}-${i}`} className="relative">
                    <span className="absolute top-1 -left-[26px] h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                    <div className="text-[13px] font-medium text-ink-900">{e.action}</div>
                    <div className="text-xs text-ink-500">
                      {formatDateTime(e.at)} · {e.by}
                      {e.note ? ` — ${e.note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="pt-5">
              <div className="flex items-center gap-3">
                <PersonAvatar name={patient.name} />
                <div className="min-w-0">
                  <Link to={`/patients/${patient.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                    {patient.name}
                  </Link>
                  <div className="text-xs text-ink-500">
                    {patient.patientCode} · {a.patientAge} yrs · {patient.gender.toLowerCase()}
                    {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
                  </div>
                </div>
              </div>
              <div className={cn('mt-4 rounded-xl px-3 py-2.5 text-[13px]', patient.allergies.length ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-ink-50 text-ink-600')}>
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="h-4 w-4" /> {patient.allergies.length ? 'Allergies' : 'No known allergies'}
                </div>
                {patient.allergies.length > 0 && <div className="mt-1">{patient.allergies.join(', ')}</div>}
                {patient.conditions.length > 0 && <div className="mt-1 text-xs text-ink-600">Conditions: {patient.conditions.join(', ')}</div>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Bed" icon={<BedDouble className="h-4 w-4" />} />
            <CardBody>
              {bed ? (
                <dl className="grid grid-cols-2 gap-3">
                  <InfoRow label="Bed" value={<span className="font-semibold">{bed.label}</span>} />
                  <InfoRow label="Status" value={<Badge tone={bed.status === 'OCCUPIED' ? 'danger' : 'warning'}>{bed.status === 'OCCUPIED' ? 'Occupied' : 'Reserved'}</Badge>} />
                  <InfoRow label="Room" value={`${bed.roomNumber} · ${ROOM_TYPE_LABEL[bed.roomType]}`} className="col-span-2" />
                  <InfoRow label="Daily rate" value={formatINR(bed.dailyRate)} />
                  <InfoRow label="Department" value={bed.department} />
                </dl>
              ) : (
                <p className="text-sm text-ink-500">{a.status === 'DISCHARGED' ? 'Bed released at discharge.' : 'No bed allocated yet.'}</p>
              )}
              {transfers.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">Bed history</div>
                  <ul className="space-y-2 text-[12.5px]">
                    {transfers.map((h, i) => (
                      <li key={i} className="text-ink-600">
                        <span className="font-medium text-ink-800">{bedName(h.bedId)}</span> · {formatDateTime(h.from)} → {h.to ? formatDateTime(h.to) : 'now'}
                        <span className="block text-[11px] text-ink-400">
                          {h.reason} · {h.by}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Admitting doctor" />
            <CardBody>
              <Link to={`/doctors/${doctor.id}`} className="flex items-center gap-3 hover:text-brand-700">
                <PersonAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="sm" />
                <span>
                  <span className="block text-sm font-semibold">{doctor.name}</span>
                  <span className="text-xs text-ink-500">{doctor.specialization}</span>
                </span>
              </Link>
              {a.attendant && (
                <dl className="mt-4 grid gap-2 border-t border-ink-100 pt-3">
                  <InfoRow label="Attendant" value={`${a.attendant.name} (${a.attendant.relation})`} />
                  <InfoRow label="Attendant mobile" value={a.attendant.phone} />
                </dl>
              )}
            </CardBody>
          </Card>

          {a.discharge.status !== 'NOT_REQUESTED' && (
            <Card>
              <CardHeader title="Discharge" icon={<LogOut className="h-4 w-4" />} action={<DischargeStatusBadge status={a.discharge.status} />} />
              <CardBody>
                <dl className="grid gap-2">
                  <InfoRow label="Requested" value={a.discharge.requestedAt ? `${formatDateTime(a.discharge.requestedAt)} · ${a.discharge.requestedBy}` : '—'} />
                  {a.discharge.approvedBy && <InfoRow label="Approved by" value={`${a.discharge.approvedBy} · ${formatDateTime(a.discharge.approvedAt)}`} />}
                  {a.discharge.finalDiagnosis && <InfoRow label="Final diagnosis" value={a.discharge.finalDiagnosis} />}
                </dl>
              </CardBody>
            </Card>
          )}

          {account && (
            <Card>
              <CardHeader title="Patient account" icon={<ReceiptIndianRupee className="h-4 w-4" />} action={<Link to={`/billing/${account.id}`} className="text-xs font-semibold text-brand-700 hover:underline">Open bill →</Link>} />
              <CardBody className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-500">Account</span><span className="font-mono">{account.billNo ?? account.accountNo}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">Charges posted</span><span className="num">{formatINR(account.totals.net)}</span></div>
                {account.accruedRoom && <div className="flex justify-between"><span className="text-ink-500">Room accrued ({account.accruedRoom.nights} nights)</span><span className="num">{formatINR(account.accruedRoom.amount)}</span></div>}
                <div className="flex justify-between"><span className="text-ink-500">Paid</span><span className="num">{formatINR(account.totals.paid)}</span></div>
                <div className="flex justify-between border-t border-ink-100 pt-1.5 font-semibold"><span>Balance</span><span className={cn('num', account.totals.balance > 0.005 && 'text-red-600')}>{formatINR(account.totals.balance)}</span></div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {(dialog === 'allocate' || dialog === 'transfer') && <BedPickerModal open admission={a} mode={dialog} onClose={close} />}

      <Modal
        open={dialog === 'cancel'}
        onClose={close}
        size="sm"
        title={`Cancel ${a.admissionNo}?`}
        description={a.bedId ? 'The reserved bed will be released.' : undefined}
        footer={
          <>
            <Button variant="outline" onClick={close}>Keep</Button>
            <Button variant="danger" disabled={!reason.trim()} loading={cancel.pending} onClick={() => cancel.run()}>Cancel admission</Button>
          </>
        }
      >
        <Field label="Reason" required>{(fid) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Modal>

      <Modal
        open={dialog === 'discharge'}
        onClose={close}
        size="sm"
        title="Request discharge"
        description="The admitting doctor will prepare and approve the discharge summary."
        footer={
          <>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button loading={discharge.pending} onClick={() => discharge.run()}>Request discharge</Button>
          </>
        }
      >
        <Field label="Note (optional)">{(fid) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Afebrile 24 h, tolerating diet" />}</Field>
      </Modal>
    </div>
  )
}
