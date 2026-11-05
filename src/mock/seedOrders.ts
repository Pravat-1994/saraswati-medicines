/** Sample online orders covering every stage of the fulfilment workflow. */
import { toISODate } from '../lib/dates'
import { fefoSort } from '../lib/inventory'
import { round2, sumMoney } from '../lib/money'
import type { Batch, Customer, Medicine, OnlineOrder, OnlineOrderAllocation, OnlineOrderItem, Sale } from '../types/domain'
import type { CounterKey } from './seed'

interface SeedRng {
  int: (min: number, max: number) => number
}

interface Ctx {
  rng: SeedRng
  now: Date
  today: Date
  medicines: Medicine[]
  batches: Batch[]
  customers: Customer[]
  /** Chronological (oldest first). */
  sales: Sale[]
  nextNo: (key: CounterKey, prefix: string, date: Date) => string
  userName: (id: string) => string
}

export function seedOnlineOrders(ctx: Ctx): OnlineOrder[] {
  const { now, today, medicines, batches, customers, sales, nextNo, userName } = ctx
  const todayIso = toISODate(today)
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000)
  const byName = (name: string) => medicines.find((m) => m.name === name)
  const orders: OnlineOrder[] = []

  /** Reserve stock FEFO (moves units from available to reserved). */
  const reserve = (medicineId: string, qty: number): OnlineOrderAllocation[] => {
    let remaining = qty
    const out: OnlineOrderAllocation[] = []
    for (const b of fefoSort(batches.filter((x) => x.medicineId === medicineId && x.quantity > 0 && x.expiryDate >= todayIso))) {
      if (remaining <= 0) break
      const take = Math.min(b.quantity, remaining)
      b.quantity -= take
      b.reserved += take
      remaining -= take
      out.push({ batchId: b.id, batchNumber: b.batchNumber, expiryDate: b.expiryDate, quantity: take })
    }
    return out
  }

  const priceOf = (medicineId: string) => {
    const fefo = fefoSort(batches.filter((x) => x.medicineId === medicineId && x.quantity > 0 && x.expiryDate >= todayIso))[0]
    return fefo?.sellingPrice ?? medicines.find((m) => m.id === medicineId)!.sellingPrice
  }

  const build = (
    lines: [string, number][],
    o: Omit<OnlineOrder, 'id' | 'orderNumber' | 'items' | 'estimatedTotal' | 'prescriptionRequired' | 'timeline'> & { reserveStock?: boolean },
    timeline: OnlineOrder['timeline'],
  ) => {
    const items: OnlineOrderItem[] = lines
      .map(([name, qty]) => [byName(name), qty] as const)
      .filter((x): x is readonly [Medicine, number] => !!x[0])
      .map(([m, qty], i) => {
        const unitPrice = priceOf(m.id)
        return {
          lineId: `ol_${orders.length + 1}_${i + 1}`,
          medicineId: m.id,
          medicineName: m.name,
          packSize: m.packSize,
          prescriptionRequired: m.prescriptionRequired,
          quantity: qty,
          unitPrice,
          lineTotal: round2(unitPrice * qty),
          allocations: o.reserveStock ? reserve(m.id, qty) : [],
        }
      })
    const { reserveStock, ...rest } = o
    void reserveStock
    const placed = new Date(o.placedAt)
    orders.push({
      ...rest,
      id: `ord_${String(orders.length + 1).padStart(3, '0')}`,
      orderNumber: nextNo('order', 'WEB', placed),
      items,
      estimatedTotal: sumMoney(items.map((i) => i.lineTotal)),
      prescriptionRequired: items.some((i) => i.prescriptionRequired),
      timeline,
    })
  }

  const ev = (status: OnlineOrder['timeline'][number]['status'], at: Date, by: string, note?: string) => ({ status, at: at.toISOString(), by, note })
  const ramesh = customers[0]
  const sunita = customers[1]
  const prakash = customers[12]

  // Completed orders: linked to real seeded sales from registered customers.
  const recent = sales.filter((s) => s.customerId && now.getTime() - new Date(s.date).getTime() < 6 * 86_400_000 && now.getTime() - new Date(s.date).getTime() > 86_400_000).slice(-2)
  recent.forEach((s, idx) => {
    const placed = new Date(new Date(s.date).getTime() - (90 + idx * 30) * 60_000)
    const customer = customers.find((c) => c.id === s.customerId)!
    const items: OnlineOrderItem[] = s.items.map((it, i) => ({
      lineId: `ol_c${idx}_${i}`,
      medicineId: it.medicineId,
      medicineName: it.medicineName,
      packSize: medicines.find((m) => m.id === it.medicineId)?.packSize ?? '',
      prescriptionRequired: !!medicines.find((m) => m.id === it.medicineId)?.prescriptionRequired,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: round2(it.unitPrice * it.quantity),
      allocations: [{ batchId: it.batchId, batchNumber: it.batchNumber, expiryDate: it.expiryDate, quantity: it.quantity }],
    }))
    const rx = items.some((i) => i.prescriptionRequired)
    orders.push({
      id: `ord_${String(orders.length + 1).padStart(3, '0')}`,
      orderNumber: nextNo('order', 'WEB', placed),
      placedAt: placed.toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      fulfilment: idx === 0 ? 'DELIVERY' : 'PICKUP',
      deliveryAddress: idx === 0 ? customer.address : undefined,
      items,
      estimatedTotal: sumMoney(items.map((i) => i.lineTotal)),
      status: 'COMPLETED',
      prescriptionRequired: rx,
      prescriptionRef: rx ? `RX-${ctx.rng.int(1000, 9999)}` : undefined,
      doctorName: rx ? 'Dr. Satyajit Kar' : undefined,
      prescriptionVerified: rx,
      prescriptionVerifiedBy: rx ? userName('usr_pharmacist') : undefined,
      paymentPreference: idx === 0 ? 'UPI_ON_DELIVERY' : 'PAY_AT_STORE',
      saleId: s.id,
      invoiceNumber: s.invoiceNumber,
      timeline: [
        ev('PLACED', placed, customer.name),
        ...(rx ? [ev('RX_VERIFIED' as const, new Date(placed.getTime() + 10 * 60_000), userName('usr_pharmacist'))] : []),
        ev('CONFIRMED', new Date(placed.getTime() + 15 * 60_000), userName('usr_pharmacist'), 'Stock reserved'),
        ev(idx === 0 ? 'OUT_FOR_DELIVERY' : 'READY', new Date(placed.getTime() + 45 * 60_000), userName('usr_sales')),
        ev('COMPLETED', new Date(s.date), s.cashierName, `Invoice ${s.invoiceNumber}`),
      ],
    })
  })

  const cancelledAt = minsAgo(60 * 26)
  build(
    [['Allegra 120', 1], ['Otrivin Nasal Drops', 1]],
    { placedAt: cancelledAt.toISOString(), customerName: 'Ritika Das', customerPhone: '+91 98611 77420', fulfilment: 'DELIVERY', deliveryAddress: 'Flat 3B, Kalinga Vihar, Bhubaneswar 751019', status: 'CANCELLED', prescriptionVerified: false, paymentPreference: 'CASH_ON_DELIVERY', cancelReason: 'Customer cancelled — bought elsewhere', customerNote: 'Please call before delivery' },
    [ev('PLACED', cancelledAt, 'Ritika Das'), ev('CANCELLED', new Date(cancelledAt.getTime() + 50 * 60_000), userName('usr_manager'), 'Customer cancelled — bought elsewhere')],
  )

  const readyAt = minsAgo(150)
  build(
    [['Becosules Z', 2], ['Neurobion Forte', 1], ['Limcee 500', 2]],
    { placedAt: readyAt.toISOString(), customerId: sunita.id, customerName: sunita.name, customerPhone: sunita.phone, customerEmail: sunita.email, fulfilment: 'PICKUP', preferredSlot: 'Today, 6 – 8 pm', status: 'READY', prescriptionVerified: false, paymentPreference: 'PAY_AT_STORE', reserveStock: true },
    [ev('PLACED', readyAt, sunita.name), ev('CONFIRMED', new Date(readyAt.getTime() + 12 * 60_000), userName('usr_pharmacist'), 'Stock reserved'), ev('READY', new Date(readyAt.getTime() + 35 * 60_000), userName('usr_sales'), 'Packed — shelf R2')],
  )

  const confirmedAt = minsAgo(95)
  build(
    [['Glycomet GP 1', 2], ['Ecosprin 75', 2], ['Atorva 10', 1]],
    { placedAt: confirmedAt.toISOString(), customerId: ramesh.id, customerName: ramesh.name, customerPhone: ramesh.phone, fulfilment: 'DELIVERY', deliveryAddress: ramesh.address, preferredSlot: 'Today, 4 – 6 pm', status: 'CONFIRMED', prescriptionRef: 'RX-2291', doctorName: 'Dr. M. K. Mishra', prescriptionVerified: true, prescriptionVerifiedBy: userName('usr_pharmacist'), paymentPreference: 'UPI_ON_DELIVERY', customerNote: 'Monthly refill', reserveStock: true },
    [ev('PLACED', confirmedAt, ramesh.name), ev('RX_VERIFIED', new Date(confirmedAt.getTime() + 8 * 60_000), userName('usr_pharmacist'), 'Prescription valid'), ev('CONFIRMED', new Date(confirmedAt.getTime() + 9 * 60_000), userName('usr_pharmacist'), 'Stock reserved')],
  )

  const rxAt = minsAgo(38)
  build(
    [['Asthalin Inhaler', 1], ['Montair LC', 1]],
    { placedAt: rxAt.toISOString(), customerId: prakash.id, customerName: prakash.name, customerPhone: prakash.phone, fulfilment: 'PICKUP', preferredSlot: 'Tomorrow, 10 am – 12 pm', status: 'PLACED', prescriptionRef: 'AIIMS/OPD/55821', doctorName: 'Dr. A. Pattnaik', prescriptionFileName: 'prescription-oct.jpg', prescriptionVerified: false, paymentPreference: 'PAY_AT_STORE' },
    [ev('PLACED', rxAt, prakash.name)],
  )

  const newAt = minsAgo(12)
  build(
    [['Dolo 650', 2], ['Electral ORS', 4], ['Cetzine 10', 1]],
    { placedAt: newAt.toISOString(), customerName: 'Ankita Swain', customerPhone: '+91 70085 22914', customerEmail: 'ankita.swain@gmail.com', fulfilment: 'DELIVERY', deliveryAddress: 'Plot 221, Saheed Nagar, Bhubaneswar 751007', preferredSlot: 'As soon as possible', status: 'PLACED', prescriptionVerified: false, paymentPreference: 'CASH_ON_DELIVERY', customerNote: 'Fever since yesterday — please deliver quickly.' },
    [ev('PLACED', newAt, 'Ankita Swain')],
  )

  return orders.sort((a, b) => b.placedAt.localeCompare(a.placedAt))
}
