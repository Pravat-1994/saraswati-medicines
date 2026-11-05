/** Shared helpers for mock handlers (filtering, paging, ledger writes). */
import { daysUntil } from '../lib/dates'
import { expiryStatus, summariseStock, type StockSummary } from '../lib/inventory'
import { round2 } from '../lib/money'
import { poOutstanding, poReceivedValue } from '../lib/purchases'
import { newId, sortBy } from '../lib/utils'
import { getActor } from '../services/core/actor'
import { ServiceError, type ListQuery, type PagedResult } from '../types/api'
import type { Batch, Medicine, MovementType, PurchaseOrder, Sale, StockMovement } from '../types/domain'
import type { BatchView, PurchaseOrderListItem, SaleListItem } from '../types/views'
import type { DemoDatabase } from './seed'

export function paginate<T>(items: T[], query: ListQuery<unknown>): PagedResult<T> {
  const pageSize = Math.max(1, query.pageSize ?? 25)
  const total = items.length
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, query.page ?? 1), maxPage)
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
}

export function applySort<T>(
  items: T[],
  query: ListQuery<unknown>,
  getters: Record<string, (row: T) => string | number>,
  defaultKey?: string,
): T[] {
  const key = query.sortBy ?? defaultKey
  if (!key || !getters[key]) return items
  return sortBy(items, getters[key], query.sortBy ? (query.sortDir ?? 'asc') : 'asc')
}

export function matches(search: string | undefined, ...fields: (string | undefined)[]): boolean {
  if (!search) return true
  const q = search.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f?.toLowerCase().includes(q))
}

export const thresholds = (db: DemoDatabase) => ({
  nearExpiryDays: db.settings.nearExpiryDays,
  criticalExpiryDays: db.settings.criticalExpiryDays,
})

export function batchesByMedicine(db: DemoDatabase): Map<string, Batch[]> {
  const map = new Map<string, Batch[]>()
  for (const b of db.batches) {
    const list = map.get(b.medicineId)
    if (list) list.push(b)
    else map.set(b.medicineId, [b])
  }
  return map
}

export function stockFor(db: DemoDatabase, medicine: Medicine, map = batchesByMedicine(db)): StockSummary {
  return summariseStock(medicine, map.get(medicine.id) ?? [], thresholds(db))
}

export function toBatchView(db: DemoDatabase, b: Batch, medicine?: Medicine): BatchView {
  const m = medicine ?? db.medicines.find((x) => x.id === b.medicineId)
  return {
    ...b,
    medicineName: m?.name ?? 'Unknown',
    medicineCode: m?.code ?? '',
    category: m?.category ?? '',
    expiryStatus: expiryStatus(b.expiryDate, thresholds(db)),
    daysToExpiry: daysUntil(b.expiryDate),
    stockValue: round2((b.quantity + b.reserved) * b.purchasePrice),
  }
}

export function toSaleListItem(s: Sale): SaleListItem {
  const { items, ...rest } = s
  return { ...rest, itemCount: items.length, unitCount: items.reduce((a, i) => a + i.quantity, 0) }
}

export function toPoListItem(po: PurchaseOrder): PurchaseOrderListItem {
  const { items, receipts, ...rest } = po
  void receipts
  const ordered = items.reduce((a, i) => a + i.orderedQty, 0)
  const received = items.reduce((a, i) => a + Math.min(i.receivedQty, i.orderedQty), 0)
  return {
    ...rest,
    itemCount: items.length,
    outstanding: poOutstanding(po),
    receivedPct: ordered > 0 ? Math.round((received / ordered) * 100) : 0,
  }
}

export { poReceivedValue }

export function findOrThrow<T extends { id: string }>(items: T[], id: string, label: string): T {
  const found = items.find((i) => i.id === id)
  if (!found) throw new ServiceError(`${label} not found.`, 'NOT_FOUND', 404)
  return found
}

/**
 * Apply a signed quantity change to a batch's sellable stock and append a
 * ledger entry. Enforces the "stock cannot become negative" rule.
 */
export function recordMovement(
  db: DemoDatabase,
  batch: Batch,
  type: MovementType,
  quantity: number,
  ref: Pick<StockMovement, 'referenceType' | 'referenceId' | 'referenceNumber' | 'reason' | 'authorizedBy'> = {},
): StockMovement {
  const next = batch.quantity + quantity
  if (next < 0) {
    throw new ServiceError(`Insufficient stock in batch ${batch.batchNumber}: ${batch.quantity} available.`, 'INSUFFICIENT_STOCK', 409)
  }
  batch.quantity = next
  const movement: StockMovement = {
    id: newId('mov'),
    medicineId: batch.medicineId,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    type,
    quantity,
    balanceAfter: batch.quantity + batch.reserved,
    performedBy: getActor().name,
    timestamp: new Date().toISOString(),
    ...ref,
  }
  db.movements.push(movement)
  return movement
}
