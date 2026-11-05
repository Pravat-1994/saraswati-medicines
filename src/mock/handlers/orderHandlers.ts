/**
 * Online orders: customer storefront (public) + staff fulfilment workflow.
 *
 * Workflow: PLACED → (prescription verified, if needed) → CONFIRMED (stock
 * reserved FEFO) → READY (pickup) / OUT_FOR_DELIVERY → COMPLETED (a normal
 * sale & invoice is created from the reserved batches). Cancelling releases
 * any reservation. In Decisions this maps naturally onto a case/workflow.
 */
import { fefoSort, isExpired, stockStatus } from '../../lib/inventory'
import { round2, sumMoney } from '../../lib/money'
import { newId } from '../../lib/utils'
import { getActor, requirePermission } from '../../services/core/actor'
import { ServiceError, type CompleteOrderRequest, type OrderFilters, type PlaceOrderRequest, type ShopQuery } from '../../types/api'
import type { Batch, Customer, OnlineOrder, OnlineOrderStatus } from '../../types/domain'
import type { OnlineOrderDetail, OrderTracking, ShopInfo, ShopProduct } from '../../types/views'
import { getDb, mutate, nextDocumentNumber } from '../db'
import { batchesByMedicine, findOrThrow, matches } from '../helpers'
import type { DemoDatabase } from '../seed'
import { recordSaleInDb } from './salesHandlers'

const phoneKey = (p: string) => p.replace(/\D/g, '').slice(-10)

function sellableBatches(db: DemoDatabase, medicineId: string, map = batchesByMedicine(db)): Batch[] {
  return fefoSort((map.get(medicineId) ?? []).filter((b) => b.quantity > 0 && !isExpired(b)))
}

const sellableQty = (db: DemoDatabase, medicineId: string, map = batchesByMedicine(db)) => sellableBatches(db, medicineId, map).reduce((a, b) => a + b.quantity, 0)

// ───────────────────────────── Public storefront ─────────────────────────────

export function shopInfo(): ShopInfo {
  const db = getDb()
  const s = db.settings
  return {
    storeName: s.store.name,
    tagline: s.store.tagline,
    address: `${s.store.addressLine}, ${s.store.city}, ${s.store.state} – ${s.store.pincode}`,
    phone: s.store.phone,
    email: s.store.email,
    ordersEnabled: s.onlineOrdersEnabled,
    deliveryEnabled: s.onlineDeliveryEnabled,
    minOrderValue: s.onlineMinOrderValue,
    maxQtyPerItem: s.onlineMaxQtyPerItem,
    deliveryAreaNote: s.deliveryAreaNote,
    categories: [...new Set(db.medicines.filter((m) => m.isActive).map((m) => m.category))].sort(),
  }
}

export function shopCatalog(query: ShopQuery): ShopProduct[] {
  const db = getDb()
  const map = batchesByMedicine(db)
  return db.medicines
    .filter((m) => m.isActive && (!query.category || m.category === query.category) && matches(query.search, m.name, m.genericName, m.composition, m.manufacturer, m.category))
    .map((m) => {
      const qty = sellableQty(db, m.id, map)
      const status = stockStatus(qty, m.minStockLevel)
      return {
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        manufacturer: m.manufacturer,
        category: m.category,
        strength: m.strength,
        dosageForm: m.dosageForm,
        packSize: m.packSize,
        composition: m.composition,
        price: sellableBatches(db, m.id, map)[0]?.sellingPrice ?? m.sellingPrice,
        prescriptionRequired: m.prescriptionRequired,
        availability: status === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : status === 'LOW_STOCK' ? 'LIMITED' : 'IN_STOCK',
        maxQty: Math.min(qty, db.settings.onlineMaxQtyPerItem),
      } satisfies ShopProduct
    })
    .sort((a, b) => (a.availability === 'OUT_OF_STOCK' ? 1 : 0) - (b.availability === 'OUT_OF_STOCK' ? 1 : 0) || a.name.localeCompare(b.name))
}

export function placeOrder(req: PlaceOrderRequest): OrderTracking {
  return mutate((db) => {
    const s = db.settings
    if (!s.onlineOrdersEnabled) throw new ServiceError('Online ordering is currently unavailable. Please call the store.', 'DISABLED', 409)
    if (req.customerName.trim().length < 2) throw new ServiceError('Please enter your name.', 'VALIDATION', 422)
    if (phoneKey(req.customerPhone).length !== 10) throw new ServiceError('Please enter a valid 10-digit mobile number.', 'VALIDATION', 422)
    if (req.fulfilment === 'DELIVERY') {
      if (!s.onlineDeliveryEnabled) throw new ServiceError('Home delivery is not available right now — choose store pickup.', 'VALIDATION', 422)
      if (!req.deliveryAddress || req.deliveryAddress.trim().length < 10) throw new ServiceError('Please enter a complete delivery address.', 'VALIDATION', 422)
    }
    const items = req.items.filter((i) => i.quantity > 0)
    if (items.length === 0) throw new ServiceError('Your cart is empty.', 'VALIDATION', 422)
    if (new Set(items.map((i) => i.medicineId)).size !== items.length) throw new ServiceError('Duplicate items in cart.', 'VALIDATION', 422)
    const map = batchesByMedicine(db)
    const lines = items.map((i, idx) => {
      const m = findOrThrow(db.medicines, i.medicineId, 'Medicine')
      if (!m.isActive) throw new ServiceError(`${m.name} is no longer available.`, 'UNAVAILABLE', 409)
      if (!Number.isInteger(i.quantity) || i.quantity > s.onlineMaxQtyPerItem) throw new ServiceError(`You can order up to ${s.onlineMaxQtyPerItem} of ${m.name} online.`, 'VALIDATION', 422)
      const available = sellableQty(db, m.id, map)
      if (available < i.quantity) throw new ServiceError(available > 0 ? `Only ${available} of ${m.name} available right now.` : `${m.name} is out of stock.`, 'INSUFFICIENT_STOCK', 409)
      const unitPrice = sellableBatches(db, m.id, map)[0]?.sellingPrice ?? m.sellingPrice
      return { lineId: `ol_${newId('x')}_${idx}`, medicineId: m.id, medicineName: m.name, packSize: m.packSize, prescriptionRequired: m.prescriptionRequired, quantity: i.quantity, unitPrice, lineTotal: round2(unitPrice * i.quantity), allocations: [] }
    })
    const estimatedTotal = sumMoney(lines.map((l) => l.lineTotal))
    if (s.onlineMinOrderValue > 0 && estimatedTotal < s.onlineMinOrderValue) throw new ServiceError(`Minimum online order value is ₹${s.onlineMinOrderValue}.`, 'VALIDATION', 422)
    const rx = lines.some((l) => l.prescriptionRequired)
    if (rx && !req.prescriptionRef?.trim() && !req.prescriptionFileName) {
      throw new ServiceError('Your cart has prescription medicines — add a prescription number or attach the prescription.', 'PRESCRIPTION_REQUIRED', 422)
    }
    const existing = db.customers.find((c) => phoneKey(c.phone) === phoneKey(req.customerPhone))
    const now = new Date().toISOString()
    const order: OnlineOrder = {
      id: newId('ord'),
      orderNumber: nextDocumentNumber(db, 'order', 'WEB'),
      placedAt: now,
      customerId: existing?.id,
      customerName: req.customerName.trim(),
      customerPhone: req.customerPhone.trim(),
      customerEmail: req.customerEmail?.trim() || undefined,
      fulfilment: req.fulfilment,
      deliveryAddress: req.fulfilment === 'DELIVERY' ? req.deliveryAddress?.trim() : undefined,
      preferredSlot: req.preferredSlot,
      items: lines,
      estimatedTotal,
      status: 'PLACED',
      prescriptionRequired: rx,
      prescriptionRef: req.prescriptionRef?.trim() || undefined,
      doctorName: req.doctorName?.trim() || undefined,
      prescriptionFileName: req.prescriptionFileName,
      prescriptionVerified: false,
      customerNote: req.customerNote?.trim() || undefined,
      paymentPreference: req.paymentPreference,
      timeline: [{ status: 'PLACED', at: now, by: req.customerName.trim() }],
    }
    db.onlineOrders.unshift(order)
    return toTracking(order)
  })
}

function toTracking(o: OnlineOrder): OrderTracking {
  return {
    orderNumber: o.orderNumber,
    placedAt: o.placedAt,
    status: o.status,
    fulfilment: o.fulfilment,
    customerName: o.customerName,
    items: o.items.map((i) => ({ medicineName: i.medicineName, packSize: i.packSize, quantity: i.quantity, lineTotal: i.lineTotal })),
    estimatedTotal: o.estimatedTotal,
    prescriptionRequired: o.prescriptionRequired,
    prescriptionVerified: o.prescriptionVerified,
    invoiceNumber: o.invoiceNumber,
    cancelReason: o.cancelReason,
    timeline: o.timeline.filter((t) => t.status !== 'NOTE').map((t) => ({ status: t.status, at: t.at, note: t.status === 'CANCELLED' ? t.note : undefined })),
  }
}

/** Order lookup for customers: requires the order number and the phone used. */
export function trackOrder(orderNumber: string, phone: string): OrderTracking {
  const o = getDb().onlineOrders.find((x) => x.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase())
  if (!o || phoneKey(o.customerPhone) !== phoneKey(phone)) {
    throw new ServiceError('No order found with that order number and mobile number.', 'NOT_FOUND', 404)
  }
  return toTracking(o)
}

// ───────────────────────────── Staff fulfilment ─────────────────────────────

const ACTIVE: OnlineOrderStatus[] = ['PLACED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY']

export function listOrders(filters: OrderFilters & { search?: string }): OnlineOrder[] {
  requirePermission('orders.view', 'view online orders')
  const st = filters.status ?? 'ACTIVE'
  return getDb()
    .onlineOrders.filter(
      (o) =>
        (st === 'ALL' || (st === 'ACTIVE' ? ACTIVE.includes(o.status) : o.status === st)) &&
        matches(filters.search, o.orderNumber, o.customerName, o.customerPhone, ...o.items.map((i) => i.medicineName)),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
}

export function orderCounts(): Record<OnlineOrderStatus, number> {
  const out: Record<OnlineOrderStatus, number> = { PLACED: 0, CONFIRMED: 0, READY: 0, OUT_FOR_DELIVERY: 0, COMPLETED: 0, CANCELLED: 0 }
  getDb().onlineOrders.forEach((o) => out[o.status]++)
  return out
}

export function getOrder(id: string): OnlineOrderDetail {
  requirePermission('orders.view', 'view online orders')
  const db = getDb()
  const order = findOrThrow(db.onlineOrders, id, 'Order')
  const map = batchesByMedicine(db)
  return {
    order,
    availability: Object.fromEntries(order.items.map((i) => [i.medicineId, sellableQty(db, i.medicineId, map)])),
    customer: order.customerId ? db.customers.find((c) => c.id === order.customerId) : undefined,
  }
}

function event(o: OnlineOrder, status: OnlineOrder['timeline'][number]['status'], note?: string) {
  o.timeline.push({ status, at: new Date().toISOString(), by: getActor().name, note })
}

function releaseReservation(db: DemoDatabase, o: OnlineOrder) {
  for (const item of o.items) {
    for (const a of item.allocations) {
      const b = db.batches.find((x) => x.id === a.batchId)
      if (!b) continue
      const qty = Math.min(a.quantity, b.reserved)
      b.reserved -= qty
      b.quantity += qty
    }
    item.allocations = []
  }
}

export function verifyPrescription(id: string, note?: string): OnlineOrder {
  requirePermission('orders.verifyRx', 'verify prescriptions')
  return mutate((db) => {
    const o = findOrThrow(db.onlineOrders, id, 'Order')
    if (!o.prescriptionRequired) throw new ServiceError('This order has no prescription medicines.', 'INVALID_STATE', 409)
    if (o.status !== 'PLACED' && o.status !== 'CONFIRMED') throw new ServiceError('Prescription can only be verified on open orders.', 'INVALID_STATE', 409)
    o.prescriptionVerified = true
    o.prescriptionVerifiedBy = getActor().name
    event(o, 'RX_VERIFIED', note)
    return o
  })
}

/** Accepts the order and reserves stock FEFO so it can't be sold at the counter. */
export function confirmOrder(id: string): OnlineOrder {
  requirePermission('orders.manage', 'confirm online orders')
  return mutate((db) => {
    const o = findOrThrow(db.onlineOrders, id, 'Order')
    if (o.status !== 'PLACED') throw new ServiceError('Only new orders can be confirmed.', 'INVALID_STATE', 409)
    if (o.prescriptionRequired && !o.prescriptionVerified) throw new ServiceError('A pharmacist must verify the prescription before confirming.', 'PRESCRIPTION_REQUIRED', 409)
    const map = batchesByMedicine(db)
    for (const item of o.items) {
      let remaining = item.quantity
      const batches = sellableBatches(db, item.medicineId, map)
      const available = batches.reduce((a, b) => a + b.quantity, 0)
      if (available < remaining) throw new ServiceError(`Only ${available} of ${item.medicineName} in stock — edit with the customer or cancel.`, 'INSUFFICIENT_STOCK', 409)
      for (const b of batches) {
        if (remaining <= 0) break
        const take = Math.min(b.quantity, remaining)
        b.quantity -= take
        b.reserved += take
        remaining -= take
        item.allocations.push({ batchId: b.id, batchNumber: b.batchNumber, expiryDate: b.expiryDate, quantity: take })
      }
    }
    o.status = 'CONFIRMED'
    event(o, 'CONFIRMED', 'Stock reserved (FEFO)')
    return o
  })
}

export function advanceOrder(id: string, status: 'READY' | 'OUT_FOR_DELIVERY', note?: string): OnlineOrder {
  requirePermission('orders.manage', 'update online orders')
  return mutate((db) => {
    const o = findOrThrow(db.onlineOrders, id, 'Order')
    if (o.status !== 'CONFIRMED' && !(o.status === 'READY' && status === 'OUT_FOR_DELIVERY')) throw new ServiceError('Confirm the order first.', 'INVALID_STATE', 409)
    if (status === 'OUT_FOR_DELIVERY' && o.fulfilment !== 'DELIVERY') throw new ServiceError('This is a pickup order.', 'INVALID_STATE', 409)
    o.status = status
    event(o, status, note)
    return o
  })
}

/** Hands over the order: converts the reservation into a regular sale & invoice. */
export function completeOrder(req: CompleteOrderRequest): OnlineOrder {
  requirePermission('orders.manage', 'complete online orders')
  return mutate((db) => {
    const o = findOrThrow(db.onlineOrders, req.orderId, 'Order')
    if (!['CONFIRMED', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status)) throw new ServiceError('Only confirmed orders can be completed.', 'INVALID_STATE', 409)
    const lines = o.items.flatMap((i) => i.allocations.map((a) => ({ medicineId: i.medicineId, batchId: a.batchId, quantity: a.quantity, discountPct: 0 })))
    if (lines.length === 0) throw new ServiceError('No stock is reserved for this order.', 'INVALID_STATE', 409)
    releaseReservation(db, o)
    let customer: Customer | undefined = o.customerId ? db.customers.find((c) => c.id === o.customerId) : db.customers.find((c) => phoneKey(c.phone) === phoneKey(o.customerPhone))
    if (!customer) {
      customer = { id: newId('cus'), name: o.customerName, phone: o.customerPhone, email: o.customerEmail, address: o.deliveryAddress, notes: 'Registered via online order', createdAt: new Date().toISOString() }
      db.customers.push(customer)
    }
    const sale = recordSaleInDb(
      db,
      {
        customerId: customer.id,
        lines,
        billDiscountPct: 0,
        paymentMethod: req.paymentMethod,
        paymentReference: req.paymentReference,
        amountTendered: req.amountTendered,
        prescriptionRef: [o.doctorName, o.prescriptionRef].filter(Boolean).join(' / ') || undefined,
        notes: `Online order ${o.orderNumber} (${o.fulfilment === 'DELIVERY' ? 'home delivery' : 'store pickup'})`,
      },
      { preAllocated: true },
    )
    o.customerId = customer.id
    o.saleId = sale.id
    o.invoiceNumber = sale.invoiceNumber
    o.status = 'COMPLETED'
    event(o, 'COMPLETED', `Invoice ${sale.invoiceNumber}`)
    return o
  })
}

export function cancelOrder(id: string, reason: string): OnlineOrder {
  requirePermission('orders.manage', 'cancel online orders')
  if (!reason.trim()) throw new ServiceError('Give a reason for cancelling.', 'VALIDATION', 422)
  return mutate((db) => {
    const o = findOrThrow(db.onlineOrders, id, 'Order')
    if (o.status === 'COMPLETED' || o.status === 'CANCELLED') throw new ServiceError('This order is already closed.', 'INVALID_STATE', 409)
    releaseReservation(db, o)
    o.status = 'CANCELLED'
    o.cancelReason = reason.trim()
    event(o, 'CANCELLED', reason.trim())
    return o
  })
}