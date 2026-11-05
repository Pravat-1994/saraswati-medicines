/**
 * Point-of-sale cart. Holds a client-side draft only; the sale is priced and
 * validated authoritatively by salesService.create.
 */
import { create } from 'zustand'
import type { Customer, PaymentMethod } from '../types/domain'
import type { BatchView, SaleableMedicine } from '../types/views'

export interface CartLine {
  key: string
  medicine: SaleableMedicine['medicine']
  batch: BatchView
  /** Other sellable batches (for batch switching). */
  batches: BatchView[]
  quantity: number
  discountPct: number
  fefoOverridden: boolean
}

interface PosState {
  lines: CartLine[]
  customer: Customer | null
  walkInName: string
  walkInPhone: string
  billDiscountPct: number
  paymentMethod: PaymentMethod
  paymentReference: string
  amountTendered: string
  prescriptionRef: string
  notes: string
  /** Dispensing against an e-prescription (set from the Prescriptions module). */
  prescription: { id: string; rxNo: string; patientId: string; patientName: string; doctorName: string } | null
  /** Bill to an inpatient account instead of collecting payment now. */
  chargeAccount: { accountId: string; accountNo: string; patientName: string } | null
  setPrescription: (p: PosState['prescription']) => void
  setChargeAccount: (a: PosState['chargeAccount']) => void
  /** Adds units, spilling over to the next FEFO batch when one batch runs out. */
  addMedicine: (item: SaleableMedicine, qty?: number) => { added: number; shortfall: number }
  setQuantity: (key: string, qty: number) => void
  setDiscount: (key: string, pct: number) => void
  changeBatch: (key: string, batchId: string, fefoBatchId?: string) => void
  removeLine: (key: string) => void
  setCustomer: (c: Customer | null) => void
  setField: <K extends 'walkInName' | 'walkInPhone' | 'paymentReference' | 'amountTendered' | 'prescriptionRef' | 'notes'>(key: K, value: string) => void
  setBillDiscount: (pct: number) => void
  setPaymentMethod: (m: PaymentMethod) => void
  clear: () => void
}

const empty = {
  lines: [] as CartLine[],
  customer: null,
  walkInName: '',
  walkInPhone: '',
  billDiscountPct: 0,
  paymentMethod: 'CASH' as PaymentMethod,
  paymentReference: '',
  amountTendered: '',
  prescriptionRef: '',
  notes: '',
  prescription: null as PosState['prescription'],
  chargeAccount: null as PosState['chargeAccount'],
}

const sellable = (b: BatchView) => b.expiryStatus !== 'EXPIRED' && b.quantity > 0

export const usePosStore = create<PosState>((set, get) => ({
  ...empty,

  addMedicine: (item, qty = 1) => {
    const lines = get().lines.map((l) => ({ ...l }))
    const batches = item.batches.filter(sellable)
    let remaining = qty
    for (const batch of batches) {
      if (remaining <= 0) break
      const existing = lines.find((l) => l.batch.id === batch.id)
      const inCart = existing?.quantity ?? 0
      const free = batch.quantity - inCart
      if (free <= 0) continue
      const take = Math.min(free, remaining)
      if (existing) existing.quantity += take
      else lines.push({ key: `${batch.id}`, medicine: item.medicine, batch, batches, quantity: take, discountPct: 0, fefoOverridden: false })
      remaining -= take
    }
    set({ lines })
    return { added: qty - remaining, shortfall: remaining }
  },

  setQuantity: (key, qty) =>
    set({ lines: get().lines.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(Math.floor(qty) || 1, l.batch.quantity)) } : l)) }),

  setDiscount: (key, pct) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, discountPct: Math.max(0, Math.min(100, pct || 0)) } : l)) }),

  changeBatch: (key, batchId, fefoBatchId) => {
    const lines = get().lines
    const line = lines.find((l) => l.key === key)
    const batch = line?.batches.find((b) => b.id === batchId)
    if (!line || !batch) return
    const merged = lines.find((l) => l.batch.id === batchId && l.key !== key)
    if (merged) {
      set({
        lines: lines
          .filter((l) => l.key !== key)
          .map((l) => (l.key === merged.key ? { ...l, quantity: Math.min(l.quantity + line.quantity, batch.quantity) } : l)),
      })
      return
    }
    set({
      lines: lines.map((l) =>
        l.key === key ? { ...l, key: batch.id, batch, quantity: Math.min(l.quantity, batch.quantity), fefoOverridden: !!fefoBatchId && fefoBatchId !== batch.id } : l,
      ),
    })
  },

  removeLine: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
  setCustomer: (customer) => set({ customer }),
  setField: (key, value) => set({ [key]: value } as Partial<PosState>),
  setBillDiscount: (pct) => set({ billDiscountPct: Math.max(0, Math.min(100, pct || 0)) }),
  setPrescription: (prescription) => set({ prescription, prescriptionRef: prescription ? `${prescription.rxNo} · ${prescription.doctorName}` : get().prescriptionRef }),
  setChargeAccount: (chargeAccount) => set({ chargeAccount }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod, paymentReference: '', amountTendered: '' }),
  clear: () => set({ ...empty }),
}))
