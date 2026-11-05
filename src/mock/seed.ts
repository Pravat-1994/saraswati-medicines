/**
 * Demo data generator.
 *
 * Rather than writing static numbers, this simulates ~75 days of store
 * operations (opening stock, purchase receipts, FEFO sales, returns, damages)
 * using the same pricing and inventory rules as the live app. Every dashboard
 * and report figure is therefore derived from consistent underlying records.
 */
import { CATALOG, CUSTOMERS, DEFAULT_SETTINGS, ROLES, SUPPLIERS, USERS, type CatalogEntry } from './catalog'
import { addDays, addMonths, startOfDay, toISODate } from '../lib/dates'
import { round2 } from '../lib/money'
import { priceSale, WALK_IN_CUSTOMER } from '../lib/sales'
import { pricePurchaseOrder, paymentStatusFor } from '../lib/purchases'
import { refundForQuantity } from '../lib/pricing'
import { documentNumber } from '../lib/utils'
import { seedOnlineOrders } from './seedOrders'
import type {
  AppSettings,
  AppUser,
  Batch,
  Customer,
  Medicine,
  MovementType,
  OnlineOrder,
  PaymentMethod,
  PurchaseOrder,
  Role,
  Sale,
  SaleReturn,
  StockAdjustment,
  StockMovement,
  StockTransfer,
  Supplier,
  SupplierPayment,
} from '../types/domain'

export const DB_VERSION = 6

export type CounterKey = 'invoice' | 'po' | 'grn' | 'return' | 'adjustment' | 'transfer' | 'payment' | 'medicine' | 'order'

export interface DemoDatabase {
  version: number
  seededAt: string
  medicines: Medicine[]
  batches: Batch[]
  movements: StockMovement[]
  adjustments: StockAdjustment[]
  transfers: StockTransfer[]
  suppliers: Supplier[]
  customers: Customer[]
  sales: Sale[]
  returns: SaleReturn[]
  purchaseOrders: PurchaseOrder[]
  supplierPayments: SupplierPayment[]
  onlineOrders: OnlineOrder[]
  users: AppUser[]
  roles: Role[]
  settings: AppSettings
  counters: Record<CounterKey, number>
}

// ───────────────────────────── deterministic RNG ─────────────────────────────

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Rng {
  private next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }
  float = (): number => this.next()
  int = (min: number, max: number): number => Math.floor(this.next() * (max - min + 1)) + min
  chance = (p: number): boolean => this.next() < p
  pick = <T,>(arr: readonly T[]): T => arr[Math.floor(this.next() * arr.length)]
  weighted = <T,>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
}

function ean13(base12: string): string {
  const digits = base12.split('').map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  return base12 + ((10 - (sum % 10)) % 10)
}

const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'

// ─────────────────────────────── stock events ────────────────────────────────

interface StockEvent {
  t: string
  batchId: string
  type: MovementType
  qty: number
  referenceType?: StockMovement['referenceType']
  referenceId?: string
  referenceNumber?: string
  reason?: string
  performedBy: string
  authorizedBy?: string
}

interface SimBatch extends Batch {
  capacity: number
  consumed: number
  profile: CatalogEntry['profile']
  role: 'opening' | 'receipt' | 'partial'
}

export function generateSeed(now: Date = new Date()): DemoDatabase {
  const rng = new Rng(20261105)
  const today = startOfDay(now)
  const at = (dayOffset: number, hour: number, minute = 0): Date => {
    const d = addDays(today, dayOffset)
    d.setHours(hour, minute, rng.int(0, 59), 0)
    return d
  }
  const iso = (d: Date) => d.toISOString()
  const settings: AppSettings = structuredClone(DEFAULT_SETTINGS)
  const counters: Record<CounterKey, number> = { invoice: 0, po: 0, grn: 0, return: 0, adjustment: 0, transfer: 0, payment: 0, medicine: 0, order: 0 }
  const nextNo = (key: CounterKey, prefix: string, date: Date) => documentNumber(prefix, ++counters[key], date)

  // ── people ──
  const createdAt = iso(at(-200, 10))
  const suppliers: Supplier[] = SUPPLIERS.map((s, i) => ({ ...s, id: `sup_${String(i + 1).padStart(2, '0')}`, createdAt }))
  const customers: Customer[] = CUSTOMERS.map((c, i) => ({
    ...c,
    id: `cus_${String(i + 1).padStart(3, '0')}`,
    createdAt: iso(at(-rng.int(80, 190), 11)),
  }))
  const users: AppUser[] = USERS.map((u) => ({ ...u, createdAt, lastActiveAt: iso(at(-rng.int(0, 2), 10)) }))
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? 'System'
  const cashiers = ['usr_sales', 'usr_pharmacist', 'usr_manager', 'usr_sales']

  // ── medicines ──
  const medicines: Medicine[] = CATALOG.map((c, i) => {
    counters.medicine++
    return {
      id: `med_${String(i + 1).padStart(3, '0')}`,
      code: `SMS-${String(1001 + i)}`,
      name: c.name,
      genericName: c.generic,
      manufacturer: c.manufacturer,
      category: c.category,
      composition: c.composition,
      strength: c.strength,
      dosageForm: c.form,
      packSize: c.pack,
      barcode: ean13(`890${String(4000000 + i * 7919).padStart(9, '0')}`.slice(0, 12)),
      hsnCode: c.hsn,
      gstRate: c.gst,
      purchasePrice: round2(c.mrp * c.costRatio),
      sellingPrice: c.mrp,
      minStockLevel: c.min,
      reorderQuantity: Math.max(c.min * 2, 10),
      primarySupplierId: suppliers[c.supplier].id,
      storageInstructions: c.storage,
      prescriptionRequired: c.rx,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    }
  })

  // ── batches (planned with soft capacity; final quantities fixed after simulation) ──
  const batches: SimBatch[] = []
  let batchSeq = 0
  const makeBatch = (mi: number, role: SimBatch['role'], receivedAt: Date, expiry: Date, capacity: number): SimBatch => {
    const c = CATALOG[mi]
    const m = medicines[mi]
    const abbr = c.manufacturer.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
    const mfg = addMonths(expiry, -rng.pick([18, 24, 24, 36]))
    const priceDrift = role === 'opening' ? 0.97 : 1
    const b: SimBatch = {
      id: `bat_${String(++batchSeq).padStart(4, '0')}`,
      medicineId: m.id,
      batchNumber: `${abbr}${String(mfg.getFullYear()).slice(2)}${rng.pick(LETTERS.split(''))}${rng.int(1000, 9999)}`,
      mfgDate: toISODate(mfg),
      expiryDate: toISODate(expiry),
      purchasePrice: round2(m.purchasePrice * priceDrift),
      sellingPrice: m.sellingPrice,
      quantity: 0,
      reserved: 0,
      damaged: 0,
      location: c.storage.includes('refrigerator') ? 'Cold Storage' : role === 'opening' ? 'Back Store' : 'Main Shelf',
      supplierId: m.primarySupplierId,
      receivedAt: iso(receivedAt),
      capacity,
      consumed: 0,
      profile: c.profile,
      role,
    }
    batches.push(b)
    return b
  }

  const SIM_DAYS = 75
  const receiptWaves = [-68, -46, -27, -12]
  // One delivery time per supplier per wave, so every batch on a GRN shares its timestamp.
  const waveTimes = new Map<string, Date>()
  const waveTime = (supplierIdx: number, wave: number): Date => {
    const key = `${supplierIdx}|${wave}`
    if (!waveTimes.has(key)) waveTimes.set(key, at(wave, rng.int(11, 16), rng.int(0, 59)))
    return waveTimes.get(key)!
  }
  CATALOG.forEach((c, mi) => {
    const horizon = c.demand * SIM_DAYS * 1.6
    let openingExpiry: Date
    if (c.profile === 'expired') openingExpiry = addDays(today, -rng.int(12, 45))
    else if (c.profile === 'near') openingExpiry = addDays(today, rng.int(14, 80))
    else openingExpiry = addDays(today, rng.int(160, 620))
    makeBatch(mi, 'opening', at(-150, 10), openingExpiry, Math.ceil(horizon * (0.45 + rng.float() * 0.25)))
    if (c.profile !== 'out' || rng.chance(0.5)) {
      const wave = rng.pick(receiptWaves)
      makeBatch(mi, 'receipt', waveTime(c.supplier, wave), addDays(today, rng.int(280, 760)), Math.ceil(horizon * (0.35 + rng.float() * 0.3)))
    }
    if (c.demand >= 2.5) {
      makeBatch(mi, 'receipt', waveTime(c.supplier, rng.pick([-27, -12])), addDays(today, rng.int(400, 800)), Math.ceil(horizon * 0.3))
    }
  })

  // ── sales simulation ──
  const events: StockEvent[] = []
  const sales: Sale[] = []
  const demandWeights = CATALOG.map((c) => c.demand)
  const regulars = customers.map((_, i) => (i < 6 ? 3 : 1))
  const nowMs = now.getTime()

  for (let d = -SIM_DAYS + 1; d <= 0; d++) {
    const day = addDays(today, d)
    const dow = day.getDay()
    const base = dow === 0 ? 9 : dow === 6 ? 16 : 13
    const count = Math.max(4, Math.round(base * (0.8 + rng.float() * 0.45) * (1 + (SIM_DAYS + d) / SIM_DAYS / 6)))
    for (let s = 0; s < count; s++) {
      const hour = rng.weighted([9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21], [5, 9, 10, 8, 5, 6, 9, 12, 12, 9, 4])
      const when = at(d, hour, rng.int(0, 59))
      if (when.getTime() > nowMs) continue
      const lineCount = rng.weighted([1, 2, 3, 4], [45, 30, 17, 8])
      const chosen = new Set<number>()
      const lines: Parameters<typeof priceSale>[0] = []
      const allocations: { batch: SimBatch; qty: number }[] = []
      for (let l = 0; l < lineCount; l++) {
        const mi = rng.weighted(CATALOG.map((_, i) => i), demandWeights)
        if (chosen.has(mi)) continue
        chosen.add(mi)
        let qty = rng.weighted([1, 2, 3, 4, 6], [50, 26, 12, 7, 5])
        const dayIso = toISODate(when)
        const candidates = batches
          .filter((b) => b.medicineId === medicines[mi].id && b.role !== 'partial' && b.receivedAt <= iso(when) && b.expiryDate >= dayIso && b.capacity - b.consumed > 0)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
        for (const b of candidates) {
          if (qty <= 0) break
          const take = Math.min(qty, b.capacity - b.consumed)
          b.consumed += take
          qty -= take
          allocations.push({ batch: b, qty: take })
          lines.push({ medicine: medicines[mi], batch: b, quantity: take, discountPct: 0 })
        }
      }
      if (lines.length === 0) continue
      const registered = rng.chance(0.42)
      const customer = registered ? rng.weighted(customers, regulars) : undefined
      const billDiscountPct = registered ? rng.weighted([0, 5, 10], [55, 35, 10]) : rng.weighted([0, 5], [88, 12])
      const priced = priceSale(lines, billDiscountPct, settings)
      const paymentMethod = rng.weighted<PaymentMethod>(['UPI', 'CASH', 'CARD', 'OTHER'], [48, 35, 14, 3])
      const cashierId = rng.pick(cashiers)
      const id = `sal_${String(sales.length + 1).padStart(5, '0')}`
      const invoiceNumber = nextNo('invoice', settings.invoicePrefix, when)
      const tendered = paymentMethod === 'CASH' ? Math.ceil(priced.totals.grandTotal / 100) * 100 : undefined
      sales.push({
        id,
        invoiceNumber,
        date: iso(when),
        customerId: customer?.id,
        customerName: customer?.name ?? WALK_IN_CUSTOMER,
        customerPhone: customer?.phone,
        items: priced.items,
        billDiscountPct,
        ...priced.totals,
        costTotal: priced.costTotal,
        paymentMethod,
        paymentReference: paymentMethod === 'UPI' ? `UPI${rng.int(100000000, 999999999)}` : paymentMethod === 'CARD' ? `XXXX-${rng.int(1000, 9999)}` : undefined,
        amountTendered: tendered,
        changeReturned: tendered !== undefined ? round2(tendered - priced.totals.grandTotal) : undefined,
        status: 'COMPLETED',
        cashierId,
        cashierName: userName(cashierId),
      })
      for (const a of allocations) {
        events.push({ t: iso(when), batchId: a.batch.id, type: 'SALE_OUT', qty: -a.qty, referenceType: 'SALE', referenceId: id, referenceNumber: invoiceNumber, performedBy: userName(cashierId) })
      }
    }
  }

  // ── damages & adjustments (consume from current stock) ──
  const adjustments: StockAdjustment[] = []
  const addAdjustment = (mi: number, type: StockAdjustment['type'], qty: number, reason: string, dayOffset: number, status: StockAdjustment['status']) => {
    const b = batches.find((x) => x.medicineId === medicines[mi].id && x.role === 'receipt') ?? batches.find((x) => x.medicineId === medicines[mi].id)
    if (!b) return
    const planned = at(dayOffset, 15)
    const earliest = new Date(new Date(b.receivedAt).getTime() + 3_600_000)
    const when = new Date(Math.min(nowMs - 60_000, Math.max(planned.getTime(), earliest.getTime())))
    const adj: StockAdjustment = {
      id: `adj_${String(adjustments.length + 1).padStart(3, '0')}`,
      adjustmentNumber: nextNo('adjustment', 'ADJ', when),
      medicineId: b.medicineId,
      batchId: b.id,
      type,
      quantity: qty,
      reason,
      status,
      requestedBy: userName('usr_pharmacist'),
      requestedAt: iso(when),
      decidedBy: status === 'PENDING' ? undefined : userName('usr_manager'),
      decidedAt: status === 'PENDING' ? undefined : iso(addDays(when, 0)),
      decisionNote: status === 'APPROVED' ? 'Verified physically.' : undefined,
    }
    adjustments.push(adj)
    if (status !== 'APPROVED') return
    b.consumed += qty
    if (type === 'DAMAGED') b.damaged += qty
    events.push({
      t: adj.decidedAt!,
      batchId: b.id,
      type: type === 'DAMAGED' ? 'DAMAGED' : 'ADJUSTMENT_OUT',
      qty: -qty,
      referenceType: 'ADJUSTMENT',
      referenceId: adj.id,
      referenceNumber: adj.adjustmentNumber,
      reason,
      performedBy: adj.requestedBy,
      authorizedBy: adj.decidedBy,
    })
  }
  addAdjustment(1, 'DAMAGED', 3, 'Strips crushed during unloading.', -20, 'APPROVED')
  addAdjustment(14, 'DAMAGED', 2, 'Bottle seal broken — leakage.', -9, 'APPROVED')
  addAdjustment(21, 'DECREASE', 4, 'Physical count mismatch during monthly audit.', -5, 'APPROVED')
  addAdjustment(36, 'DECREASE', 12, 'Cycle count variance — pending recount.', -1, 'PENDING')
  addAdjustment(45, 'DAMAGED', 15, 'Water damage in back store (roof leak).', 0, 'PENDING')

  // ── final quantities per batch, driven by each medicine's demo profile ──
  const byMedicine = new Map<string, SimBatch[]>()
  batches.forEach((b) => byMedicine.set(b.medicineId, [...(byMedicine.get(b.medicineId) ?? []), b]))
  const todayIso = toISODate(today)
  medicines.forEach((m, mi) => {
    const profile = CATALOG[mi].profile
    const list = (byMedicine.get(m.id) ?? []).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    const valid = list.filter((b) => b.expiryDate >= todayIso)
    const latest = valid[valid.length - 1]
    const leftover = new Map<string, number>()
    list.forEach((b) => leftover.set(b.id, Math.max(0, b.capacity - b.consumed)))
    switch (profile) {
      case 'out':
        list.forEach((b) => leftover.set(b.id, 0))
        break
      case 'low': {
        list.forEach((b) => leftover.set(b.id, 0))
        if (latest) leftover.set(latest.id, rng.int(Math.max(1, Math.floor(m.minStockLevel * 0.3)), Math.max(2, m.minStockLevel - 2)))
        break
      }
      case 'expired': {
        list.filter((b) => b.expiryDate < todayIso).forEach((b) => leftover.set(b.id, rng.int(3, 11)))
        break
      }
      case 'near': {
        valid.slice(0, 1).forEach((b) => leftover.set(b.id, rng.int(6, 24)))
        break
      }
      default:
        break
    }
    if (profile !== 'out' && profile !== 'low' && latest) {
      const sellable = valid.reduce((acc, b) => acc + (leftover.get(b.id) ?? 0), 0)
      if (sellable < m.minStockLevel * 1.3) leftover.set(latest.id, (leftover.get(latest.id) ?? 0) + Math.ceil(m.minStockLevel * (1.4 + rng.float() * 2)))
      if (sellable > m.minStockLevel * 9) leftover.set(latest.id, Math.max(0, (leftover.get(latest.id) ?? 0) - Math.floor(sellable - m.minStockLevel * 6)))
    }
    list.forEach((b) => {
      b.capacity = b.consumed + (leftover.get(b.id) ?? 0)
    })
  })

  // ── purchase orders for receipt batches ──
  const purchaseOrders: PurchaseOrder[] = []
  const supplierPayments: SupplierPayment[] = []
  const receiptBatches = batches.filter((b) => b.role === 'receipt' && b.capacity > 0)
  const groups = new Map<string, SimBatch[]>()
  receiptBatches.forEach((b) => {
    const key = `${b.supplierId}|${b.receivedAt}`
    groups.set(key, [...(groups.get(key) ?? []), b])
  })
  const createPo = (
    supplierId: string,
    orderDate: Date,
    lines: { medicineIndex: number; ordered: number; received: number; batch?: SimBatch; discountPct: number }[],
    status: PurchaseOrder['status'],
    receivedAt?: Date,
  ): PurchaseOrder => {
    const supplier = suppliers.find((s) => s.id === supplierId)!
    const priced = pricePurchaseOrder(
      lines.map((l) => {
        const m = medicines[l.medicineIndex]
        return {
          medicineId: m.id,
          medicineName: m.name,
          orderedQty: l.ordered,
          receivedQty: l.received,
          freeQty: 0,
          purchasePrice: l.batch?.purchasePrice ?? m.purchasePrice,
          discountPct: l.discountPct,
          gstRate: m.gstRate,
        }
      }),
      status === 'DRAFT' ? [] : [{ label: 'Freight & handling', amount: rng.pick([0, 150, 250, 300]) }].filter((c) => c.amount > 0),
    )
    const id = `po_${String(purchaseOrders.length + 1).padStart(3, '0')}`
    const poNumber = nextNo('po', settings.poPrefix, orderDate)
    const invoiceNo = receivedAt ? `${supplier.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()}/${rng.int(1000, 9999)}` : undefined
    const po: PurchaseOrder = {
      id,
      poNumber,
      supplierId,
      supplierName: supplier.name,
      orderDate: toISODate(orderDate),
      expectedDate: toISODate(addDays(orderDate, 4)),
      supplierInvoiceNumber: invoiceNo,
      status,
      items: priced.items,
      charges: status === 'DRAFT' ? [] : priced.chargesTotal > 0 ? [{ label: 'Freight & handling', amount: priced.chargesTotal }] : [],
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      gstTotal: priced.gstTotal,
      chargesTotal: priced.chargesTotal,
      grandTotal: priced.grandTotal,
      amountPaid: 0,
      paymentStatus: 'UNPAID',
      receipts: [],
      notes: status === 'DRAFT' ? 'Monthly replenishment — awaiting manager review.' : undefined,
      createdBy: userName('usr_manager'),
      createdAt: iso(orderDate),
    }
    if (receivedAt) {
      const receiptNumber = nextNo('grn', 'GRN', receivedAt)
      po.receipts.push({
        id: `grn_${String(counters.grn).padStart(3, '0')}`,
        receiptNumber,
        date: iso(receivedAt),
        supplierInvoiceNumber: invoiceNo!,
        receivedBy: userName('usr_pharmacist'),
        lines: lines
          .filter((l) => l.batch && l.received > 0)
          .map((l, idx) => ({
            poItemId: priced.items[lines.indexOf(l)]?.id ?? priced.items[idx].id,
            medicineId: medicines[l.medicineIndex].id,
            batchId: l.batch!.id,
            batchNumber: l.batch!.batchNumber,
            mfgDate: l.batch!.mfgDate,
            expiryDate: l.batch!.expiryDate,
            quantity: l.received,
            sellingPrice: l.batch!.sellingPrice,
          })),
      })
      lines.forEach((l) => {
        if (!l.batch) return
        l.batch.purchaseOrderId = id
        events.push({ t: iso(receivedAt), batchId: l.batch.id, type: 'PURCHASE_IN', qty: l.received, referenceType: 'PURCHASE_RECEIPT', referenceId: id, referenceNumber: receiptNumber, performedBy: userName('usr_pharmacist') })
      })
    }
    purchaseOrders.push(po)
    return po
  }

  const medIndex = (id: string) => medicines.findIndex((m) => m.id === id)
  ;[...groups.entries()]
    .sort((a, b) => a[0].split('|')[1].localeCompare(b[0].split('|')[1]))
    .forEach(([key, list]) => {
      const supplierId = key.split('|')[0]
      const receivedAt = new Date(list[0].receivedAt)
      const discount = rng.pick([0, 0, 2, 3])
      createPo(supplierId, addDays(receivedAt, -rng.int(2, 4)), list.map((b) => ({ medicineIndex: medIndex(b.medicineId), ordered: b.capacity, received: b.capacity, batch: b, discountPct: discount })), 'RECEIVED', receivedAt)
    })

  // Pay older POs fully, some recent ones partially, leave the newest unpaid.
  purchaseOrders.forEach((po) => {
    const age = (nowMs - new Date(po.createdAt).getTime()) / 86_400_000
    let paid = 0
    if (age > 40) paid = po.grandTotal
    else if (age > 20) paid = rng.chance(0.5) ? po.grandTotal : round2(po.grandTotal * 0.5)
    if (paid > 0) {
      const when = addDays(new Date(po.createdAt), Math.min(Math.floor(age) - 1, rng.int(10, 25)))
      supplierPayments.push({
        id: `pay_${String(supplierPayments.length + 1).padStart(3, '0')}`,
        paymentNumber: nextNo('payment', 'PAY', when),
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        date: iso(when),
        amount: round2(paid),
        method: rng.pick(['BANK_TRANSFER', 'BANK_TRANSFER', 'UPI', 'CHEQUE'] as const),
        reference: `UTR${rng.int(10000000, 99999999)}`,
        recordedBy: userName('usr_manager'),
      })
      po.amountPaid = round2(paid)
    }
    po.paymentStatus = paymentStatusFor(po)
  })

  // Open purchase orders: replenish out-of-stock & low-stock items.
  const needy = CATALOG.map((c, i) => ({ c, i })).filter(({ c }) => c.profile === 'out' || c.profile === 'low')
  const bySupplier = new Map<number, number[]>()
  needy.forEach(({ c, i }) => bySupplier.set(c.supplier, [...(bySupplier.get(c.supplier) ?? []), i]))
  let openIdx = 0
  bySupplier.forEach((idxs, supplierIdx) => {
    const status = openIdx === 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED'
    const orderDate = at(-(openIdx + 1), 12)
    if (status === 'PARTIALLY_RECEIVED') {
      const receivedAt = at(0, 10, 15)
      const lines = idxs.map((mi, k) => {
        const ordered = Math.max(CATALOG[mi].min * 3, 20)
        if (k !== 0) return { medicineIndex: mi, ordered, received: 0, discountPct: 2 }
        const received = Math.floor(ordered / 2)
        const b = makeBatch(mi, 'partial', receivedAt, addDays(today, rng.int(500, 700)), received)
        b.capacity = received
        b.location = CATALOG[mi].storage.includes('refrigerator') ? 'Cold Storage' : 'Main Shelf'
        return { medicineIndex: mi, ordered, received, batch: b, discountPct: 2 }
      })
      createPo(suppliers[supplierIdx].id, orderDate, lines, 'PARTIALLY_RECEIVED', receivedAt)
    } else {
      createPo(suppliers[supplierIdx].id, orderDate, idxs.map((mi) => ({ medicineIndex: mi, ordered: Math.max(CATALOG[mi].min * 3, 20), received: 0, discountPct: 2 })), 'ORDERED')
    }
    openIdx++
  })
  createPo(suppliers[2].id, at(0, 9, 40), [4, 23, 26].map((mi) => ({ medicineIndex: mi, ordered: CATALOG[mi].min * 2, received: 0, discountPct: 0 })), 'DRAFT')

  // ── opening stock events ──
  batches
    .filter((b) => b.role === 'opening' && b.capacity > 0)
    .forEach((b) => events.push({ t: b.receivedAt, batchId: b.id, type: 'OPENING', qty: b.capacity, referenceType: 'SEED', reason: 'Opening stock', performedBy: 'System' }))

  // ── customer returns ──
  const returns: SaleReturn[] = []
  const returnable = sales.filter((s) => {
    const age = (nowMs - new Date(s.date).getTime()) / 86_400_000
    return age > 0.2 && age < 30 && s.items.some((i) => i.quantity >= 2 && CATALOG[medIndex(i.medicineId)].profile === 'normal')
  })
  const reasons = ['Doctor changed prescription', 'Duplicate purchase', 'Wrong strength dispensed — replaced', 'Customer allergic reaction reported']
  for (let r = 0; r < 5 && returnable.length > 0; r++) {
    const sale = returnable.splice(rng.int(0, returnable.length - 1), 1)[0]
    const item = sale.items.find((i) => i.quantity >= 2 && CATALOG[medIndex(i.medicineId)].profile === 'normal')!
    const qty = 1
    const pending = r === 4
    const when = new Date(Math.min(nowMs - 60_000, new Date(sale.date).getTime() + rng.int(1, 3) * 86_400_000))
    const refund = refundForQuantity(item.lineTotal, item.quantity, qty)
    const ret: SaleReturn = {
      id: `ret_${String(r + 1).padStart(3, '0')}`,
      returnNumber: nextNo('return', 'RET', when),
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: iso(when),
      customerName: sale.customerName,
      items: [{ lineId: item.lineId, medicineId: item.medicineId, medicineName: item.medicineName, batchId: item.batchId, batchNumber: item.batchNumber, quantity: qty, refundAmount: refund, restock: true }],
      totalRefund: refund,
      refundMethod: sale.paymentMethod,
      reason: reasons[r % reasons.length],
      status: pending ? 'PENDING' : 'APPROVED',
      requestedBy: sale.cashierName,
      decidedBy: pending ? undefined : userName('usr_manager'),
      decidedAt: pending ? undefined : iso(when),
    }
    returns.push(ret)
    if (!pending) {
      item.returnedQuantity += qty
      sale.status = sale.items.every((i) => i.returnedQuantity >= i.quantity) ? 'RETURNED' : 'PARTIALLY_RETURNED'
      events.push({ t: iso(when), batchId: item.batchId, type: 'RETURN_IN', qty, referenceType: 'RETURN', referenceId: ret.id, referenceNumber: ret.returnNumber, reason: ret.reason, performedBy: ret.requestedBy, authorizedBy: ret.decidedBy })
    }
  }

  // ── replay events into the movement ledger ──
  events.sort((a, b) => a.t.localeCompare(b.t))
  const balance = new Map<string, number>()
  const batchById = new Map(batches.map((b) => [b.id, b]))
  const movements: StockMovement[] = events.map((e, i) => {
    const next = (balance.get(e.batchId) ?? 0) + e.qty
    balance.set(e.batchId, next)
    const b = batchById.get(e.batchId)!
    return {
      id: `mov_${String(i + 1).padStart(5, '0')}`,
      medicineId: b.medicineId,
      batchId: b.id,
      batchNumber: b.batchNumber,
      type: e.type,
      quantity: e.qty,
      balanceAfter: next,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      referenceNumber: e.referenceNumber,
      reason: e.reason,
      performedBy: e.performedBy,
      authorizedBy: e.authorizedBy,
      timestamp: e.t,
    }
  })

  const finalBatches: Batch[] = batches
    .filter((b) => b.capacity > 0)
    .map((b) => ({
      id: b.id,
      medicineId: b.medicineId,
      batchNumber: b.batchNumber,
      mfgDate: b.mfgDate,
      expiryDate: b.expiryDate,
      purchasePrice: b.purchasePrice,
      sellingPrice: b.sellingPrice,
      quantity: Math.max(0, balance.get(b.id) ?? 0),
      reserved: 0,
      damaged: b.damaged,
      location: b.location,
      supplierId: b.supplierId,
      purchaseOrderId: b.purchaseOrderId,
      receivedAt: b.receivedAt,
    }))
  // A couple of units held for customer orders (reserved, not sellable).
  const reserveTarget = finalBatches.find((b) => b.medicineId === medicines[29].id && b.quantity > 4)
  if (reserveTarget) {
    reserveTarget.quantity -= 2
    reserveTarget.reserved = 2
  }

  const transfers: StockTransfer[] = []
  const onlineOrders = seedOnlineOrders({ rng, now, today, medicines, batches: finalBatches, customers, sales, nextNo, userName })

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    medicines,
    batches: finalBatches,
    movements,
    adjustments,
    transfers,
    suppliers,
    customers,
    sales: sales.reverse(),
    returns: returns.reverse(),
    purchaseOrders: purchaseOrders.reverse(),
    supplierPayments: supplierPayments.reverse(),
    onlineOrders,
    users,
    roles: structuredClone(ROLES),
    settings,
    counters,
  }
}
