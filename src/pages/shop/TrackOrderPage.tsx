import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { CheckCircle2, Circle, PackageSearch, PartyPopper, XCircle } from 'lucide-react'
import { errorMessage } from '../../hooks/useQuery'
import { shopService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { ORDER_STATUS_CUSTOMER, orderSteps } from '../../lib/orders'
import { recentOrders } from '../../stores/shopCartStore'
import type { OrderTracking } from '../../types/views'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'

interface NavState {
  tracking?: OrderTracking
  phone?: string
  justPlaced?: boolean
}

function Timeline({ t }: { t: OrderTracking }) {
  if (t.status === 'CANCELLED') {
    return (
      <Alert tone="danger" icon={<XCircle className="h-4 w-4" />} title="This order was cancelled">
        {t.cancelReason}
      </Alert>
    )
  }
  const steps = orderSteps(t.fulfilment)
  const current = steps.indexOf(t.status)
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((s, i) => {
        const done = i <= current
        const at = t.timeline.find((e) => e.status === s)?.at
        return (
          <li key={s} className={cn('relative flex items-start gap-3 rounded-xl border p-3 sm:flex-col sm:gap-2', done ? 'border-brand-200 bg-brand-50/60' : 'border-ink-200 bg-white')}>
            {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" /> : <Circle className="h-5 w-5 shrink-0 text-ink-300" />}
            <div>
              <div className={cn('text-[13px] font-semibold', done ? 'text-ink-900' : 'text-ink-400')}>{ORDER_STATUS_CUSTOMER[s]}</div>
              <div className="text-[11px] text-ink-500">{at ? formatDateTime(at) : i === current + 1 ? 'Next' : ''}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function TrackOrderPage() {
  const state = (useLocation().state ?? {}) as NavState
  const [orderNumber, setOrderNumber] = useState(state.tracking?.orderNumber ?? recentOrders.list()[0] ?? '')
  const [phone, setPhone] = useState(state.phone ?? '')
  const [result, setResult] = useState<OrderTracking | undefined>(state.tracking)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!orderNumber.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Enter your order number and the 10-digit mobile number used to order.')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      setResult(await shopService.track(orderNumber, phone))
    } catch (err) {
      setResult(undefined)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {state.justPlaced && result && (
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-card">
          <PartyPopper className="mx-auto h-8 w-8 text-emerald-600" />
          <h1 className="mt-2 font-display text-2xl font-bold text-ink-950">Thank you, your order is placed!</h1>
          <p className="mt-1 text-sm text-ink-600">
            Order <span className="font-mono font-semibold text-ink-900">{result.orderNumber}</span>. We’ll call you once it’s confirmed
            {result.prescriptionRequired ? ' and your prescription is verified' : ''}. Keep this number to track your order.
          </p>
        </div>
      )}
      {!state.justPlaced && <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">Track your order</h1>}

      <form onSubmit={lookup} className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order number">{(id) => <Input id={id} className="font-mono uppercase" placeholder="WEB/26-27/00001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />}</Field>
          <Field label="Mobile number">{(id) => <Input id={id} inputMode="tel" placeholder="Used when ordering" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Button type="submit" icon={<PackageSearch className="h-4 w-4" />} loading={loading}>
            Track
          </Button>
        </div>
        {error && <p className="mt-3 text-[13px] font-medium text-red-600" role="alert">{error}</p>}
      </form>

      {result && (
        <section className="space-y-4 rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm font-semibold text-ink-900">{result.orderNumber}</div>
              <div className="text-xs text-ink-500">
                Placed {formatDateTime(result.placedAt)} · {result.fulfilment === 'DELIVERY' ? 'Home delivery' : 'Store pickup'}
              </div>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">{ORDER_STATUS_CUSTOMER[result.status]}</span>
          </div>
          <Timeline t={result} />
          {result.prescriptionRequired && result.status === 'PLACED' && (
            <Alert tone={result.prescriptionVerified ? 'success' : 'info'}>{result.prescriptionVerified ? 'Prescription verified by our pharmacist.' : 'Waiting for our pharmacist to verify your prescription.'}</Alert>
          )}
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {result.items.map((i) => (
              <li key={i.medicineName} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span>
                  <span className="font-medium text-ink-900">{i.medicineName}</span> <span className="text-ink-500">× {i.quantity} · {i.packSize}</span>
                </span>
                <span className="num font-semibold">{formatINR(i.lineTotal)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
              <span>{result.invoiceNumber ? `Invoice ${result.invoiceNumber}` : 'Estimated total'}</span>
              <span className="num">{formatINR(result.estimatedTotal)}</span>
            </li>
          </ul>
          <div className="text-center">
            <Link to="/shop" className="text-[13px] font-semibold text-brand-700 hover:underline">
              Continue shopping →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
