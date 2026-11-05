/** Purchases, suppliers and customers. */
import { isWithinRange } from '../../lib/dates'
import { isExpired } from '../../lib/inventory'
import { round2, sumMoney } from '../../lib/money'
import { paymentStatusFor, poOutstanding, pricePurchaseOrder } from '../../lib/purchases'
import { newId } from '../../lib/utils'
import { getActor, requirePermission } from '../../services/core/actor'
import {
  ServiceError,
  type DateRange,
  type ListQuery,
  type PagedResult,
  type PurchaseOrderInput,
  type ReceiveGoodsRequest,
  type SupplierPaymentInput,
} from '../../types/api'
import type { Batch, Customer, PurchaseOrder, PurchaseOrderStatus, Supplier, SupplierPayment } from '../../types/domain'
import type { CustomerDetail, CustomerListItem, PurchaseOrderListItem, SupplierDetail, SupplierListItem } from '../../types/views'
import { getDb, mutate, nextDocumentNumber } from '../db'
import { applySort, findOrThrow, matches, paginate, poReceivedValue, recordMovement, toPoListItem, toSaleListItem } from '../helpers'
import type { DemoDatabase } from '../seed'

// ───────────────────────────── Purchase orders ─────────────────────────────

export interface PurchaseFilters {
  status?: PurchaseOrderStatus | 'OPEN' | 'ALL'
  supplierId?: string
  range?: DateRange
  paymentStatus?: PurchaseOrder['paymentStatus'] | 'ALL'
}

const OPEN: PurchaseOrderStatus[] = ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED']

export function listPurchaseOrders(query: ListQuery<PurchaseFilters>): PagedResult<PurchaseOrderListItem> {
  const db = getDb()
  const f = query.filters ?? {}
  let rows = db.purchaseOrders.filter(
    (po) =>
      (!f.status || f.status === 'ALL' || (f.status === 'OPEN' ? OPEN.includes(po.status) : po.status === f.status)) &&
      (!f.supplierId || po.supplierId === f.supplierId) &&
      (!f.range || isWithinRange(po.orderDate, f.range)) &&
      (!f.paymentStatus || f.paymentStatus === 'ALL' || po.paymentStatus === f.paymentStatus) &&
      matches(query.search, po.poNumber, po.supplierName, po.supplierInvoiceNumber, ...po.items.map((i) => i.medicineName)),
  )
  rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const items = applySort(rows.map(toPoListItem), query, {
    poNumber: (p) => p.poNumber,
    supplier: (p) => p.supplierName,
    date: (p) => p.orderDate,
    total: (p) => p.grandTotal,
    outstanding: (p) => p.outstanding,
    status: (p) => p.status,
  })
  return paginate(items, query)
}

export function getPurchaseOrder(id: string): PurchaseOrder {
  return findOrThrow(getDb().purchaseOrders, id, 'Purchase order')
}

function buildPo(db: DemoDatabase, input: PurchaseOrderInput, existing?: PurchaseOrder): Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'createdBy'> {
  const supplier = findOrThrow(db.suppliers, input.supplierId, 'Supplier')
  if (!supplier.isActive) throw new ServiceError('Supplier is inactive.', 'VALIDATION', 422)
  if (input.items.length === 0) throw new ServiceError('Add at least one medicine to the purchase order.', 'VALIDATION', 422)
  const seen = new Set<string>()
  const priced = pricePurchaseOrder(
    input.items.map((i) => {
      if (seen.has(i.medicineId)) throw new ServiceError('Each medicine can appear only once per purchase order.', 'VALIDATION', 422)
      seen.add(i.medicineId)
      const m = findOrThrow(db.medicines, i.medicineId, 'Medicine')
      if (i.orderedQty <= 0) throw new ServiceError(`Quantity for ${m.name} must be greater than zero.`, 'VALIDATION', 422)
      const prev = existing?.items.find((x) => x.medicineId === i.medicineId)
      return { ...i, medicineName: m.name, id: prev?.id, receivedQty: prev?.receivedQty ?? 0 }
    }),
    input.charges.filter((c) => c.label.trim() && c.amount !== 0),
  )
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate,
    supplierInvoiceNumber: existing?.supplierInvoiceNumber,
    status: input.status,
    items: priced.items,
    charges: input.charges.filter((c) => c.label.trim() && c.amount !== 0),
    subtotal: priced.subtotal,
    discountTotal: priced.discountTotal,
    gstTotal: priced.gstTotal,
    chargesTotal: priced.chargesTotal,
    grandTotal: priced.grandTotal,
    amountPaid: existing?.amountPaid ?? 0,
    paymentStatus: existing?.paymentStatus ?? 'UNPAID',
    receipts: existing?.receipts ?? [],
    notes: input.notes,
  }
}

export function createPurchaseOrder(input: PurchaseOrderInput): PurchaseOrder {
  requirePermission('purchases.manage', 'create purchase orders')
  return mutate((db) => {
    const po: PurchaseOrder = {
      ...buildPo(db, input),
      id: newId('po'),
      poNumber: nextDocumentNumber(db, 'po', db.settings.poPrefix),
      createdAt: new Date().toISOString(),
      createdBy: getActor().name,
    }
    db.purchaseOrders.unshift(po)
    return po
  })
}

export function updatePurchaseOrder(id: string, input: PurchaseOrderInput): PurchaseOrder {
  requirePermission('purchases.manage', 'edit purchase orders')
  return mutate((db) => {
    const po = findOrThrow(db.purchaseOrders, id, 'Purchase order')
    if (po.receipts.length > 0 || !['DRAFT', 'ORDERED'].includes(po.status)) {
      throw new ServiceError('Only draft or ordered purchase orders without receipts can be edited.', 'INVALID_STATE', 409)
    }
    Object.assign(po, buildPo(db, input, po))
    return po
  })
}

export function setPurchaseOrderStatus(id: string, status: 'ORDERED' | 'CANCELLED'): PurchaseOrder {
  requirePermission('purchases.manage', 'change purchase order status')
  return mutate((db) => {
    const po = findOrThrow(db.purchaseOrders, id, 'Purchase order')
    if (status === 'ORDERED' && po.status !== 'DRAFT') throw new ServiceError('Only drafts can be placed.', 'INVALID_STATE', 409)
    if (status === 'CANCELLED' && po.receipts.length > 0) throw new ServiceError('Purchase orders with received goods cannot be cancelled.', 'INVALID_STATE', 409)
    if (status === 'CANCELLED' && po.status === 'CANCELLED') throw new ServiceError('Already cancelled.', 'INVALID_STATE', 409)
    po.status = status
    return po
  })
}

export function deletePurchaseOrder(id: string): void {
  requirePermission('purchases.manage', 'delete purchase orders')
  mutate((db) => {
    const po = findOrThrow(db.purchaseOrders, id, 'Purchase order')
    if (po.status !== 'DRAFT') throw new ServiceError('Only draft purchase orders can be deleted.', 'INVALID_STATE', 409)
    db.purchaseOrders = db.purchaseOrders.filter((p) => p.id !== id)
  })
}

/** Receive goods against a PO: creates/merges batches and increases stock. */
export function receiveGoods(req: ReceiveGoodsRequest): PurchaseOrder {
  requirePermission('purchases.receive', 'receive stock')
  if (!req.supplierInvoiceNumber.trim()) throw new ServiceError('Supplier invoice number is required.', 'VALIDATION', 422)
  return mutate((db) => {
    const po = findOrThrow(db.purchaseOrders, req.purchaseOrderId, 'Purchase order')
    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new ServiceError('Goods can only be received against ordered purchase orders.', 'INVALID_STATE', 409)
    const lines = req.lines.filter((l) => l.quantity > 0)
    if (lines.length === 0) throw new ServiceError('Enter a received quantity for at least one item.', 'VALIDATION', 422)
    const receiptNumber = nextDocumentNumber(db, 'grn', 'GRN')
    const receiptId = newId('grn')
    const receiptLines = lines.map((l) => {
      const item = po.items.find((i) => i.id === l.poItemId)
      if (!item) throw new ServiceError('Receipt line does not match the purchase order.', 'VALIDATION', 422)
      const pending = item.orderedQty + item.freeQty - item.receivedQty
      if (l.quantity > pending) throw new ServiceError(`Only ${pending} unit(s) of ${item.medicineName} are pending.`, 'VALIDATION', 422)
      if (!l.batchNumber.trim()) throw new ServiceError(`Batch number is required for ${item.medicineName}.`, 'VALIDATION', 422)
      if (l.expiryDate <= l.mfgDate) throw new ServiceError(`Expiry must be after manufacturing date for ${item.medicineName}.`, 'VALIDATION', 422)
      if (isExpired({ expiryDate: l.expiryDate })) throw new ServiceError(`${item.medicineName} batch ${l.batchNumber} is already expired.`, 'VALIDATION', 422)
      const medicine = findOrThrow(db.medicines, item.medicineId, 'Medicine')
      const batchNo = l.batchNumber.trim().toUpperCase()
      let batch: Batch | undefined = db.batches.find((b) => b.medicineId === item.medicineId && b.batchNumber === batchNo)
      if (batch && batch.expiryDate !== l.expiryDate) throw new ServiceError(`Batch ${batchNo} already exists with a different expiry date.`, 'BATCH_CONFLICT', 409)
      if (!batch) {
        batch = {
          id: newId('bat'),
          medicineId: item.medicineId,
          batchNumber: batchNo,
          mfgDate: l.mfgDate,
          expiryDate: l.expiryDate,
          purchasePrice: item.purchasePrice,
          sellingPrice: l.sellingPrice || medicine.sellingPrice,
          quantity: 0,
          reserved: 0,
          damaged: 0,
          location: medicine.storageInstructions.toLowerCase().includes('refrigerator') ? db.settings.locations.find((x) => /cold/i.test(x)) ?? db.settings.locations[0] : db.settings.locations[0],
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          receivedAt: new Date().toISOString(),
        }
        db.batches.push(batch)
      }
      recordMovement(db, batch, 'PURCHASE_IN', l.quantity, { referenceType: 'PURCHASE_RECEIPT', referenceId: po.id, referenceNumber: receiptNumber, reason: `Received against ${po.poNumber}` })
      item.receivedQty += l.quantity
      return { poItemId: item.id, medicineId: item.medicineId, batchId: batch.id, batchNumber: batch.batchNumber, mfgDate: l.mfgDate, expiryDate: l.expiryDate, quantity: l.quantity, sellingPrice: batch.sellingPrice }
    })
    po.receipts.push({ id: receiptId, receiptNumber, date: new Date().toISOString(), supplierInvoiceNumber: req.supplierInvoiceNumber.trim(), receivedBy: getActor().name, lines: receiptLines })
    po.supplierInvoiceNumber = req.supplierInvoiceNumber.trim()
    po.status = po.items.every((i) => i.receivedQty >= i.orderedQty) ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
    po.paymentStatus = paymentStatusFor(po)
    return po
  })
}

// ───────────────────────────────── Suppliers ─────────────────────────────────

function supplierStats(db: DemoDatabase, s: Supplier) {
  const pos = db.purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== 'CANCELLED' && p.status !== 'DRAFT')
  return {
    totalPurchases: sumMoney(pos.map(poReceivedValue)),
    outstanding: round2(sumMoney(pos.map(poOutstanding)) + s.openingBalance),
    orderCount: pos.length,
    openOrders: pos.filter((p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED').length,
    lastOrderDate: pos.map((p) => p.orderDate).sort().pop(),
  }
}

export function listSuppliers(query: ListQuery<{ status?: 'ACTIVE' | 'INACTIVE' | 'ALL'; withDues?: boolean }>): PagedResult<SupplierListItem> {
  const db = getDb()
  const f = query.filters ?? {}
  let rows: SupplierListItem[] = db.suppliers
    .filter(
      (s) =>
        matches(query.search, s.name, s.contactPerson, s.phone, s.gstin, s.address.city) &&
        (!f.status || f.status === 'ALL' || (f.status === 'ACTIVE' ? s.isActive : !s.isActive)),
    )
    .map((s) => ({ ...s, ...supplierStats(db, s) }))
  if (f.withDues) rows = rows.filter((s) => s.outstanding > 0)
  rows = applySort(rows, query, { name: (s) => s.name, outstanding: (s) => s.outstanding, purchases: (s) => s.totalPurchases, city: (s) => s.address.city }, 'name')
  return paginate(rows, query)
}

export function getSupplier(id: string): SupplierDetail {
  const db = getDb()
  const supplier = findOrThrow(db.suppliers, id, 'Supplier')
  const pos = db.purchaseOrders.filter((p) => p.supplierId === id)
  const supplied = new Map<string, { medicineName: string; units: number; value: number }>()
  pos.forEach((p) =>
    p.items.forEach((i) => {
      if (i.receivedQty <= 0) return
      const e = supplied.get(i.medicineId) ?? { medicineName: i.medicineName, units: 0, value: 0 }
      e.units += i.receivedQty
      e.value += (i.lineTotal * Math.min(i.receivedQty, i.orderedQty)) / Math.max(1, i.orderedQty)
      supplied.set(i.medicineId, e)
    }),
  )
  const stats = supplierStats(db, supplier)
  const payments = db.supplierPayments.filter((p) => p.supplierId === id).sort((a, b) => b.date.localeCompare(a.date))
  return {
    supplier,
    purchaseOrders: pos.map(toPoListItem),
    payments,
    totalPurchases: stats.totalPurchases,
    totalPaid: sumMoney(payments.map((p) => p.amount)),
    outstanding: stats.outstanding,
    medicinesSupplied: [...supplied.entries()].map(([medicineId, v]) => ({ medicineId, ...v, value: round2(v.value) })).sort((a, b) => b.value - a.value),
  }
}

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt'>

function validateSupplier(db: DemoDatabase, input: SupplierInput, id?: string) {
  if (db.suppliers.some((s) => s.gstin.toUpperCase() === input.gstin.toUpperCase() && s.id !== id)) {
    throw new ServiceError(`A supplier with GSTIN ${input.gstin} already exists.`, 'DUPLICATE', 409)
  }
}

export function createSupplier(input: SupplierInput): Supplier {
  requirePermission('suppliers.manage', 'add suppliers')
  return mutate((db) => {
    validateSupplier(db, input)
    const s: Supplier = { ...input, gstin: input.gstin.toUpperCase(), id: newId('sup'), createdAt: new Date().toISOString() }
    db.suppliers.push(s)
    return s
  })
}

export function updateSupplier(id: string, input: SupplierInput): Supplier {
  requirePermission('suppliers.manage', 'edit suppliers')
  return mutate((db) => {
    validateSupplier(db, input, id)
    const s = findOrThrow(db.suppliers, id, 'Supplier')
    Object.assign(s, input, { gstin: input.gstin.toUpperCase() })
    db.purchaseOrders.filter((p) => p.supplierId === id).forEach((p) => (p.supplierName = s.name))
    return s
  })
}

/** Records a supplier payment. Without a PO, the amount is allocated to the oldest outstanding orders first. */
export function recordSupplierPayment(input: SupplierPaymentInput): SupplierPayment[] {
  requirePermission('suppliers.payments', 'record supplier payments')
  if (input.amount <= 0) throw new ServiceError('Payment amount must be greater than zero.', 'VALIDATION', 422)
  return mutate((db) => {
    const supplier = findOrThrow(db.suppliers, input.supplierId, 'Supplier')
    const candidates = db.purchaseOrders
      .filter((p) => p.supplierId === supplier.id && poOutstanding(p) > 0 && (!input.purchaseOrderId || p.id === input.purchaseOrderId))
      .sort((a, b) => a.orderDate.localeCompare(b.orderDate))
    const openingDue = input.purchaseOrderId ? 0 : Math.max(0, supplier.openingBalance)
    const due = round2(sumMoney(candidates.map(poOutstanding)) + openingDue)
    if (input.amount > due + 0.005) throw new ServiceError(`Payment exceeds the outstanding amount of ₹${due.toFixed(2)}.`, 'VALIDATION', 422)
    let remaining = round2(input.amount)
    const created: SupplierPayment[] = []
    // Settle any opening balance first (oldest dues), then purchase orders.
    if (openingDue > 0) {
      const pay = Math.min(remaining, openingDue)
      supplier.openingBalance = round2(supplier.openingBalance - pay)
      remaining = round2(remaining - pay)
      const p: SupplierPayment = {
        id: newId('pay'),
        paymentNumber: nextDocumentNumber(db, 'payment', 'PAY'),
        supplierId: supplier.id,
        date: new Date().toISOString(),
        amount: round2(pay),
        method: input.method,
        reference: input.reference,
        note: input.note ? `${input.note} (opening balance)` : 'Against opening balance',
        recordedBy: getActor().name,
      }
      db.supplierPayments.unshift(p)
      created.push(p)
    }
    for (const po of candidates) {
      if (remaining <= 0) break
      const pay = Math.min(remaining, poOutstanding(po))
      po.amountPaid = round2(po.amountPaid + pay)
      po.paymentStatus = paymentStatusFor(po)
      remaining = round2(remaining - pay)
      const p: SupplierPayment = {
        id: newId('pay'),
        paymentNumber: nextDocumentNumber(db, 'payment', 'PAY'),
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        date: new Date().toISOString(),
        amount: round2(pay),
        method: input.method,
        reference: input.reference,
        note: input.note,
        recordedBy: getActor().name,
      }
      db.supplierPayments.unshift(p)
      created.push(p)
    }
    return created
  })
}

// ───────────────────────────────── Customers ─────────────────────────────────

function customerStats(db: DemoDatabase, id: string) {
  const sales = db.sales.filter((s) => s.customerId === id)
  return {
    totalSpent: sumMoney(sales.map((s) => s.grandTotal)),
    visits: sales.length,
    lastVisit: sales.map((s) => s.date).sort().pop(),
  }
}

export function listCustomers(query: ListQuery<{ segment?: 'ALL' | 'REGULAR' | 'NEW' | 'INACTIVE' }>): PagedResult<CustomerListItem> {
  const db = getDb()
  const seg = query.filters?.segment ?? 'ALL'
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let rows: CustomerListItem[] = db.customers
    .filter((c) => matches(query.search, c.name, c.phone, c.email, c.address))
    .map((c) => ({ ...c, ...customerStats(db, c.id) }))
  if (seg === 'REGULAR') rows = rows.filter((c) => c.visits >= 5)
  if (seg === 'NEW') rows = rows.filter((c) => c.createdAt >= monthAgo)
  if (seg === 'INACTIVE') rows = rows.filter((c) => !c.lastVisit || c.lastVisit < monthAgo)
  rows = applySort(rows, query, { name: (c) => c.name, spent: (c) => c.totalSpent, visits: (c) => c.visits, lastVisit: (c) => c.lastVisit ?? '' }, 'name')
  return paginate(rows, query)
}

export function getCustomer(id: string): CustomerDetail {
  const db = getDb()
  const customer = findOrThrow(db.customers, id, 'Customer')
  const sales = db.sales.filter((s) => s.customerId === id).sort((a, b) => b.date.localeCompare(a.date))
  const meds = new Map<string, { medicineName: string; units: number; spent: number }>()
  sales.forEach((s) =>
    s.items.forEach((i) => {
      const e = meds.get(i.medicineId) ?? { medicineName: i.medicineName, units: 0, spent: 0 }
      e.units += i.quantity - i.returnedQuantity
      e.spent += i.lineTotal
      meds.set(i.medicineId, e)
    }),
  )
  const stats = customerStats(db, id)
  return {
    customer,
    sales: sales.map(toSaleListItem),
    ...stats,
    averageBill: stats.visits ? round2(stats.totalSpent / stats.visits) : 0,
    topMedicines: [...meds.entries()].map(([medicineId, v]) => ({ medicineId, ...v, spent: round2(v.spent) })).sort((a, b) => b.units - a.units).slice(0, 8),
  }
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt'>

const normPhone = (p: string) => p.replace(/\D/g, '').slice(-10)

export function createCustomer(input: CustomerInput): Customer {
  requirePermission('customers.manage', 'add customers')
  return mutate((db) => {
    if (db.customers.some((c) => normPhone(c.phone) === normPhone(input.phone))) {
      throw new ServiceError('A customer with this phone number already exists.', 'DUPLICATE', 409)
    }
    const c: Customer = { ...input, id: newId('cus'), createdAt: new Date().toISOString() }
    db.customers.push(c)
    return c
  })
}

export function updateCustomer(id: string, input: CustomerInput): Customer {
  requirePermission('customers.manage', 'edit customers')
  return mutate((db) => {
    if (db.customers.some((c) => c.id !== id && normPhone(c.phone) === normPhone(input.phone))) {
      throw new ServiceError('Another customer already uses this phone number.', 'DUPLICATE', 409)
    }
    const c = findOrThrow(db.customers, id, 'Customer')
    Object.assign(c, input)
    db.sales.filter((s) => s.customerId === id).forEach((s) => {
      s.customerName = c.name
      s.customerPhone = c.phone
    })
    return c
  })
}

export function deleteCustomer(id: string): void {
  requirePermission('customers.manage', 'delete customers')
  mutate((db) => {
    findOrThrow(db.customers, id, 'Customer')
    if (db.sales.some((s) => s.customerId === id)) {
      throw new ServiceError('Customers with sales history cannot be deleted — their invoices must stay traceable.', 'HAS_HISTORY', 409)
    }
    db.customers = db.customers.filter((c) => c.id !== id)
  })
}
