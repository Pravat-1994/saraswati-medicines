import { isWithinRange } from '../../lib/dates'
import { fefoBatch, isExpired } from '../../lib/inventory'
import { sumMoney } from '../../lib/money'
import { refundForQuantity } from '../../lib/pricing'
import { priceSale, WALK_IN_CUSTOMER, type PricedLineInput } from '../../lib/sales'
import { newId } from '../../lib/utils'
import { actorCan, getActor, requirePermission } from '../../services/core/actor'
import { ServiceError, type CreateReturnRequest, type CreateSaleRequest, type ListQuery, type PagedResult, type SaleFilters } from '../../types/api'
import type { ApprovalStatus, Sale, SaleReturn } from '../../types/domain'
import type { SaleDetail, SaleListItem } from '../../types/views'
import { getDb, mutate, nextDocumentNumber } from '../db'
import { applySort, findOrThrow, matches, paginate, recordMovement, toSaleListItem } from '../helpers'
import type { DemoDatabase } from '../seed'

export function listSales(query: ListQuery<SaleFilters>): PagedResult<SaleListItem> {
  const db = getDb()
  const f = query.filters ?? {}
  let rows = db.sales.filter(
    (s) =>
      (!f.range || isWithinRange(s.date, f.range)) &&
      (!f.paymentMethod || f.paymentMethod === 'ALL' || s.paymentMethod === f.paymentMethod) &&
      (!f.status || f.status === 'ALL' || s.status === f.status) &&
      (!f.customerId || s.customerId === f.customerId) &&
      matches(query.search, s.invoiceNumber, s.customerName, s.customerPhone, s.cashierName, ...s.items.map((i) => i.medicineName)),
  )
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  rows = applySort(rows, query, {
    date: (s) => s.date,
    invoice: (s) => s.invoiceNumber,
    customer: (s) => s.customerName,
    total: (s) => s.grandTotal,
    payment: (s) => s.paymentMethod,
  })
  return paginate(rows.map(toSaleListItem), query)
}

export function getSale(id: string): SaleDetail {
  const db = getDb()
  const sale = db.sales.find((s) => s.id === id || s.invoiceNumber === id)
  if (!sale) throw new ServiceError('Sale not found.', 'NOT_FOUND', 404)
  return { sale, returns: db.returns.filter((r) => r.saleId === sale.id) }
}

export function createSale(req: CreateSaleRequest): Sale {
  requirePermission('sales.pos', 'create sales')
  return mutate((db) => recordSaleInDb(db, req))
}

/**
 * Validates, prices and records a sale inside an open mutation (deducts stock,
 * writes ledger entries). Shared by the POS and online-order fulfilment.
 * `preAllocated`: batches were already chosen FEFO when stock was reserved.
 */
export function recordSaleInDb(db: DemoDatabase, req: CreateSaleRequest, opts: { preAllocated?: boolean } = {}): Sale {
  if (req.lines.length === 0) throw new ServiceError('Add at least one medicine to the bill.', 'VALIDATION', 422)
  const actor = getActor()
  const maxDiscount = actor.maxDiscountPct
  if (req.billDiscountPct < 0 || req.billDiscountPct > maxDiscount) {
    throw new ServiceError(`Bill discount cannot exceed ${maxDiscount}% for your role.`, 'DISCOUNT_LIMIT', 422)
  }
  {
    const requested = new Map<string, number>()
    const priced: PricedLineInput[] = req.lines.map((line) => {
      const medicine = findOrThrow(db.medicines, line.medicineId, 'Medicine')
      const batch = findOrThrow(db.batches, line.batchId, 'Batch')
      if (batch.medicineId !== medicine.id) throw new ServiceError('Batch does not belong to the selected medicine.', 'VALIDATION', 422)
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new ServiceError(`Invalid quantity for ${medicine.name}.`, 'VALIDATION', 422)
      if (isExpired(batch)) throw new ServiceError(`${medicine.name} batch ${batch.batchNumber} has expired and cannot be sold.`, 'EXPIRED_STOCK', 422)
      if (line.discountPct < 0 || line.discountPct > maxDiscount) {
        throw new ServiceError(`Discount on ${medicine.name} exceeds the ${maxDiscount}% allowed for your role.`, 'DISCOUNT_LIMIT', 422)
      }
      const total = (requested.get(batch.id) ?? 0) + line.quantity
      requested.set(batch.id, total)
      if (total > batch.quantity) {
        throw new ServiceError(`Only ${batch.quantity} units of ${medicine.name} (batch ${batch.batchNumber}) are available.`, 'INSUFFICIENT_STOCK', 409)
      }
      const fefo = fefoBatch(db.batches.filter((b) => b.medicineId === medicine.id))
      const overridden = !opts.preAllocated && !!fefo && fefo.id !== batch.id
      if (overridden && !actorCan('sales.overrideFefo')) {
        throw new ServiceError(`FEFO requires batch ${fefo.batchNumber} for ${medicine.name}. Your role cannot override FEFO.`, 'FEFO_OVERRIDE', 403)
      }
      return { medicine, batch, quantity: line.quantity, discountPct: line.discountPct, fefoOverridden: overridden }
    })
    const { items, totals, costTotal } = priceSale(priced, req.billDiscountPct, db.settings)
    if (req.paymentMethod === 'CASH' && req.amountTendered !== undefined && req.amountTendered + 0.001 < totals.grandTotal) {
      throw new ServiceError('Cash tendered is less than the bill amount.', 'VALIDATION', 422)
    }
    const customer = req.customerId ? findOrThrow(db.customers, req.customerId, 'Customer') : undefined
    const sale: Sale = {
      id: newId('sal'),
      invoiceNumber: nextDocumentNumber(db, 'invoice', db.settings.invoicePrefix),
      date: new Date().toISOString(),
      customerId: customer?.id,
      customerName: customer?.name ?? (req.customerName?.trim() || WALK_IN_CUSTOMER),
      customerPhone: customer?.phone ?? req.customerPhone,
      items,
      billDiscountPct: req.billDiscountPct,
      ...totals,
      costTotal,
      paymentMethod: req.paymentMethod,
      paymentReference: req.paymentReference,
      amountTendered: req.amountTendered,
      changeReturned: req.amountTendered !== undefined ? Math.max(0, Math.round((req.amountTendered - totals.grandTotal) * 100) / 100) : undefined,
      status: 'COMPLETED',
      cashierId: actor.id,
      cashierName: actor.name,
      prescriptionRef: req.prescriptionRef,
      notes: req.notes,
      prescriptionId: req.prescriptionId,
      patientId: req.patientId,
      patientAccountId: req.patientAccountId,
    }
    for (const item of items) {
      const batch = findOrThrow(db.batches, item.batchId, 'Batch')
      recordMovement(db, batch, 'SALE_OUT', -item.quantity, { referenceType: 'SALE', referenceId: sale.id, referenceNumber: sale.invoiceNumber, reason: item.fefoOverridden ? 'FEFO override' : undefined })
    }
    db.sales.unshift(sale)
    return sale
  }
}

export function listReturns(status?: ApprovalStatus | 'ALL'): SaleReturn[] {
  return getDb()
    .returns.filter((r) => !status || status === 'ALL' || r.status === status)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Units of a sale line still eligible for return (excluding pending requests). */
export function returnableQuantity(db: DemoDatabase, sale: Sale, lineId: string): number {
  const item = sale.items.find((i) => i.lineId === lineId)
  if (!item) return 0
  const pending = db.returns
    .filter((r) => r.saleId === sale.id && r.status === 'PENDING')
    .flatMap((r) => r.items)
    .filter((i) => i.lineId === lineId)
    .reduce((a, i) => a + i.quantity, 0)
  return Math.max(0, item.quantity - item.returnedQuantity - pending)
}

function applyReturn(db: DemoDatabase, ret: SaleReturn): void {
  const sale = findOrThrow(db.sales, ret.saleId, 'Sale')
  for (const line of ret.items) {
    const item = sale.items.find((i) => i.lineId === line.lineId)
    if (!item) throw new ServiceError('Return line does not match the original sale.', 'VALIDATION', 422)
    if (item.returnedQuantity + line.quantity > item.quantity) throw new ServiceError(`Cannot return more ${item.medicineName} than was sold.`, 'VALIDATION', 422)
    item.returnedQuantity += line.quantity
    if (line.restock) {
      const batch = db.batches.find((b) => b.id === line.batchId)
      if (batch && !isExpired(batch)) {
        recordMovement(db, batch, 'RETURN_IN', line.quantity, { referenceType: 'RETURN', referenceId: ret.id, referenceNumber: ret.returnNumber, reason: ret.reason, authorizedBy: ret.decidedBy })
      }
    }
  }
  sale.status = sale.items.every((i) => i.returnedQuantity >= i.quantity) ? 'RETURNED' : 'PARTIALLY_RETURNED'
}

export function requestReturn(req: CreateReturnRequest): SaleReturn {
  requirePermission('returns.request', 'process returns')
  if (!req.reason.trim()) throw new ServiceError('A reason is required for every return.', 'VALIDATION', 422)
  return mutate((db) => {
    const sale = findOrThrow(db.sales, req.saleId, 'Sale')
    const lines = req.lines.filter((l) => l.quantity > 0)
    if (lines.length === 0) throw new ServiceError('Select at least one item to return.', 'VALIDATION', 422)
    const items = lines.map((l) => {
      const item = sale.items.find((i) => i.lineId === l.lineId)
      if (!item) throw new ServiceError('Return line does not match the original sale.', 'VALIDATION', 422)
      const max = returnableQuantity(db, sale, l.lineId)
      if (l.quantity > max) throw new ServiceError(`Only ${max} unit(s) of ${item.medicineName} can be returned.`, 'VALIDATION', 422)
      const batch = db.batches.find((b) => b.id === item.batchId)
      return {
        lineId: item.lineId,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        quantity: l.quantity,
        refundAmount: refundForQuantity(item.lineTotal, item.quantity, l.quantity),
        restock: l.restock && !!batch && !isExpired(batch),
      }
    })
    const totalRefund = sumMoney(items.map((i) => i.refundAmount))
    const actor = getActor()
    const threshold = db.settings.returnApprovalThreshold
    const autoApprove = actorCan('returns.approve') || (threshold > 0 && totalRefund <= threshold)
    const now = new Date().toISOString()
    const ret: SaleReturn = {
      id: newId('ret'),
      returnNumber: nextDocumentNumber(db, 'return', 'RET'),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: now,
      customerName: sale.customerName,
      items,
      totalRefund,
      refundMethod: req.refundMethod,
      reason: req.reason.trim(),
      status: autoApprove ? 'APPROVED' : 'PENDING',
      requestedBy: actor.name,
      decidedBy: autoApprove ? actor.name : undefined,
      decidedAt: autoApprove ? now : undefined,
      decisionNote: autoApprove ? (actorCan('returns.approve') ? 'Approved by authorised role.' : 'Auto-approved (within threshold).') : undefined,
    }
    db.returns.unshift(ret)
    if (autoApprove) applyReturn(db, ret)
    return ret
  })
}

export function decideReturn(id: string, approve: boolean, note?: string): SaleReturn {
  requirePermission('returns.approve', 'approve returns')
  return mutate((db) => {
    const ret = findOrThrow(db.returns, id, 'Return')
    if (ret.status !== 'PENDING') throw new ServiceError('This return has already been decided.', 'INVALID_STATE', 409)
    ret.status = approve ? 'APPROVED' : 'REJECTED'
    ret.decidedBy = getActor().name
    ret.decidedAt = new Date().toISOString()
    ret.decisionNote = note
    if (approve) applyReturn(db, ret)
    return ret
  })
}

export function returnableLines(saleId: string): { lineId: string; returnable: number }[] {
  const db = getDb()
  const sale = findOrThrow(db.sales, saleId, 'Sale')
  return sale.items.map((i) => ({ lineId: i.lineId, returnable: returnableQuantity(db, sale, i.lineId) }))
}
