import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { EXPIRY_STATUS_LABEL, STOCK_STATUS_LABEL } from '../../lib/inventory'
import { PO_STATUS_LABEL } from '../../lib/purchases'
import type { ApprovalStatus, ExpiryStatus, PaymentStatus, PurchaseOrderStatus, SaleStatus, StockStatus } from '../../types/domain'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'violet'

const tones: Record<BadgeTone, { box: string; dot: string }> = {
  neutral: { box: 'bg-ink-100 text-ink-700 ring-ink-200/60', dot: 'bg-ink-400' },
  brand: { box: 'bg-brand-50 text-brand-800 ring-brand-200/70', dot: 'bg-brand-500' },
  success: { box: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70', dot: 'bg-emerald-500' },
  warning: { box: 'bg-amber-50 text-amber-800 ring-amber-200/80', dot: 'bg-amber-500' },
  danger: { box: 'bg-red-50 text-red-700 ring-red-200/70', dot: 'bg-red-500' },
  info: { box: 'bg-sky-50 text-sky-800 ring-sky-200/70', dot: 'bg-sky-500' },
  accent: { box: 'bg-accent-50 text-accent-700 ring-accent-200/70', dot: 'bg-accent-500' },
  violet: { box: 'bg-violet-50 text-violet-700 ring-violet-200/70', dot: 'bg-violet-500' },
}

export function Badge({ tone = 'neutral', dot, children, className, icon }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', tones[tone].box, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', tones[tone].dot)} aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

const stockTone: Record<StockStatus, BadgeTone> = { IN_STOCK: 'success', LOW_STOCK: 'warning', OUT_OF_STOCK: 'danger' }
export const StockBadge = ({ status }: { status: StockStatus }) => (
  <Badge tone={stockTone[status]} dot>
    {STOCK_STATUS_LABEL[status]}
  </Badge>
)

const expiryTone: Record<ExpiryStatus, BadgeTone> = { OK: 'neutral', NEAR_EXPIRY: 'warning', CRITICAL: 'accent', EXPIRED: 'danger' }
export const ExpiryBadge = ({ status, days }: { status: ExpiryStatus; days?: number }) => (
  <Badge tone={expiryTone[status]} dot>
    {status === 'OK' ? 'Good' : status === 'EXPIRED' ? 'Expired' : days !== undefined ? `${days}d left` : EXPIRY_STATUS_LABEL[status]}
  </Badge>
)

const poTone: Record<PurchaseOrderStatus, BadgeTone> = { DRAFT: 'neutral', ORDERED: 'info', PARTIALLY_RECEIVED: 'warning', RECEIVED: 'success', CANCELLED: 'danger' }
export const PoStatusBadge = ({ status }: { status: PurchaseOrderStatus }) => (
  <Badge tone={poTone[status]} dot>
    {PO_STATUS_LABEL[status]}
  </Badge>
)

const payTone: Record<PaymentStatus, BadgeTone> = { UNPAID: 'danger', PARTIAL: 'warning', PAID: 'success' }
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge tone={payTone[status]}>{status === 'PARTIAL' ? 'Partially paid' : status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge>
)

const approvalTone: Record<ApprovalStatus, BadgeTone> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
export const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => (
  <Badge tone={approvalTone[status]} dot>
    {status === 'PENDING' ? 'Pending approval' : status === 'APPROVED' ? 'Approved' : 'Rejected'}
  </Badge>
)

const saleTone: Record<SaleStatus, BadgeTone> = { COMPLETED: 'success', PARTIALLY_RETURNED: 'warning', RETURNED: 'neutral' }
export const SaleStatusBadge = ({ status }: { status: SaleStatus }) => (
  <Badge tone={saleTone[status]}>{status === 'COMPLETED' ? 'Completed' : status === 'RETURNED' ? 'Returned' : 'Partly returned'}</Badge>
)
