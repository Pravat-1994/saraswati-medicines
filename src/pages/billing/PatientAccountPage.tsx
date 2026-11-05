import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FileCheck2, HandCoins, Percent, Plus, Printer, Trash2 } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { admissionService, patientBillingService } from '../../services'
import { CHARGE_CATEGORY_LABEL } from '../../lib/clinic'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan } from '../../stores/sessionStore'
import type { ChargeCategory, PatientCharge } from '../../types/clinic'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ConfirmDialog } from '../../components/ui/Modal'
import { SegmentedBar, SERIES } from '../../components/charts/Charts'
import { AddChargeDialog, DiscountDialog, PaymentDialog } from './accountDialogs'
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE, PATIENT_PAYMENT_METHOD_LABEL, PAYMENT_KIND_LABEL } from './labels'
import { PatientBillDocument } from './PatientBillDocument'
import { PrintPortal } from './PrintPortal'

const ORDER: ChargeCategory[] = ['ADMISSION', 'ROOM', 'BED', 'CONSULTATION', 'TREATMENT', 'SERVICE', 'MEDICINE']

export default function PatientAccountPage() {
  const { id } = useParams()
  const can = useCan()
  const q = useQuery(() => patientBillingService.get(id!), [id], { tags: ['customers', 'sales'] })
  const admissionId = q.data?.admissionId
  const adm = useQuery(() => admissionService.get(admissionId!), [admissionId], { enabled: !!admissionId && can('admissions.view'), tags: ['customers'] })
  const [dialog, setDialog] = useState<'charge' | 'discount' | 'payment' | 'finalise' | null>(null)
  const [removing, setRemoving] = useState<PatientCharge>()
  const [printing, setPrinting] = useState(false)
  const stopPrint = useCallback(() => setPrinting(false), [])
  const remove = useMutation((chargeId: string) => patientBillingService.removeCharge(id!, chargeId), { successMessage: 'Charge removed', onSuccess: () => setRemoving(undefined) })
  const finalise = useMutation(() => patientBillingService.finalise(id!), { successMessage: (a) => `Final bill ${a.billNo} generated`, onSuccess: () => setDialog(null) })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const a = q.data
  const t = a.totals
  const manage = can('billing.manage')
  const isOpen = a.status === 'OPEN'
  const dischargeStatus = adm.data?.admission.discharge.status
  const finaliseBlocked = !!a.admissionId && dischargeStatus !== undefined && dischargeStatus !== 'APPROVED' && dischargeStatus !== 'COMPLETED'
  const groups = ORDER.map((cat) => ({ cat, items: a.charges.filter((c) => c.category === cat) })).filter((g) => g.items.length > 0)

  return (
    <div>
      <PageHeader
        title={a.billNo ?? a.accountNo}
        badge={<Badge tone={ACCOUNT_STATUS_TONE[a.status]}>{ACCOUNT_STATUS_LABEL[a.status]}</Badge>}
        description={
          <>
            {a.patientName} ({a.patientCode}) · {a.admissionId ? 'Inpatient' : 'Outpatient'} {a.admissionNo ?? a.appointmentNo ?? ''}
            {adm.data?.admission.bedLabel ? ` · Bed ${adm.data.admission.bedLabel}` : ''}
          </>
        }
        breadcrumbs={[{ label: 'Patient billing', to: '/billing' }, { label: a.accountNo }]}
        actions={
          <>
            <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => setPrinting(true)}>
              Print {isOpen ? 'statement' : 'bill'}
            </Button>
            {manage && isOpen && (
              <>
                <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog('charge')}>
                  Add charge
                </Button>
                <Button variant="outline" icon={<Percent className="h-4 w-4" />} onClick={() => setDialog('discount')}>
                  Discount
                </Button>
              </>
            )}
            {manage && a.status !== 'SETTLED' && (
              <Button variant={isOpen ? 'outline' : 'primary'} icon={<HandCoins className="h-4 w-4" />} onClick={() => setDialog('payment')}>
                Record payment
              </Button>
            )}
            {manage && isOpen && (
              <Button icon={<FileCheck2 className="h-4 w-4" />} disabled={finaliseBlocked} title={finaliseBlocked ? 'The doctor must approve discharge first' : undefined} onClick={() => setDialog('finalise')}>
                Generate final bill
              </Button>
            )}
          </>
        }
      />

      {finaliseBlocked && manage && isOpen && (
        <Alert tone="info" className="mb-4">
          The final inpatient bill can be generated once the doctor approves discharge (currently: {dischargeStatus?.toLowerCase().replace('_', ' ')}).{' '}
          <Link to="/discharges" className="font-semibold underline">
            Discharge management
          </Link>
        </Alert>
      )}
      {a.status === 'FINALISED' && t.balance > 0.005 && <Alert tone="warning" className="mb-4">Final bill issued — {formatINR(t.balance)} is still due.</Alert>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Charges" description={`${a.charges.length} line(s) · opened ${formatDateTime(a.openedAt)}`} />
            {a.charges.length === 0 && !a.accruedRoom ? (
              <EmptyState compact title="No charges yet" />
            ) : (
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead className="bg-ink-50/80 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    <tr>
                      <th className="px-5 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Tax</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  {groups.map((g) => (
                    <tbody key={g.cat}>
                      <tr className="border-t border-ink-100 bg-ink-50/40">
                        <td colSpan={6} className="px-5 py-1.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                          {CHARGE_CATEGORY_LABEL[g.cat]}
                        </td>
                      </tr>
                      {g.items.map((c) => (
                        <tr key={c.id} className="border-t border-ink-100">
                          <td className="px-5 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {c.saleId ? (
                                <Link to={`/sales/${c.saleId}`} className="font-medium text-brand-700 hover:underline">
                                  {c.description}
                                </Link>
                              ) : (
                                <span className="font-medium text-ink-900">{c.description}</span>
                              )}
                              {c.saleId && <Badge tone="brand">Pharmacy invoice</Badge>}
                              {c.auto && !c.saleId && <Badge>System</Badge>}
                            </div>
                            <div className="text-[11px] text-ink-400">
                              {formatDate(c.date)} · {c.addedBy}
                            </div>
                          </td>
                          <td className="num px-3 py-2.5 text-right">{c.quantity}</td>
                          <td className="num px-3 py-2.5 text-right">{formatINR(c.rate)}</td>
                          <td className="num px-3 py-2.5 text-right">{c.tax ? `${formatINR(c.tax)} (${c.taxRate}%)` : '—'}</td>
                          <td className="num px-3 py-2.5 text-right font-semibold">{formatINR(c.amount + c.tax)}</td>
                          <td className="px-3 py-2.5 text-right">
                            {manage && isOpen && !c.auto && !c.saleId && (
                              <button onClick={() => setRemoving(c)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${c.description}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                  {a.accruedRoom && (
                    <tbody>
                      <tr className="border-t border-dashed border-ink-200 bg-amber-50/40 text-ink-600">
                        <td className="px-5 py-2.5">
                          <span className="font-medium">Room {a.accruedRoom.roomNumber} — accrued</span>
                          <div className="text-[11px] text-ink-500">Estimate; posted automatically when the final bill is generated</div>
                        </td>
                        <td className="num px-3 py-2.5 text-right">{a.accruedRoom.nights}</td>
                        <td className="num px-3 py-2.5 text-right">{formatINR(a.accruedRoom.rate)}</td>
                        <td className="px-3 py-2.5 text-right">—</td>
                        <td className="num px-3 py-2.5 text-right italic">{formatINR(a.accruedRoom.amount)}</td>
                        <td />
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Payment history" />
            {a.payments.length === 0 ? (
              <EmptyState compact title="No payments recorded" />
            ) : (
              <ul className="divide-y divide-ink-100 px-5 pb-3">
                {[...a.payments].reverse().map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={p.kind === 'REFUND' ? 'warning' : p.kind === 'ADVANCE' ? 'info' : 'success'}>{PAYMENT_KIND_LABEL[p.kind]}</Badge>
                        <span className="font-mono text-xs text-ink-600">{p.receiptNo}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {formatDateTime(p.date)} · {PATIENT_PAYMENT_METHOD_LABEL[p.method]}
                        {p.reference ? ` · ${p.reference}` : ''} · {p.by}
                      </div>
                    </div>
                    <span className="num font-semibold text-ink-900">
                      {p.kind === 'REFUND' ? '−' : ''}
                      {formatINR(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2 text-[13px]">
              {[
                ['Charges', formatINR(t.charges)],
                ['Tax', formatINR(t.tax)],
                ['Discount', t.discount ? `−${formatINR(t.discount)}` : formatINR(0)],
                ['Net amount', formatINR(t.net)],
                ['Paid', formatINR(t.paid)],
                ['Refunded', formatINR(t.refunded)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-ink-500">{k}</span>
                  <span className="num font-medium">{v}</span>
                </div>
              ))}
              <div className="flex items-end justify-between border-t border-ink-200 pt-3">
                <span className="font-medium text-ink-700">{t.balance < -0.005 ? 'Refund due' : 'Balance due'}</span>
                <span className={`num font-display text-2xl font-bold ${t.balance > 0.005 ? 'text-amber-700' : 'text-ink-950'}`}>{formatINR(Math.abs(t.balance))}</span>
              </div>
              {a.accruedRoom && <p className="text-[11px] text-ink-500">Plus about {formatINR(a.accruedRoom.amount)} in room charges to be posted at final billing.</p>}
            </CardBody>
          </Card>
          {t.byCategory.length > 0 && (
            <Card>
              <CardHeader title="By category" />
              <CardBody>
                <SegmentedBar parts={t.byCategory.map((c, i) => ({ label: CHARGE_CATEGORY_LABEL[c.category], value: c.amount, color: SERIES[i % SERIES.length] }))} />
              </CardBody>
            </Card>
          )}
          <p className="px-1 text-xs leading-relaxed text-ink-500">Pharmacy sales are separate tax invoices. Medicines charged to this inpatient account appear above and link to their invoice.</p>
        </div>
      </div>

      {dialog === 'charge' && <AddChargeDialog account={a} onClose={() => setDialog(null)} />}
      {dialog === 'discount' && <DiscountDialog account={a} onClose={() => setDialog(null)} />}
      {dialog === 'payment' && <PaymentDialog account={a} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'finalise'}
        onClose={() => setDialog(null)}
        onConfirm={() => finalise.run()}
        loading={finalise.pending}
        tone="primary"
        title="Generate final bill?"
        confirmLabel="Generate bill"
        message={`Charges will be locked${a.accruedRoom ? ` and ${a.accruedRoom.nights} room night(s) (${formatINR(a.accruedRoom.amount)}) will be posted` : ''}. Payments can still be recorded until the bill is settled.`}
      />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(undefined)} onConfirm={() => removing && remove.run(removing.id)} loading={remove.pending} title="Remove charge?" confirmLabel="Remove" message={removing ? `${removing.description} — ${formatINR(removing.amount + removing.tax)}` : ''} />
      {printing && (
        <PrintPortal onDone={stopPrint}>
          <PatientBillDocument account={a} />
        </PrintPortal>
      )}
    </div>
  )
}
