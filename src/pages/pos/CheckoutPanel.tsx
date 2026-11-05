import { useState } from 'react'
import { Banknote, BedDouble, ChevronDown, CreditCard, FileText, QrCode, Wallet } from 'lucide-react'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { InvoiceTotals } from '../../lib/pricing'
import { usePosStore } from '../../stores/posStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { PaymentMethod } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Switch } from '../../components/ui/Form'
import { CustomerPicker } from './CustomerPicker'

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: 'CASH', label: 'Cash', icon: Banknote },
  { key: 'UPI', label: 'UPI', icon: QrCode },
  { key: 'CARD', label: 'Card', icon: CreditCard },
  { key: 'OTHER', label: 'Other', icon: Wallet },
]

function Row({ label, value, muted, strong, tone }: { label: string; value: string; muted?: boolean; strong?: boolean; tone?: 'green' }) {
  return (
    <div className={cn('flex items-center justify-between text-[13px]', muted && 'text-ink-500')}>
      <span>{label}</span>
      <span className={cn('num', strong && 'font-semibold text-ink-900', tone === 'green' && 'text-emerald-700')}>{value}</span>
    </div>
  )
}

export interface CheckoutIssue {
  level: 'error' | 'warning'
  message: string
}

export function CheckoutPanel({ totals, itemCount, unitCount, issues, onComplete, submitting, billToAccount, onBillToAccount }: { totals: InvoiceTotals; itemCount: number; unitCount: number; issues: CheckoutIssue[]; onComplete: () => void; submitting: boolean; billToAccount: boolean; onBillToAccount: (v: boolean) => void }) {
  const settings = useSettings()
  const maxDiscount = useSessionStore((s) => s.role?.maxDiscountPct ?? 0)
  const s = usePosStore()
  const [showMore, setShowMore] = useState(false)
  const tendered = Number(s.amountTendered)
  const change = s.paymentMethod === 'CASH' && s.amountTendered !== '' && Number.isFinite(tendered) ? tendered - totals.grandTotal : undefined
  const errors = issues.filter((i) => i.level === 'error')
  const hasRx = s.lines.some((l) => l.medicine.prescriptionRequired)
  const quickCash = totals.grandTotal <= 0 ? [] : [...new Set([totals.grandTotal, Math.ceil(totals.grandTotal / 100) * 100, Math.ceil(totals.grandTotal / 500) * 500, 2000])].filter((v) => v >= totals.grandTotal && v > 0).slice(0, 3)

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card">
        <h2 className="mb-3 font-display text-sm font-semibold text-ink-900">Customer</h2>
        <CustomerPicker />
      </section>

      <section className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
        <div className="space-y-2 p-4">
          <h2 className="mb-1 flex items-center justify-between font-display text-sm font-semibold text-ink-900">
            Bill summary
            <span className="text-xs font-normal text-ink-500">
              {itemCount} item{itemCount === 1 ? '' : 's'} · {unitCount} unit{unitCount === 1 ? '' : 's'}
            </span>
          </h2>
          <Row label="Subtotal (MRP)" value={formatINR(totals.subtotal)} />
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <label htmlFor="bill-discount" className="text-ink-700">
              Bill discount <span className="text-xs text-ink-400">(max {maxDiscount}%)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                id="bill-discount"
                type="number"
                min={0}
                max={maxDiscount}
                step="0.5"
                value={s.billDiscountPct || ''}
                placeholder="0"
                onChange={(e) => s.setBillDiscount(Number(e.target.value))}
                aria-invalid={s.billDiscountPct > maxDiscount || undefined}
                className="num h-8 w-16 rounded-lg border border-ink-200 px-2 text-right text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none aria-[invalid=true]:border-red-400"
              />
              <span className="text-ink-400">%</span>
            </div>
          </div>
          {totals.discountTotal > 0 && <Row label="Total discount" value={`−${formatINR(totals.discountTotal)}`} tone="green" />}
          <div className="my-2 border-t border-dashed border-ink-200" />
          <Row label="Taxable value" value={formatINR(totals.taxableTotal)} muted />
          <Row label="CGST" value={formatINR(totals.cgstTotal)} muted />
          <Row label="SGST" value={formatINR(totals.sgstTotal)} muted />
          {settings.roundOffInvoice && totals.roundOff !== 0 && <Row label="Round off" value={`${totals.roundOff > 0 ? '+' : ''}${totals.roundOff.toFixed(2)}`} muted />}
          <p className="text-[11px] text-ink-400">{settings.pricesIncludeGst ? 'Prices are inclusive of GST.' : 'GST is added to prices.'}</p>
        </div>
        <div className="flex items-end justify-between rounded-b-2xl border-t border-ink-100 bg-gradient-to-br from-brand-50 to-white px-4 py-4">
          <span className="text-sm font-medium text-ink-600">Amount payable</span>
          <span className="num font-display text-3xl font-extrabold tracking-tight text-ink-950">{formatINR(totals.grandTotal)}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card">
        <h2 className="mb-3 font-display text-sm font-semibold text-ink-900">Payment</h2>
        {s.chargeAccount && (
          <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <Switch
              checked={billToAccount}
              onChange={onBillToAccount}
              label={<span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-violet-600" /> Bill to inpatient account {s.chargeAccount.accountNo}</span>}
              description={billToAccount ? `Charged to ${s.chargeAccount.patientName}'s account — settled at discharge.` : 'Collect payment at the counter instead.'}
            />
          </div>
        )}
        {!(s.chargeAccount && billToAccount) && (<>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
          {METHODS.map((m) => {
            const Icon = m.icon
            const active = s.paymentMethod === m.key
            return (
              <button
                key={m.key}
                role="radio"
                aria-checked={active}
                onClick={() => s.setPaymentMethod(m.key)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition',
                  active ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/15' : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            )
          })}
        </div>
        {s.paymentMethod === 'CASH' ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="tendered" className="w-28 shrink-0 text-[13px] text-ink-600">
                Cash received
              </label>
              <input
                id="tendered"
                type="number"
                min={0}
                step="1"
                value={s.amountTendered}
                onChange={(e) => s.setField('amountTendered', e.target.value)}
                placeholder={totals.grandTotal.toFixed(2)}
                className="num h-9 flex-1 rounded-lg border border-ink-200 px-3 text-right text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
              />
            </div>
            {quickCash.length > 0 && (
              <div className="flex gap-1.5 pl-30">
                {quickCash.map((v) => (
                  <button key={v} onClick={() => s.setField('amountTendered', String(v))} className="num rounded-md border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-50">
                    {formatINR(v).replace('.00', '')}
                  </button>
                ))}
              </div>
            )}
            {change !== undefined && (
              <div className={cn('flex justify-between rounded-lg px-3 py-2 text-[13px] font-semibold', change >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
                <span>{change >= 0 ? 'Change to return' : 'Amount short'}</span>
                <span className="num">{formatINR(Math.abs(change))}</span>
              </div>
            )}
          </div>
        ) : (
          <input
            value={s.paymentReference}
            onChange={(e) => s.setField('paymentReference', e.target.value)}
            placeholder={s.paymentMethod === 'UPI' ? 'UPI transaction ID (optional)' : s.paymentMethod === 'CARD' ? 'Card last 4 / approval code (optional)' : 'Payment reference'}
            aria-label="Payment reference"
            className="mt-3 h-9 w-full rounded-lg border border-ink-200 px-3 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
          />
        )}
        </>)}

        <button onClick={() => setShowMore((v) => !v)} className="mt-3 flex w-full items-center justify-between text-[13px] font-medium text-ink-600 hover:text-ink-900" aria-expanded={showMore || hasRx}>
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Prescription & notes {hasRx && <span className="rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">Rx in cart</span>}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition', (showMore || hasRx) && 'rotate-180')} />
        </button>
        {(showMore || hasRx) && (
          <div className="mt-2 space-y-2">
            <input
              value={s.prescriptionRef}
              onChange={(e) => s.setField('prescriptionRef', e.target.value)}
              placeholder="Prescription ref / doctor name"
              aria-label="Prescription reference"
              className="h-9 w-full rounded-lg border border-ink-200 px-3 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            />
            <textarea
              value={s.notes}
              onChange={(e) => s.setField('notes', e.target.value)}
              rows={2}
              placeholder="Notes (printed on invoice)"
              aria-label="Notes"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            />
          </div>
        )}
      </section>

      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((i) => (
            <Alert key={i.message} tone={i.level === 'error' ? 'danger' : 'warning'}>
              {i.message}
            </Alert>
          ))}
        </div>
      )}

      <Button size="lg" className="h-14 w-full text-base" disabled={s.lines.length === 0 || errors.length > 0} loading={submitting} onClick={onComplete}>
        {s.chargeAccount && billToAccount ? 'Bill to account' : 'Complete sale'} · {formatINR(totals.grandTotal)}
      </Button>
      <p className="-mt-2 text-center text-[11px] text-ink-400">Ctrl + Enter to complete · F2 to search</p>
    </div>
  )
}
