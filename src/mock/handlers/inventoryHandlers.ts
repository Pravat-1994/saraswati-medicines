import { daysUntil, isWithinRange } from '../../lib/dates'
import { expiryStatus, fefoSort, isExpired } from '../../lib/inventory'
import { round2 } from '../../lib/money'
import { newId } from '../../lib/utils'
import { actorCan, getActor, requirePermission } from '../../services/core/actor'
import {
  ServiceError,
  type AdjustmentRequest,
  type BatchInput,
  type ListQuery,
  type MovementFilters,
  type PagedResult,
  type TransferRequest,
} from '../../types/api'
import type { Batch, ExpiryStatus, StockAdjustment, StockMovement, StockTransfer } from '../../types/domain'
import type { BatchView, InventoryAlert, InventoryOverview } from '../../types/views'
import { getDb, mutate, nextDocumentNumber } from '../db'
import { applySort, batchesByMedicine, findOrThrow, matches, paginate, recordMovement, stockFor, thresholds, toBatchView } from '../helpers'
import type { DemoDatabase } from '../seed'

export interface BatchFilters {
  medicineId?: string
  location?: string
  expiry?: ExpiryStatus | 'ALL'
  includeEmpty?: boolean
}

export function inventoryOverview(): InventoryOverview {
  const db = getDb()
  const map = batchesByMedicine(db)
  const t = thresholds(db)
  const o: InventoryOverview = {
    skuCount: db.medicines.filter((m) => m.isActive).length,
    sellableUnits: 0,
    reservedUnits: 0,
    damagedUnits: 0,
    expiredUnits: 0,
    stockValueCost: 0,
    stockValueRetail: 0,
    expiredValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    nearExpiryBatches: 0,
    byCategory: [],
    byLocation: [],
    expiryBuckets: [
      { label: 'Expired', batches: 0, units: 0, value: 0 },
      { label: `≤ ${t.criticalExpiryDays} days`, batches: 0, units: 0, value: 0 },
      { label: `${t.criticalExpiryDays + 1}–${t.nearExpiryDays} days`, batches: 0, units: 0, value: 0 },
      { label: `${t.nearExpiryDays + 1}–180 days`, batches: 0, units: 0, value: 0 },
      { label: '> 180 days', batches: 0, units: 0, value: 0 },
    ],
  }
  const cat = new Map<string, { units: number; value: number; skus: number }>()
  const loc = new Map<string, { units: number; value: number }>()
  for (const m of db.medicines) {
    if (!m.isActive) continue
    const s = stockFor(db, m, map)
    if (s.status === 'LOW_STOCK') o.lowStockCount++
    if (s.status === 'OUT_OF_STOCK') o.outOfStockCount++
    const c = cat.get(m.category) ?? { units: 0, value: 0, skus: 0 }
    c.skus++
    for (const b of map.get(m.id) ?? []) {
      o.reservedUnits += b.reserved
      o.damagedUnits += b.damaged
      if (b.quantity <= 0) continue
      const value = b.quantity * b.purchasePrice
      const days = daysUntil(b.expiryDate)
      const bucket = days < 0 ? 0 : days <= t.criticalExpiryDays ? 1 : days <= t.nearExpiryDays ? 2 : days <= 180 ? 3 : 4
      o.expiryBuckets[bucket].batches++
      o.expiryBuckets[bucket].units += b.quantity
      o.expiryBuckets[bucket].value += value
      if (days < 0) {
        o.expiredUnits += b.quantity
        o.expiredValue += value
        continue
      }
      if (bucket === 1 || bucket === 2) o.nearExpiryBatches++
      o.sellableUnits += b.quantity
      o.stockValueCost += value
      o.stockValueRetail += b.quantity * b.sellingPrice
      c.units += b.quantity
      c.value += value
      const l = loc.get(b.location) ?? { units: 0, value: 0 }
      l.units += b.quantity
      l.value += value
      loc.set(b.location, l)
    }
    cat.set(m.category, c)
  }
  o.stockValueCost = round2(o.stockValueCost)
  o.stockValueRetail = round2(o.stockValueRetail)
  o.expiredValue = round2(o.expiredValue)
  o.expiryBuckets.forEach((b) => (b.value = round2(b.value)))
  o.byCategory = [...cat.entries()].map(([category, v]) => ({ category, ...v, value: round2(v.value) })).sort((a, b) => b.value - a.value)
  o.byLocation = [...loc.entries()].map(([location, v]) => ({ location, ...v, value: round2(v.value) })).sort((a, b) => b.value - a.value)
  return o
}

export function listBatches(query: ListQuery<BatchFilters>): PagedResult<BatchView> {
  const db = getDb()
  const f = query.filters ?? {}
  const meds = new Map(db.medicines.map((m) => [m.id, m]))
  let rows = db.batches
    .filter((b) => f.includeEmpty || b.quantity + b.reserved + b.damaged > 0)
    .map((b) => toBatchView(db, b, meds.get(b.medicineId)))
  rows = rows.filter(
    (b) =>
      matches(query.search, b.medicineName, b.medicineCode, b.batchNumber) &&
      (!f.medicineId || b.medicineId === f.medicineId) &&
      (!f.location || b.location === f.location) &&
      (!f.expiry || f.expiry === 'ALL' || b.expiryStatus === f.expiry || (f.expiry === 'NEAR_EXPIRY' && b.expiryStatus === 'CRITICAL')),
  )
  rows = fefoSort(rows) as BatchView[]
  rows = applySort(rows, query, {
    medicine: (b) => b.medicineName,
    batch: (b) => b.batchNumber,
    expiry: (b) => b.expiryDate,
    quantity: (b) => b.quantity,
    value: (b) => b.stockValue,
    location: (b) => b.location,
  })
  return paginate(rows, query)
}

export function addBatch(input: BatchInput): BatchView {
  requirePermission('inventory.adjust', 'add stock')
  if (input.expiryDate <= input.mfgDate) throw new ServiceError('Expiry date must be after the manufacturing date.', 'VALIDATION', 422)
  if (isExpired({ expiryDate: input.expiryDate })) throw new ServiceError('Cannot add a batch that has already expired.', 'VALIDATION', 422)
  return mutate((db) => {
    const medicine = findOrThrow(db.medicines, input.medicineId, 'Medicine')
    const existing = db.batches.find((b) => b.medicineId === input.medicineId && b.batchNumber.toUpperCase() === input.batchNumber.toUpperCase() && b.location === input.location)
    if (existing && existing.expiryDate !== input.expiryDate) {
      throw new ServiceError(`Batch ${input.batchNumber} already exists with a different expiry date.`, 'BATCH_CONFLICT', 409)
    }
    const batch: Batch =
      existing ??
      (() => {
        const b: Batch = {
          id: newId('bat'),
          medicineId: input.medicineId,
          batchNumber: input.batchNumber.toUpperCase(),
          mfgDate: input.mfgDate,
          expiryDate: input.expiryDate,
          purchasePrice: input.purchasePrice,
          sellingPrice: input.sellingPrice,
          quantity: 0,
          reserved: 0,
          damaged: 0,
          location: input.location,
          supplierId: input.supplierId,
          receivedAt: new Date().toISOString(),
        }
        db.batches.push(b)
        return b
      })()
    recordMovement(db, batch, 'PURCHASE_IN', input.quantity, { referenceType: 'ADJUSTMENT', reason: 'Direct stock-in (without purchase order)' })
    return toBatchView(db, batch, medicine)
  })
}

export function listMovements(query: ListQuery<MovementFilters>): PagedResult<StockMovement & { medicineName: string }> {
  const db = getDb()
  const f = query.filters ?? {}
  const names = new Map(db.medicines.map((m) => [m.id, m.name]))
  let rows = db.movements
    .filter(
      (m) =>
        (!f.medicineId || m.medicineId === f.medicineId) &&
        (!f.type || f.type === 'ALL' || m.type === f.type) &&
        (!f.range || isWithinRange(m.timestamp, f.range)),
    )
    .map((m) => ({ ...m, medicineName: names.get(m.medicineId) ?? 'Unknown' }))
    .filter((m) => matches(query.search, m.medicineName, m.batchNumber, m.referenceNumber, m.performedBy))
  rows = rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  rows = applySort(rows, query, { timestamp: (m) => m.timestamp, quantity: (m) => m.quantity, medicine: (m) => m.medicineName, type: (m) => m.type })
  return paginate(rows, query)
}

export interface AdjustmentView extends StockAdjustment {
  medicineName: string
  batchNumber: string
  available: number
}

export function listAdjustments(status?: StockAdjustment['status'] | 'ALL'): AdjustmentView[] {
  const db = getDb()
  return db.adjustments
    .filter((a) => !status || status === 'ALL' || a.status === status)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((a) => {
      const b = db.batches.find((x) => x.id === a.batchId)
      return { ...a, medicineName: db.medicines.find((m) => m.id === a.medicineId)?.name ?? 'Unknown', batchNumber: b?.batchNumber ?? '—', available: b?.quantity ?? 0 }
    })
}

function applyAdjustment(db: DemoDatabase, adj: StockAdjustment): void {
  const batch = findOrThrow(db.batches, adj.batchId, 'Batch')
  const ref = { referenceType: 'ADJUSTMENT' as const, referenceId: adj.id, referenceNumber: adj.adjustmentNumber, reason: adj.reason, authorizedBy: adj.decidedBy }
  switch (adj.type) {
    case 'INCREASE':
      recordMovement(db, batch, 'ADJUSTMENT_IN', adj.quantity, ref)
      break
    case 'DECREASE':
      recordMovement(db, batch, 'ADJUSTMENT_OUT', -adj.quantity, ref)
      break
    case 'DAMAGED':
      recordMovement(db, batch, 'DAMAGED', -adj.quantity, ref)
      batch.damaged += adj.quantity
      break
    case 'EXPIRED_WRITE_OFF':
      if (!isExpired(batch)) throw new ServiceError('Only expired batches can be written off as expired.', 'VALIDATION', 422)
      recordMovement(db, batch, 'EXPIRED_WRITE_OFF', -adj.quantity, ref)
      break
  }
}

/**
 * Requests a stock adjustment. Small adjustments by authorised roles are
 * applied immediately; larger ones (above the configured threshold) or those
 * by roles without approval rights wait for a manager — mirroring the
 * Decisions approval workflow that will replace this.
 */
export function requestAdjustment(req: AdjustmentRequest): AdjustmentView {
  requirePermission('inventory.adjust', 'adjust stock')
  if (req.quantity <= 0 || !Number.isInteger(req.quantity)) throw new ServiceError('Quantity must be a positive whole number.', 'VALIDATION', 422)
  return mutate((db) => {
    const batch = findOrThrow(db.batches, req.batchId, 'Batch')
    if (req.type !== 'INCREASE' && req.quantity > batch.quantity) {
      throw new ServiceError(`Only ${batch.quantity} units are available in batch ${batch.batchNumber}.`, 'INSUFFICIENT_STOCK', 409)
    }
    const actor = getActor()
    const threshold = db.settings.adjustmentApprovalThreshold
    const autoApprove = actorCan('inventory.approve') || (threshold > 0 && req.quantity <= threshold)
    const now = new Date().toISOString()
    const adj: StockAdjustment = {
      id: newId('adj'),
      adjustmentNumber: nextDocumentNumber(db, 'adjustment', 'ADJ'),
      medicineId: req.medicineId,
      batchId: req.batchId,
      type: req.type,
      quantity: req.quantity,
      reason: req.reason,
      status: autoApprove ? 'APPROVED' : 'PENDING',
      requestedBy: actor.name,
      requestedAt: now,
      decidedBy: autoApprove ? actor.name : undefined,
      decidedAt: autoApprove ? now : undefined,
      decisionNote: autoApprove ? (actorCan('inventory.approve') ? 'Self-approved (authorised role).' : 'Auto-approved (within threshold).') : undefined,
    }
    db.adjustments.push(adj)
    if (autoApprove) applyAdjustment(db, adj)
    return { ...adj, medicineName: db.medicines.find((m) => m.id === adj.medicineId)?.name ?? '', batchNumber: batch.batchNumber, available: batch.quantity }
  })
}

export function decideAdjustment(id: string, approve: boolean, note?: string): StockAdjustment {
  requirePermission('inventory.approve', 'approve stock adjustments')
  return mutate((db) => {
    const adj = findOrThrow(db.adjustments, id, 'Adjustment')
    if (adj.status !== 'PENDING') throw new ServiceError('This adjustment has already been decided.', 'INVALID_STATE', 409)
    adj.status = approve ? 'APPROVED' : 'REJECTED'
    adj.decidedBy = getActor().name
    adj.decidedAt = new Date().toISOString()
    adj.decisionNote = note
    if (approve) applyAdjustment(db, adj)
    return adj
  })
}

export function listTransfers(): (StockTransfer & { medicineName: string; batchNumber: string })[] {
  const db = getDb()
  return [...db.transfers]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((t) => ({ ...t, medicineName: db.medicines.find((m) => m.id === t.medicineId)?.name ?? '', batchNumber: db.batches.find((b) => b.id === t.batchId)?.batchNumber ?? '' }))
}

export function transferStock(req: TransferRequest): StockTransfer {
  requirePermission('inventory.transfer', 'transfer stock')
  return mutate((db) => {
    if (!db.settings.enableStockTransfers) throw new ServiceError('Stock transfers are disabled in settings.', 'DISABLED', 409)
    const source = findOrThrow(db.batches, req.batchId, 'Batch')
    if (source.location === req.toLocation) throw new ServiceError('Choose a different destination location.', 'VALIDATION', 422)
    if (req.quantity <= 0 || req.quantity > source.quantity) throw new ServiceError(`Transfer quantity must be between 1 and ${source.quantity}.`, 'VALIDATION', 422)
    let target = db.batches.find((b) => b.medicineId === source.medicineId && b.batchNumber === source.batchNumber && b.location === req.toLocation)
    if (!target) {
      target = { ...source, id: newId('bat'), quantity: 0, reserved: 0, damaged: 0, location: req.toLocation }
      db.batches.push(target)
    }
    const transfer: StockTransfer = {
      id: newId('trf'),
      transferNumber: nextDocumentNumber(db, 'transfer', 'TRF'),
      medicineId: source.medicineId,
      batchId: source.id,
      fromLocation: source.location,
      toLocation: req.toLocation,
      quantity: req.quantity,
      performedBy: getActor().name,
      timestamp: new Date().toISOString(),
      note: req.note,
    }
    const ref = { referenceType: 'TRANSFER' as const, referenceId: transfer.id, referenceNumber: transfer.transferNumber, reason: `${source.location} → ${req.toLocation}` }
    recordMovement(db, source, 'TRANSFER_OUT', -req.quantity, ref)
    recordMovement(db, target, 'TRANSFER_IN', req.quantity, ref)
    db.transfers.push(transfer)
    return transfer
  })
}

export function inventoryAlerts(): InventoryAlert[] {
  const db = getDb()
  const map = batchesByMedicine(db)
  const t = thresholds(db)
  const alerts: InventoryAlert[] = []
  for (const m of db.medicines) {
    if (!m.isActive) continue
    const s = stockFor(db, m, map)
    if (db.settings.lowStockAlertsEnabled && s.status !== 'IN_STOCK') {
      alerts.push({
        id: `${m.id}-stock`,
        kind: s.status === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        severity: s.status === 'OUT_OF_STOCK' ? 'critical' : 'warning',
        medicineId: m.id,
        medicineName: m.name,
        medicineCode: m.code,
        quantity: s.sellable,
        minStockLevel: m.minStockLevel,
        value: round2(Math.max(0, m.reorderQuantity) * m.purchasePrice),
      })
    }
    if (!db.settings.expiryAlertsEnabled) continue
    for (const b of map.get(m.id) ?? []) {
      if (b.quantity <= 0) continue
      const es = expiryStatus(b.expiryDate, t)
      if (es === 'OK') continue
      alerts.push({
        id: `${b.id}-expiry`,
        kind: es === 'EXPIRED' ? 'EXPIRED' : 'NEAR_EXPIRY',
        severity: es === 'EXPIRED' ? 'critical' : es === 'CRITICAL' ? 'warning' : 'info',
        medicineId: m.id,
        medicineName: m.name,
        medicineCode: m.code,
        batchId: b.id,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        daysToExpiry: daysUntil(b.expiryDate),
        value: round2(b.quantity * b.purchasePrice),
      })
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0))
}
