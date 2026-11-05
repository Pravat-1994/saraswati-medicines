import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, FileHeart, History, Printer, RotateCcw, ScanBarcode, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate } from '../../hooks/useQuery'
import { medicineService, patientBillingService, prescriptionService, salesService } from '../../services'
import { formatINR } from '../../lib/money'
import { priceSale } from '../../lib/sales'
import { usePosStore } from '../../stores/posStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { Sale } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { CartTable } from './CartTable'
import { CheckoutPanel, type CheckoutIssue } from './CheckoutPanel'
import { MedicineSearch, type MedicineSearchHandle } from './MedicineSearch'

export default function PosPage() {
  const settings = useSettings()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<MedicineSearchHandle>(null)
  const s = usePosStore()
  const role = useSessionStore((st) => st.role)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState<Sale | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [billToAccount, setBillToAccount] = useState(true)

  // Live preview using the same pricing engine the backend uses.
  const preview = useMemo(
    () =>
      priceSale(
        s.lines.map((l) => ({ medicine: l.medicine, batch: l.batch, quantity: l.quantity, discountPct: l.discountPct, lineId: l.key })),
        s.billDiscountPct,
        settings,
      ),
    [s.lines, s.billDiscountPct, settings],
  )

  const issues = useMemo<CheckoutIssue[]>(() => {
    const out: CheckoutIssue[] = []
    const max = role?.maxDiscountPct ?? 0
    if (s.billDiscountPct > max || s.lines.some((l) => l.discountPct > max)) out.push({ level: 'error', message: `Discounts above ${max}% need a manager — reduce the discount to continue.` })
    if (s.lines.some((l) => l.batch.expiryStatus === 'EXPIRED')) out.push({ level: 'error', message: 'An expired batch is in the cart. Expired stock cannot be sold.' })
    if (!(s.chargeAccount && billToAccount) && s.paymentMethod === 'CASH' && s.amountTendered !== '' && Number(s.amountTendered) < preview.totals.grandTotal) out.push({ level: 'error', message: 'Cash received is less than the amount payable.' })
    const critical = s.lines.filter((l) => l.batch.expiryStatus === 'CRITICAL')
    if (critical.length) out.push({ level: 'warning', message: `${critical.map((l) => l.medicine.name).join(', ')} expire${critical.length === 1 ? 's' : ''} within ${settings.criticalExpiryDays} days — inform the customer.` })
    if (s.lines.some((l) => l.medicine.prescriptionRequired) && !s.prescriptionRef.trim()) out.push({ level: 'warning', message: 'Prescription medicines in cart — add the prescription reference.' })
    return out
  }, [s.lines, s.billDiscountPct, s.paymentMethod, s.amountTendered, s.prescriptionRef, s.chargeAccount, billToAccount, preview.totals.grandTotal, role, settings.criticalExpiryDays])

  // Deep link: /pos?add=<medicineId>
  const addParam = params.get('add')
  useEffect(() => {
    if (!addParam) return
    let cancelled = false
    medicineService
      .getSaleable(addParam)
      .then((item) => {
        if (cancelled) return
        const r = usePosStore.getState().addMedicine(item, 1)
        if (r.added > 0) toast.success(`${item.medicine.name} added`)
        else toast.error(`${item.medicine.name} has no sellable stock.`)
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setParams({}, { replace: true }))
    return () => {
      cancelled = true
    }
  }, [addParam, setParams])

  const complete = async () => {
    const st = usePosStore.getState()
    if (st.lines.length === 0 || issues.some((i) => i.level === 'error') || submitting) return
    setSubmitting(true)
    const account = st.chargeAccount && billToAccount ? st.chargeAccount : null
    const rx = st.prescription
    try {
      const sale = await salesService.create({
        customerId: st.customer?.id,
        customerName: st.customer ? undefined : st.walkInName || undefined,
        customerPhone: st.customer ? undefined : st.walkInPhone || undefined,
        lines: st.lines.map((l) => ({ medicineId: l.medicine.id, batchId: l.batch.id, quantity: l.quantity, discountPct: l.discountPct, fefoOverridden: l.fefoOverridden })),
        billDiscountPct: st.billDiscountPct,
        paymentMethod: account ? 'OTHER' : st.paymentMethod,
        paymentReference: account ? `Patient account ${account.accountNo}` : st.paymentReference || undefined,
        amountTendered: !account && st.paymentMethod === 'CASH' && st.amountTendered !== '' ? Number(st.amountTendered) : undefined,
        prescriptionRef: st.prescriptionRef || undefined,
        notes: st.notes || undefined,
        prescriptionId: rx?.id,
        patientId: rx?.patientId,
        patientAccountId: account?.accountId,
      })
      if (rx) {
        try {
          await prescriptionService.recordDispense({ prescriptionId: rx.id, saleId: sale.id, invoiceNumber: sale.invoiceNumber, lines: sale.items.map((i) => ({ medicineId: i.medicineId, quantity: i.quantity })) })
        } catch (err) {
          toast.error(`Sale saved, but prescription ${rx.rxNo} could not be updated: ${errorMessage(err)}`)
        }
      }
      if (account) {
        try {
          await patientBillingService.linkPharmacySale(account.accountId, { saleId: sale.id, invoiceNumber: sale.invoiceNumber, amount: sale.grandTotal })
        } catch (err) {
          toast.error(`Sale saved, but it could not be linked to ${account.accountNo}: ${errorMessage(err)}`)
        }
      }
      st.clear()
      setBillToAccount(true)
      invalidate()
      setCompleted(sale)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const completeRef = useRef(complete)
  useEffect(() => {
    completeRef.current = complete
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void completeRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <ScanBarcode className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-ink-950">Point of Sale</h1>
            <p className="text-xs text-ink-500">Counter billing · FEFO batch allocation · expired stock is blocked</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<History className="h-4 w-4" />} onClick={() => navigate('/sales')}>
            Previous sales
          </Button>
          <Button variant="outline" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => navigate('/sales?tab=returns')}>
            Returns
          </Button>
          {s.lines.length > 0 && (
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmClear(true)}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <MedicineSearch ref={searchRef} />
          <div className="min-h-[420px] rounded-2xl border border-ink-200/70 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <h2 className="font-display text-sm font-semibold text-ink-900">Cart</h2>
              {s.lines.length > 0 && <span className="text-xs text-ink-500">{s.lines.length} line{s.lines.length === 1 ? '' : 's'}</span>}
            </div>
            {s.prescription && (
              <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50/60 px-4 py-2.5 text-[13px]">
                <FileHeart className="h-4 w-4 shrink-0 text-violet-600" />
                <span className="min-w-0 flex-1">
                  Dispensing <Link to={`/prescriptions/${s.prescription.id}`} className="font-mono font-semibold text-violet-800 hover:underline">{s.prescription.rxNo}</Link> for{' '}
                  <span className="font-semibold">{s.prescription.patientName}</span> · {s.prescription.doctorName}
                  {s.chargeAccount && <span className="text-violet-700"> · inpatient account {s.chargeAccount.accountNo}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    s.setPrescription(null)
                    s.setChargeAccount(null)
                  }}
                  className="rounded-lg p-1 text-violet-500 hover:bg-white hover:text-violet-800"
                  aria-label="Stop dispensing against this prescription"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <CartTable priced={preview.items} />
          </div>
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <CheckoutPanel
            totals={preview.totals}
            itemCount={s.lines.length}
            unitCount={s.lines.reduce((a, l) => a + l.quantity, 0)}
            issues={issues}
            onComplete={complete}
            submitting={submitting}
            billToAccount={billToAccount}
            onBillToAccount={setBillToAccount}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          s.clear()
          setConfirmClear(false)
          searchRef.current?.focus()
        }}
        title="Clear this bill?"
        confirmLabel="Clear bill"
        message="All items, customer and payment details on this bill will be removed."
      />

      <Modal
        open={!!completed}
        onClose={() => {
          setCompleted(null)
          searchRef.current?.focus()
        }}
        title="Sale completed"
        size="sm"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        footer={
          <>
            <Link to={completed ? `/sales/${completed.id}?print=1` : '/sales'}>
              <Button variant="outline" icon={<Printer className="h-4 w-4" />}>
                View & print invoice
              </Button>
            </Link>
            <Button
              data-autofocus
              onClick={() => {
                setCompleted(null)
                searchRef.current?.focus()
              }}
            >
              New sale
            </Button>
          </>
        }
      >
        {completed && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="num font-display text-3xl font-extrabold text-ink-950">{formatINR(completed.grandTotal)}</div>
            <div className="mt-1 text-sm text-ink-500">
              Invoice <span className="font-mono font-semibold text-ink-800">{completed.invoiceNumber}</span> · {completed.customerName}
            </div>
            {completed.changeReturned !== undefined && completed.changeReturned > 0 && (
              <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Return change: {formatINR(completed.changeReturned)}</div>
            )}
            <div className="mt-4 text-xs text-ink-500">
              {completed.items.length} item(s) · stock deducted from {new Set(completed.items.map((i) => i.batchNumber)).size} batch(es)
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
