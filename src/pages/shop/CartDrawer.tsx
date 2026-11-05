import { useNavigate } from 'react-router'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatINR, sumMoney } from '../../lib/money'
import { useShopCart } from '../../stores/shopCartStore'
import type { ShopInfo } from '../../types/views'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'

export function QtyControl({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white">
      <button onClick={() => onChange(value - 1)} disabled={value <= 1} className="flex h-8 w-8 items-center justify-center text-ink-500 hover:bg-ink-50 disabled:opacity-30" aria-label={`Decrease ${label}`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="num w-8 text-center text-sm font-semibold" aria-label={`${label} quantity`}>
        {value}
      </span>
      <button onClick={() => onChange(value + 1)} disabled={value >= max} className="flex h-8 w-8 items-center justify-center text-ink-500 hover:bg-ink-50 disabled:opacity-30" aria-label={`Increase ${label}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function CartDrawer({ info }: { info?: ShopInfo }) {
  const { lines, open, setOpen, setQty, remove } = useShopCart()
  const navigate = useNavigate()
  const total = sumMoney(lines.map((l) => l.product.price * l.quantity))
  const belowMin = !!info && info.minOrderValue > 0 && total < info.minOrderValue

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      drawer
      title="Your cart"
      description={lines.length ? `${lines.length} item${lines.length === 1 ? '' : 's'}` : undefined}
      icon={<ShoppingBag className="h-4 w-4" />}
      footer={
        lines.length > 0 && (
          <div className="w-full space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-sm text-ink-600">Estimated total</span>
              <span className="num font-display text-2xl font-bold text-ink-950">{formatINR(total)}</span>
            </div>
            {belowMin && <p className="text-xs font-medium text-amber-700">Minimum order value is {formatINR(info!.minOrderValue)}.</p>}
            <Button
              size="lg"
              className="w-full"
              disabled={belowMin || info?.ordersEnabled === false}
              onClick={() => {
                setOpen(false)
                navigate('/shop/checkout')
              }}
            >
              Proceed to checkout
            </Button>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Your cart is empty" description="Browse medicines and add them to your cart." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {lines.map((l) => (
            <li key={l.product.id} className="flex gap-3 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[11px] font-bold text-brand-700">{l.product.dosageForm.slice(0, 3).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink-900">{l.product.name}</span>
                  {l.product.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
                </div>
                <div className="text-xs text-ink-500">{l.product.packSize}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <QtyControl value={l.quantity} max={l.product.maxQty} onChange={(v) => setQty(l.product.id, v)} label={l.product.name} />
                  <span className="num font-semibold text-ink-900">{formatINR(l.product.price * l.quantity)}</span>
                </div>
              </div>
              <button onClick={() => remove(l.product.id)} className="self-start rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${l.product.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
