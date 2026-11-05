/** Purchase order pricing and payable calculations. */
import { computePurchaseLine } from './pricing'
import { fromPaise, round2, sumMoney, toPaise } from './money'
import { newId } from './utils'
import type { PurchaseCharge, PurchaseOrder, PurchaseOrderItem } from '../types/domain'
import type { PurchaseOrderItemInput } from '../types/api'

export interface PricedPurchaseOrder {
  items: PurchaseOrderItem[]
  subtotal: number
  discountTotal: number
  gstTotal: number
  chargesTotal: number
  grandTotal: number
}

export function pricePurchaseOrder(
  inputs: (PurchaseOrderItemInput & { medicineName: string; id?: string; receivedQty?: number })[],
  charges: PurchaseCharge[],
): PricedPurchaseOrder {
  const items: PurchaseOrderItem[] = inputs.map((i) => {
    const a = computePurchaseLine(i.purchasePrice, i.orderedQty, i.discountPct, i.gstRate)
    return {
      id: i.id ?? newId('poi'),
      medicineId: i.medicineId,
      medicineName: i.medicineName,
      orderedQty: i.orderedQty,
      receivedQty: i.receivedQty ?? 0,
      freeQty: i.freeQty,
      purchasePrice: i.purchasePrice,
      discountPct: i.discountPct,
      gstRate: i.gstRate,
      taxableAmount: a.taxableAmount,
      gstAmount: a.gstAmount,
      lineTotal: a.lineTotal,
    }
  })
  const subtotal = sumMoney(inputs.map((i) => i.purchasePrice * i.orderedQty))
  const taxable = sumMoney(items.map((i) => i.taxableAmount))
  const gstTotal = sumMoney(items.map((i) => i.gstAmount))
  const chargesTotal = sumMoney(charges.map((c) => c.amount))
  return {
    items,
    subtotal,
    discountTotal: round2(subtotal - taxable),
    gstTotal,
    chargesTotal,
    grandTotal: sumMoney([taxable, gstTotal, chargesTotal]),
  }
}

/** Value of goods received so far (charges are payable once anything is received). */
export function poReceivedValue(po: PurchaseOrder): number {
  if (po.status === 'RECEIVED') return po.grandTotal
  const received = po.items.reduce((acc, i) => {
    if (i.orderedQty <= 0) return acc
    return acc + Math.round((toPaise(i.lineTotal) * Math.min(i.receivedQty, i.orderedQty)) / i.orderedQty)
  }, 0)
  if (received === 0) return 0
  return fromPaise(received + toPaise(po.chargesTotal))
}

/** Amount currently owed to the supplier for this PO. */
export const poOutstanding = (po: PurchaseOrder): number =>
  po.status === 'CANCELLED' || po.status === 'DRAFT' ? 0 : Math.max(0, round2(poReceivedValue(po) - po.amountPaid))

export function paymentStatusFor(po: PurchaseOrder): PurchaseOrder['paymentStatus'] {
  const payable = poReceivedValue(po)
  if (po.amountPaid <= 0) return 'UNPAID'
  if (po.amountPaid + 0.005 >= payable && payable > 0) return 'PAID'
  return 'PARTIAL'
}

export const PO_STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}
