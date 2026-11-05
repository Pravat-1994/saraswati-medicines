/**
 * Inventory business rules: expiry classification, stock status and FEFO
 * (First Expiry, First Out) allocation. Thresholds come from AppSettings so
 * they stay configurable.
 */
import { daysUntil } from './dates'
import type { AppSettings, Batch, ExpiryStatus, Medicine, MovementType, StockStatus } from '../types/domain'

export type ExpiryThresholds = Pick<AppSettings, 'nearExpiryDays' | 'criticalExpiryDays'>

export function expiryStatus(expiryDate: string, t: ExpiryThresholds, now: Date = new Date()): ExpiryStatus {
  const d = daysUntil(expiryDate, now)
  if (d < 0) return 'EXPIRED'
  if (d <= t.criticalExpiryDays) return 'CRITICAL'
  if (d <= t.nearExpiryDays) return 'NEAR_EXPIRY'
  return 'OK'
}

export const isExpired = (b: Pick<Batch, 'expiryDate'>, now: Date = new Date()): boolean => daysUntil(b.expiryDate, now) < 0

/** A batch can be sold if it has quantity and is not expired. */
export const isSellable = (b: Batch, now: Date = new Date()): boolean => b.quantity > 0 && !isExpired(b, now)

export function stockStatus(sellableQty: number, minStockLevel: number): StockStatus {
  if (sellableQty <= 0) return 'OUT_OF_STOCK'
  if (sellableQty <= minStockLevel) return 'LOW_STOCK'
  return 'IN_STOCK'
}

/** Batches sorted by FEFO order (earliest expiry first, then oldest receipt). */
export function fefoSort(batches: Batch[]): Batch[] {
  return [...batches].sort(
    (a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.receivedAt.localeCompare(b.receivedAt),
  )
}

export interface Allocation {
  batch: Batch
  quantity: number
}

/**
 * Allocate `quantity` units across sellable batches in FEFO order.
 * Returns the allocations and any shortfall (units that could not be allocated).
 */
export function allocateFefo(batches: Batch[], quantity: number, now: Date = new Date()): { allocations: Allocation[]; shortfall: number } {
  let remaining = quantity
  const allocations: Allocation[] = []
  for (const batch of fefoSort(batches.filter((b) => isSellable(b, now)))) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantity, remaining)
    allocations.push({ batch, quantity: take })
    remaining -= take
  }
  return { allocations, shortfall: Math.max(0, remaining) }
}

/** The batch FEFO would pick first for a medicine. */
export const fefoBatch = (batches: Batch[], now: Date = new Date()): Batch | undefined =>
  fefoSort(batches.filter((b) => isSellable(b, now)))[0]

export interface StockSummary {
  sellable: number
  reserved: number
  damaged: number
  expired: number
  nearExpiry: number
  total: number
  batchCount: number
  nearestExpiry?: string
  stockValue: number
  status: StockStatus
}

/** Summarises a medicine's batches into availability buckets. */
export function summariseStock(medicine: Medicine, batches: Batch[], t: ExpiryThresholds, now: Date = new Date()): StockSummary {
  let sellable = 0
  let reserved = 0
  let damaged = 0
  let expired = 0
  let nearExpiry = 0
  let stockValue = 0
  let nearestExpiry: string | undefined
  for (const b of batches) {
    reserved += b.reserved
    damaged += b.damaged
    if (b.quantity <= 0) continue
    const es = expiryStatus(b.expiryDate, t, now)
    if (es === 'EXPIRED') {
      expired += b.quantity
      continue
    }
    sellable += b.quantity
    stockValue += b.quantity * b.purchasePrice
    if (es === 'NEAR_EXPIRY' || es === 'CRITICAL') nearExpiry += b.quantity
    if (!nearestExpiry || b.expiryDate < nearestExpiry) nearestExpiry = b.expiryDate
  }
  return {
    sellable,
    reserved,
    damaged,
    expired,
    nearExpiry,
    total: sellable + reserved + damaged + expired,
    batchCount: batches.filter((b) => b.quantity + b.reserved + b.damaged > 0).length,
    nearestExpiry,
    stockValue: Math.round(stockValue * 100) / 100,
    status: stockStatus(sellable, medicine.minStockLevel),
  }
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  OPENING: 'Opening stock',
  PURCHASE_IN: 'Purchase receipt',
  SALE_OUT: 'Sale',
  RETURN_IN: 'Customer return',
  ADJUSTMENT_IN: 'Adjustment (+)',
  ADJUSTMENT_OUT: 'Adjustment (−)',
  DAMAGED: 'Damaged',
  EXPIRED_WRITE_OFF: 'Expired write-off',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}

export const EXPIRY_STATUS_LABEL: Record<ExpiryStatus, string> = {
  OK: 'Good',
  NEAR_EXPIRY: 'Near expiry',
  CRITICAL: 'Expiring soon',
  EXPIRED: 'Expired',
}
