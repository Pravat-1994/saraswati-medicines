/**
 * Pricing & GST engine. The single source of truth for every amount shown on
 * POS, invoices, purchase orders, reports and the dashboard.
 *
 * All intermediate values are integer paise; results are rupees (2 decimals).
 * NOTE: Tax treatment is configurable (`pricesIncludeGst`) and must be reviewed
 * by the store's accountant before production use.
 */
import { fromPaise, toPaise } from './money'

export interface LineInput {
  unitPrice: number
  quantity: number
  /** Line-level discount %. */
  discountPct: number
  /** Bill-level discount % applied after the line discount. */
  billDiscountPct?: number
  gstRate: number
  pricesIncludeGst: boolean
}

export interface LineAmounts {
  grossAmount: number
  discountAmount: number
  taxableAmount: number
  gstAmount: number
  lineTotal: number
}

interface PaiseAmounts {
  gross: number
  discount: number
  taxable: number
  gst: number
  total: number
}

function computePaise(input: LineInput): PaiseAmounts {
  const gross = toPaise(input.unitPrice) * input.quantity
  const lineDisc = Math.round((gross * input.discountPct) / 100)
  const afterLine = gross - lineDisc
  const billDisc = Math.round((afterLine * (input.billDiscountPct ?? 0)) / 100)
  const discount = lineDisc + billDisc
  const net = gross - discount
  if (input.pricesIncludeGst) {
    const taxable = Math.round((net * 100) / (100 + input.gstRate))
    return { gross, discount, taxable, gst: net - taxable, total: net }
  }
  const gst = Math.round((net * input.gstRate) / 100)
  return { gross, discount, taxable: net, gst, total: net + gst }
}

export function computeLine(input: LineInput): LineAmounts {
  const p = computePaise(input)
  return {
    grossAmount: fromPaise(p.gross),
    discountAmount: fromPaise(p.discount),
    taxableAmount: fromPaise(p.taxable),
    gstAmount: fromPaise(p.gst),
    lineTotal: fromPaise(p.total),
  }
}

export interface InvoiceTotals {
  subtotal: number
  discountTotal: number
  taxableTotal: number
  gstTotal: number
  cgstTotal: number
  sgstTotal: number
  roundOff: number
  grandTotal: number
  /** GST summary grouped by rate, as printed on the invoice. */
  gstBreakup: { rate: number; taxable: number; cgst: number; sgst: number; total: number }[]
}

export function computeInvoice(lines: (LineAmounts & { gstRate: number })[], roundOff: boolean): InvoiceTotals {
  let gross = 0
  let discount = 0
  let taxable = 0
  let gst = 0
  let cgst = 0
  let total = 0
  const breakup = new Map<number, { taxable: number; cgst: number; sgst: number }>()
  lines.forEach((l) => {
    const rate = l.gstRate
    const lg = toPaise(l.gstAmount)
    const lc = Math.floor(lg / 2)
    gross += toPaise(l.grossAmount)
    discount += toPaise(l.discountAmount)
    taxable += toPaise(l.taxableAmount)
    gst += lg
    cgst += lc
    total += toPaise(l.lineTotal)
    const b = breakup.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0 }
    b.taxable += toPaise(l.taxableAmount)
    b.cgst += lc
    b.sgst += lg - lc
    breakup.set(rate, b)
  })
  const rounded = roundOff ? Math.round(total / 100) * 100 : total
  return {
    subtotal: fromPaise(gross),
    discountTotal: fromPaise(discount),
    taxableTotal: fromPaise(taxable),
    gstTotal: fromPaise(gst),
    cgstTotal: fromPaise(cgst),
    sgstTotal: fromPaise(gst - cgst),
    roundOff: fromPaise(rounded - total),
    grandTotal: fromPaise(rounded),
    gstBreakup: [...breakup.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, b]) => ({
        rate,
        taxable: fromPaise(b.taxable),
        cgst: fromPaise(b.cgst),
        sgst: fromPaise(b.sgst),
        total: fromPaise(b.cgst + b.sgst),
      })),
  }
}

/** Purchase lines: supplier prices are GST-exclusive. */
export function computePurchaseLine(purchasePrice: number, qty: number, discountPct: number, gstRate: number): LineAmounts {
  return computeLine({ unitPrice: purchasePrice, quantity: qty, discountPct, gstRate, pricesIncludeGst: false })
}

/** Margin % on selling price. */
export function marginPct(sellingPrice: number, cost: number): number {
  if (sellingPrice <= 0) return 0
  return ((sellingPrice - cost) / sellingPrice) * 100
}

/** Proportional refund for `qty` units of a sale line. */
export function refundForQuantity(lineTotal: number, soldQty: number, qty: number): number {
  if (soldQty <= 0) return 0
  return fromPaise(Math.round((toPaise(lineTotal) * qty) / soldQty))
}
