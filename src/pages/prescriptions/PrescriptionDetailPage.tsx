import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, Info, Pencil, PenLine, Printer, ScanBarcode, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, useMutation, useQuery } from '../../hooks/useQuery'
import { clinicSettingsService, medicineService, prescriptionService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { printPage } from '../../lib/export'
import { cn } from '../../lib/utils'
import { usePosStore } from '../../stores/posStore'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Checkbox, Field, Input } from '../../components/ui/Form'
import { FulfilmentBadge } from '../../components/clinic/ClinicBadges'
import { PrescriptionDocument } from './PrescriptionDocument'

export default function PrescriptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const user = useSessionStore((s) => s.user)
  const store = useSettings().store
  const q = useQuery(() => prescriptionService.get(id!), [id], { tags: ['customers', 'sales', 'inventory'] })
  const clinic = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signName, setSignName] = useState('')
  const [chargeToAccount, setChargeToAccount] = useState(true)
  const [dispensing, setDispensing] = useState(false)

  const remove = useMutation(() => prescriptionService.deleteDraft(id!), { successMessage: 'Draft deleted', onSuccess: () => navigate('/prescriptions') })
  const finalise = useMutation(() => prescriptionService.finalise(id!, signName), { successMessage: (r) => `${r.rxNo} finalised and signed`, onSuccess: () => setSigning(false) })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { prescription: rx, patient, doctor, availability, activeAdmission } = q.data
  const isAuthor = user?.roleId === 'DOCTOR' && user.doctorId === rx.doctorId && can('prescriptions.issue')
  const draft = rx.status === 'DRAFT'
  const dispensable = availability.filter((a) => a.dispensable > 0)
  const canDispense = can('prescriptions.fulfil') && can('sales.pos') && !draft && dispensable.length > 0

  const dispense = async () => {
    setDispensing(true)
    try {
      const pos = usePosStore.getState()
      if (pos.lines.length > 0 && pos.prescription?.id !== rx.id) pos.clear()
      let added = 0
      for (const a of dispensable) {
        const item = await medicineService.getSaleable(a.medicineId!)
        const r = usePosStore.getState().addMedicine(item, a.dispensable)
        added += r.added
        if (r.shortfall > 0) toast.warning(`${item.medicine.name}: only ${r.added} of ${a.dispensable} could be added.`)
      }
      usePosStore.getState().setPrescription({ id: rx.id, rxNo: rx.rxNo, patientId: patient.id, patientName: patient.name, doctorName: doctor.name })
      if (activeAdmission?.accountId && activeAdmission.accountNo && chargeToAccount) usePosStore.getState().setChargeAccount({ accountId: activeAdmission.accountId, accountNo: activeAdmission.accountNo, patientName: patient.name })
      else usePosStore.getState().setChargeAccount(null)
      if (added === 0) return toast.error('Nothing could be added — stock may have changed.')
      toast.success(`${added} unit(s) added to the POS cart`)
      navigate('/pos')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDispensing(false)
    }
  }

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={rx.rxNo}
          badge={draft ? <Badge tone="warning">Draft</Badge> : <FulfilmentBadge status={rx.fulfilment} />}
          description={`${patient.name} · ${doctor.name} · ${formatDateTime(rx.createdAt)}`}
          breadcrumbs={[{ label: 'Prescriptions', to: '/prescriptions' }, { label: rx.rxNo }]}
          actions={
            <>
              {isAuthor && draft && (
                <>
                  <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                    Delete draft
                  </Button>
                  <Link to={`/prescriptions/${rx.id}/edit`}>
                    <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                      Edit
                    </Button>
                  </Link>
                  <Button
                    icon={<PenLine className="h-4 w-4" />}
                    onClick={() => {
                      setSignName('')
                      setSigning(true)
                    }}
                  >
                    Finalise & sign
                  </Button>
                </>
              )}
              <Button variant={draft ? 'outline' : 'primary'} icon={<Printer className="h-4 w-4" />} onClick={printPage}>
                Print / PDF
              </Button>
            </>
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="print-area p-5 sm:p-8">
          <PrescriptionDocument rx={rx} patient={patient} doctor={doctor} facilityName={clinic.data?.facilityName ?? store.name} store={store} />
        </Card>
        <div className="no-print space-y-4">
          {draft && (
            <Alert tone="warning" title="Draft prescription">
              Not valid for dispensing until {doctor.name} signs it.
            </Alert>
          )}
          {can('prescriptions.fulfil') && (
            <Card>
              <CardHeader title="Pharmacy fulfilment" description="Live stock for each prescribed item." />
              <CardBody className="space-y-3">
                <ul className="space-y-2">
                  {rx.items.map((i) => {
                    const a = availability.find((x) => x.itemId === i.id)
                    const unavailable = !a?.stocked || (a.pending > 0 && a.available === 0)
                    return (
                      <li key={i.id} className={cn('rounded-xl border px-3 py-2.5 text-[13px]', unavailable ? 'border-red-200 bg-red-50/50' : 'border-ink-100')}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-ink-900">{i.medicineName}</span>
                          <span className="num shrink-0 text-xs text-ink-500">
                            {i.dispensedQty}/{i.quantity} dispensed
                          </span>
                        </div>
                        <div className="mt-1 text-xs">
                          {!a?.stocked ? (
                            <span className="font-medium text-red-600">Not stocked — refer the patient or contact the prescriber</span>
                          ) : a.pending === 0 ? (
                            <span className="font-medium text-emerald-700">Fully dispensed</span>
                          ) : a.available === 0 ? (
                            <span className="font-medium text-red-600">Out of stock — {a.pending} pending</span>
                          ) : (
                            <span className={a.dispensable < a.pending ? 'text-amber-700' : 'text-emerald-700'}>
                              {a.available} in stock · {a.dispensable} of {a.pending} can be dispensed
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <p className="flex items-start gap-1.5 text-xs text-ink-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Substitution requires prescriber authorisation — unavailable items are never replaced automatically.
                </p>
                {activeAdmission?.accountId && (
                  <Checkbox
                    checked={chargeToAccount}
                    onChange={(e) => setChargeToAccount(e.target.checked)}
                    label={`Charge to inpatient account ${activeAdmission.accountNo}`}
                    description={`Patient is admitted (${activeAdmission.admissionNo}); the pharmacy bill is linked to their account.`}
                  />
                )}
                {canDispense ? (
                  <Button className="w-full" icon={<ScanBarcode className="h-4 w-4" />} loading={dispensing} onClick={() => void dispense()}>
                    Dispense at POS
                  </Button>
                ) : (
                  !draft && (
                    <p className="text-center text-xs text-ink-500">
                      {rx.fulfilment === 'FULFILLED' ? 'All items have been dispensed.' : !can('sales.pos') ? 'Your role cannot bill at the POS.' : 'No items can be dispensed right now.'}
                    </p>
                  )
                )}
              </CardBody>
            </Card>
          )}
          {rx.saleIds.length > 0 && (
            <Card>
              <CardHeader title="Dispensing history" />
              <ul className="space-y-1 px-5 pb-4 text-[13px]">
                {rx.saleIds.map((sid) => (
                  <li key={sid}>
                    <Link to={`/sales/${sid}`} className="font-medium text-brand-700 hover:underline">
                      View pharmacy invoice →
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {patient.allergies.length > 0 && (
            <Alert tone="danger" icon={<AlertTriangle className="h-4 w-4" />} title="Allergies">
              {patient.allergies.join(', ')}
            </Alert>
          )}
          <Card>
            <CardHeader title="Audit trail" />
            <CardBody>
              <ol className="space-y-2 text-[13px]">
                {[...rx.history].reverse().map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <span className="font-medium text-ink-900">{h.action}</span>
                    <span className="block text-xs text-ink-500">
                      {formatDateTime(h.at)} · {h.by}
                      {h.note ? ` — ${h.note}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          {(rx.appointmentId || rx.consultationId) && (
            <div className="flex flex-wrap gap-2">
              {rx.appointmentId && (
                <Link to={`/appointments/${rx.appointmentId}`}>
                  <Button size="sm" variant="outline">Appointment</Button>
                </Link>
              )}
              {rx.consultationId && (
                <Link to={`/consultations/${rx.consultationId}`}>
                  <Button size="sm" variant="outline">Consultation</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.run()} loading={remove.pending} title="Delete this draft?" confirmLabel="Delete draft" message="The draft prescription will be permanently removed." />
      <Modal
        open={signing}
        onClose={() => setSigning(false)}
        dismissible={!finalise.pending}
        size="sm"
        icon={<PenLine className="h-4 w-4" />}
        title="Finalise & sign"
        description="Signed prescriptions become valid for dispensing and cannot be edited."
        footer={
          <>
            <Button variant="outline" onClick={() => setSigning(false)}>
              Cancel
            </Button>
            <Button loading={finalise.pending} disabled={signName.trim().toLowerCase() !== doctor.name.toLowerCase()} onClick={() => finalise.run()}>
              Sign & finalise
            </Button>
          </>
        }
      >
        <Field label={`Type your name exactly: ${doctor.name}`} hint={`Registration ${doctor.registrationNo} and the time will be recorded.`}>
          {(fid) => <Input id={fid} value={signName} onChange={(e) => setSignName(e.target.value)} autoComplete="off" />}
        </Field>
      </Modal>
    </div>
  )
}
