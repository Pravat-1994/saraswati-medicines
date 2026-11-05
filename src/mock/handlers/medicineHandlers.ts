import { addMonths, formatMonthYear, toISODate } from '../../lib/dates'
import { fefoSort } from '../../lib/inventory'
import { round2 } from '../../lib/money'
import { newId } from '../../lib/utils'
import { requirePermission } from '../../services/core/actor'
import { ServiceError, type ListQuery, type MedicineFilters, type MedicineInput, type PagedResult } from '../../types/api'
import type { DosageForm, Medicine } from '../../types/domain'
import type { MedicineDetail, MedicineListItem, MedicineLookups, SaleableMedicine } from '../../types/views'
import { getDb, mutate } from '../db'
import { applySort, batchesByMedicine, findOrThrow, matches, paginate, stockFor, toBatchView } from '../helpers'

export function listMedicines(query: ListQuery<MedicineFilters>): PagedResult<MedicineListItem> {
  const db = getDb()
  const map = batchesByMedicine(db)
  const supplierName = new Map(db.suppliers.map((s) => [s.id, s.name]))
  const f = query.filters ?? {}
  let rows: MedicineListItem[] = db.medicines.map((m) => ({
    ...m,
    stock: stockFor(db, m, map),
    supplierName: m.primarySupplierId ? supplierName.get(m.primarySupplierId) : undefined,
  }))
  rows = rows.filter(
    (m) =>
      matches(query.search, m.name, m.genericName, m.code, m.barcode, m.composition, m.manufacturer) &&
      (!f.category || m.category === f.category) &&
      (!f.manufacturer || m.manufacturer === f.manufacturer) &&
      (!f.availability || f.availability === 'ALL' || m.stock.status === f.availability) &&
      (!f.expiry ||
        f.expiry === 'ALL' ||
        (f.expiry === 'EXPIRED' && m.stock.expired > 0) ||
        (f.expiry === 'NEAR_EXPIRY' && m.stock.nearExpiry > 0)),
  )
  rows = applySort(
    rows,
    query,
    {
      name: (m) => m.name,
      code: (m) => m.code,
      category: (m) => m.category,
      manufacturer: (m) => m.manufacturer,
      stock: (m) => m.stock.sellable,
      sellingPrice: (m) => m.sellingPrice,
      expiry: (m) => m.stock.nearestExpiry ?? '9999',
    },
    'name',
  )
  return paginate(rows, query)
}

export function getMedicine(id: string): MedicineDetail {
  const db = getDb()
  const medicine = findOrThrow(db.medicines, id, 'Medicine')
  const batches = fefoSort(db.batches.filter((b) => b.medicineId === id)).map((b) => toBatchView(db, b, medicine))
  const movements = db.movements
    .filter((m) => m.medicineId === id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 200)
  const since = Date.now() - 30 * 86_400_000
  let unitsSold30d = 0
  let revenue30d = 0
  const monthly = new Map<string, { units: number; revenue: number }>()
  const start = addMonths(new Date(), -5)
  start.setDate(1)
  for (let i = 0; i < 6; i++) monthly.set(toISODate(addMonths(start, i)).slice(0, 7), { units: 0, revenue: 0 })
  for (const s of db.sales) {
    const t = new Date(s.date).getTime()
    for (const item of s.items) {
      if (item.medicineId !== id) continue
      const units = item.quantity - item.returnedQuantity
      if (t >= since) {
        unitsSold30d += units
        revenue30d += item.lineTotal
      }
      const bucket = monthly.get(toISODate(new Date(s.date)).slice(0, 7))
      if (bucket) {
        bucket.units += units
        bucket.revenue += item.lineTotal
      }
    }
  }
  return {
    medicine,
    stock: stockFor(db, medicine),
    batches,
    movements,
    supplier: db.suppliers.find((s) => s.id === medicine.primarySupplierId),
    unitsSold30d,
    revenue30d: round2(revenue30d),
    monthlySales: [...monthly.entries()].map(([month, v]) => ({ month: formatMonthYear(`${month}-01`), units: v.units, revenue: round2(v.revenue) })),
  }
}

function validateMedicine(input: MedicineInput, existingId?: string): void {
  const db = getDb()
  const code = input.code.trim().toUpperCase()
  if (db.medicines.some((m) => m.code.toUpperCase() === code && m.id !== existingId)) {
    throw new ServiceError(`Medicine code "${input.code}" is already in use.`, 'DUPLICATE_CODE', 409)
  }
  if (input.barcode && db.medicines.some((m) => m.barcode === input.barcode && m.id !== existingId)) {
    throw new ServiceError(`Barcode ${input.barcode} is already assigned to another medicine.`, 'DUPLICATE_BARCODE', 409)
  }
  if (input.sellingPrice < input.purchasePrice) {
    throw new ServiceError('Selling price cannot be lower than purchase price.', 'VALIDATION', 422)
  }
}

export function createMedicine(input: MedicineInput): Medicine {
  requirePermission('medicines.manage', 'add medicines')
  validateMedicine(input)
  return mutate((db) => {
    const now = new Date().toISOString()
    db.counters.medicine += 1
    const medicine: Medicine = {
      ...input,
      code: input.code.trim().toUpperCase(),
      dosageForm: input.dosageForm as DosageForm,
      id: newId('med'),
      createdAt: now,
      updatedAt: now,
    }
    db.medicines.push(medicine)
    return medicine
  })
}

export function updateMedicine(id: string, input: MedicineInput): Medicine {
  requirePermission('medicines.manage', 'edit medicines')
  validateMedicine(input, id)
  return mutate((db) => {
    const m = findOrThrow(db.medicines, id, 'Medicine')
    Object.assign(m, input, { code: input.code.trim().toUpperCase(), dosageForm: input.dosageForm as DosageForm, updatedAt: new Date().toISOString() })
    return m
  })
}

/** Deletes a medicine with no history; otherwise deactivates it to preserve the audit trail. */
export function removeMedicine(id: string): { deleted: boolean } {
  requirePermission('medicines.manage', 'remove medicines')
  return mutate((db) => {
    const m = findOrThrow(db.medicines, id, 'Medicine')
    const hasHistory = db.movements.some((x) => x.medicineId === id) || db.batches.some((b) => b.medicineId === id)
    if (hasHistory) {
      m.isActive = false
      m.updatedAt = new Date().toISOString()
      return { deleted: false }
    }
    db.medicines = db.medicines.filter((x) => x.id !== id)
    return { deleted: true }
  })
}

export function medicineLookups(): MedicineLookups {
  const db = getDb()
  return {
    categories: [...new Set([...db.settings.categories, ...db.medicines.map((m) => m.category)])].sort(),
    manufacturers: [...new Set(db.medicines.map((m) => m.manufacturer))].sort(),
  }
}

export function suggestMedicineCode(): string {
  const db = getDb()
  const max = db.medicines.reduce((acc, m) => {
    const n = Number(m.code.replace(/\D/g, ''))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 1000)
  return `SMS-${max + 1}`
}

/** POS search across name, generic name, code and barcode. Exact barcode/code matches rank first. */
export function searchForSale(term: string, limit = 12): SaleableMedicine[] {
  const db = getDb()
  const q = term.trim().toLowerCase()
  if (!q) return []
  const map = batchesByMedicine(db)
  const scored = db.medicines
    .filter((m) => m.isActive)
    .map((m) => {
      let score = 0
      if (m.barcode === q || m.code.toLowerCase() === q) score = 100
      else if (m.name.toLowerCase().startsWith(q)) score = 60
      else if (m.name.toLowerCase().includes(q)) score = 40
      else if (m.genericName.toLowerCase().includes(q)) score = 30
      else if (m.code.toLowerCase().includes(q) || m.barcode.includes(q) || m.composition.toLowerCase().includes(q)) score = 20
      return { m, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name))
    .slice(0, limit)
  return scored.map(({ m }) => ({
    medicine: m,
    stock: stockFor(db, m, map),
    batches: fefoSort((map.get(m.id) ?? []).filter((b) => b.quantity > 0)).map((b) => toBatchView(db, b, m)),
  }))
}

export function getSaleable(medicineId: string): SaleableMedicine {
  const db = getDb()
  const m = findOrThrow(db.medicines, medicineId, 'Medicine')
  const map = batchesByMedicine(db)
  return {
    medicine: m,
    stock: stockFor(db, m, map),
    batches: fefoSort((map.get(m.id) ?? []).filter((b) => b.quantity > 0)).map((b) => toBatchView(db, b, m)),
  }
}
