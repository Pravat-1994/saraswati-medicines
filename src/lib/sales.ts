/**
 * Builds priced sale lines & invoice totals. Shared by the POS screen (live
 * preview), the mock sales service (authoritative in demo mode) and the seed
 * generator so every amount is calculated identically.
 */
import { computeInvoice, computeLine, type InvoiceTotals } from './pricing'
import { sumMoney } from './money'
import { newId } from './utils'
import type { AppSettings, Batch, Medicine, SaleItem } from '../types/domain'

export interface PricedLineInput {
  medicine: Pick<Medicine, 'id' | 'name' | 'code' | 'hsnCode' | 'gstRate'>
  batch: Pick<Batch, 'id' | 'batchNumber' | 'expiryDate' | 'sellingPrice' | 'purchasePrice'>
  quantity: number
  discountPct: number
  fefoOverridden?: boolean
  lineId?: string
}

export interface PricedSale {
  items: SaleItem[]
  totals: InvoiceTotals
  costTotal: number
}

export function priceSale(
  lines: PricedLineInput[],
  billDiscountPct: number,
  settings: Pick<AppSettings, 'pricesIncludeGst' | 'roundOffInvoice'>,
): PricedSale {
  const items: SaleItem[] = lines.map((l) => {
    const amounts = computeLine({
      unitPrice: l.batch.sellingPrice,
      quantity: l.quantity,
      discountPct: l.discountPct,
      billDiscountPct,
      gstRate: l.medicine.gstRate,
      pricesIncludeGst: settings.pricesIncludeGst,
    })
    return {
      lineId: l.lineId ?? newId('ln'),
      medicineId: l.medicine.id,
      medicineName: l.medicine.name,
      medicineCode: l.medicine.code,
      hsnCode: l.medicine.hsnCode,
      batchId: l.batch.id,
      batchNumber: l.batch.batchNumber,
      expiryDate: l.batch.expiryDate,
      quantity: l.quantity,
      unitPrice: l.batch.sellingPrice,
      discountPct: l.discountPct,
      gstRate: l.medicine.gstRate,
      ...amounts,
      unitCost: l.batch.purchasePrice,
      returnedQuantity: 0,
      fefoOverridden: l.fefoOverridden || undefined,
    }
  })
  const totals = computeInvoice(items, settings.roundOffInvoice)
  const costTotal = sumMoney(items.map((i) => i.unitCost * i.quantity))
  return { items, totals, costTotal }
}

export const PAYMENT_METHOD_LABEL = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
} as const

export const WALK_IN_CUSTOMER = 'Walk-in Customer'
