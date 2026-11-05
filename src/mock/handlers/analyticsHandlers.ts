/** Dashboard & report aggregations, all derived from the underlying records. */
import { eachDay, formatMonthYear, isWithinRange, localDay, parseISODate, presetRange, previousRange, toISODate } from '../../lib/dates'
import { round2, sumMoney } from '../../lib/money'
import { poOutstanding, poReceivedValue } from '../../lib/purchases'
import { ServiceError, type DateRange } from '../../types/api'
import type { PaymentMethod, Sale } from '../../types/domain'
import type { DashboardSummary, MedicineSalesRow, PaymentBreakdownRow, PurchaseReport, SalesReport, SalesReportRow } from '../../types/views'
import { getDb } from '../db'
import { toPoListItem, toSaleListItem } from '../helpers'
import { inventoryAlerts, inventoryOverview } from './inventoryHandlers'

const METHODS: PaymentMethod[] = ['CASH', 'UPI', 'CARD', 'OTHER']

/** Net revenue of a sale after approved returns. */
function netOfReturns(s: Sale): { revenue: number; cost: number; refunds: number } {
  let refunds = 0
  let returnedCost = 0
  for (const i of s.items) {
    if (i.returnedQuantity <= 0) continue
    refunds += (i.lineTotal * i.returnedQuantity) / i.quantity
    returnedCost += i.unitCost * i.returnedQuantity
  }
  return { revenue: s.grandTotal - refunds, cost: s.costTotal - returnedCost, refunds }
}

function salesIn(range: DateRange): Sale[] {
  return getDb().sales.filter((s) => isWithinRange(s.date, range))
}

function validateRange(range: DateRange): void {
  if (!range.from || !range.to || range.from > range.to) throw new ServiceError('Choose a valid date range.', 'VALIDATION', 422)
}

export function dashboardSummary(range: DateRange): DashboardSummary {
  validateRange(range)
  const db = getDb()
  const prev = previousRange(range)
  const cur = salesIn(range)
  const old = salesIn(prev)
  const agg = (list: Sale[]) => {
    let revenue = 0
    let cost = 0
    for (const s of list) {
      const n = netOfReturns(s)
      revenue += n.revenue
      cost += n.cost
    }
    return { revenue: round2(revenue), profit: round2(revenue - cost), bills: list.length }
  }
  const a = agg(cur)
  const b = agg(old)
  const today = presetRange('TODAY')
  const todaySales = salesIn(today)
  const month = presetRange('MONTH')
  // Previous month, same period-to-date (e.g. 1–5 Oct vs 1–5 Nov).
  const monthStart = parseISODate(month.from)
  const monthLen = eachDay(month).length
  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
  const prevMonthDays = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate()
  const prevMonth = { from: toISODate(prevMonthStart), to: toISODate(new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), Math.min(monthLen, prevMonthDays))) }

  // Trend: daily for ≤ 62 days, otherwise monthly.
  const days = eachDay(range)
  const trendMap = new Map<string, { revenue: number; profit: number; bills: number }>()
  const monthly = days.length > 62
  const keyOf = (iso: string) => (monthly ? localDay(iso).slice(0, 7) : localDay(iso))
  ;(monthly ? [...new Set(days.map((d) => d.slice(0, 7)))] : days).forEach((k) => trendMap.set(k, { revenue: 0, profit: 0, bills: 0 }))
  const medAgg = new Map<string, { name: string; units: number; revenue: number }>()
  const catAgg = new Map<string, number>()
  const payAgg = new Map<PaymentMethod, { amount: number; count: number }>()
  const catOf = new Map(db.medicines.map((m) => [m.id, m.category]))
  for (const s of cur) {
    const n = netOfReturns(s)
    const t = trendMap.get(keyOf(s.date))
    if (t) {
      t.revenue += n.revenue
      t.profit += n.revenue - n.cost
      t.bills++
    }
    const p = payAgg.get(s.paymentMethod) ?? { amount: 0, count: 0 }
    p.amount += n.revenue
    p.count++
    payAgg.set(s.paymentMethod, p)
    for (const i of s.items) {
      const units = i.quantity - i.returnedQuantity
      const rev = (i.lineTotal * units) / i.quantity
      const m = medAgg.get(i.medicineId) ?? { name: i.medicineName, units: 0, revenue: 0 }
      m.units += units
      m.revenue += rev
      medAgg.set(i.medicineId, m)
      const c = catOf.get(i.medicineId) ?? 'Other'
      catAgg.set(c, (catAgg.get(c) ?? 0) + rev)
    }
  }
  const overview = inventoryOverview()
  const alerts = inventoryAlerts()
  const activePos = db.purchaseOrders.filter((p) => poOutstanding(p) > 0)
  const expiredCount = new Set(alerts.filter((x) => x.kind === 'EXPIRED').map((x) => x.medicineId)).size
  const nearCount = new Set(alerts.filter((x) => x.kind === 'NEAR_EXPIRY').map((x) => x.medicineId)).size
  const okCount = overview.skuCount - overview.lowStockCount - overview.outOfStockCount
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  return {
    range,
    salesTotal: { value: a.revenue, previous: b.revenue },
    billCount: { value: a.bills, previous: b.bills },
    averageBill: { value: a.bills ? round2(a.revenue / a.bills) : 0, previous: b.bills ? round2(b.revenue / b.bills) : 0 },
    grossProfit: { value: a.profit, previous: b.profit },
    salesToday: agg(todaySales).revenue,
    billsToday: todaySales.length,
    monthRevenue: agg(salesIn(month)).revenue,
    monthRevenuePrevious: agg(salesIn(prevMonth)).revenue,
    totalMedicines: db.medicines.length,
    activeMedicines: overview.skuCount,
    lowStockCount: overview.lowStockCount,
    outOfStockCount: overview.outOfStockCount,
    nearExpiryCount: nearCount,
    expiredCount,
    totalCustomers: db.customers.length,
    newCustomers: db.customers.filter((c) => c.createdAt >= thirtyAgo).length,
    pendingSupplierPayments: sumMoney(activePos.map(poOutstanding)),
    pendingSupplierCount: new Set(activePos.map((p) => p.supplierId)).size,
    pendingApprovals: db.adjustments.filter((x) => x.status === 'PENDING').length + db.returns.filter((x) => x.status === 'PENDING').length,
    salesTrend: [...trendMap.entries()].map(([date, v]) => ({ date: monthly ? `${date}-01` : date, revenue: round2(v.revenue), profit: round2(v.profit), bills: v.bills })),
    topMedicines: [...medAgg.entries()]
      .map(([medicineId, v]) => ({ medicineId, name: v.name, units: v.units, revenue: round2(v.revenue) }))
      .sort((x, y) => y.revenue - x.revenue)
      .slice(0, 8),
    categoryMix: [...catAgg.entries()].map(([category, revenue]) => ({ category, revenue: round2(revenue) })).sort((x, y) => y.revenue - x.revenue),
    paymentMix: METHODS.map((method) => ({ method, amount: round2(payAgg.get(method)?.amount ?? 0), count: payAgg.get(method)?.count ?? 0 })),
    inventoryHealth: [
      { key: 'healthy', label: 'Healthy stock', count: Math.max(0, okCount) },
      { key: 'low', label: 'Low stock', count: overview.lowStockCount },
      { key: 'out', label: 'Out of stock', count: overview.outOfStockCount },
      { key: 'near', label: 'Near expiry', count: nearCount },
      { key: 'expired', label: 'Expired batches', count: expiredCount },
    ],
    recentSales: db.sales.slice(0, 8).map(toSaleListItem),
    recentPurchases: [...db.purchaseOrders].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 6).map(toPoListItem),
    alerts: alerts.slice(0, 8),
  }
}

const emptyRow = (period: string): SalesReportRow => ({ period, bills: 0, units: 0, gross: 0, discount: 0, taxable: 0, gst: 0, net: 0, cost: 0, profit: 0, returns: 0 })

export function salesReport(range: DateRange, granularity: 'day' | 'month'): SalesReport {
  validateRange(range)
  const list = salesIn(range)
  const rows = new Map<string, SalesReportRow>()
  if (granularity === 'day') eachDay(range).forEach((d) => rows.set(d, emptyRow(d)))
  const totals = emptyRow('Total')
  const pay = new Map<PaymentMethod, { bills: number; amount: number }>()
  const gst = new Map<number, { taxable: number; gst: number }>()
  for (const s of list) {
    const day = localDay(s.date)
    const key = granularity === 'day' ? day : day.slice(0, 7)
    const r = rows.get(key) ?? emptyRow(key)
    const n = netOfReturns(s)
    for (const target of [r, totals]) {
      target.bills++
      target.units += s.items.reduce((acc, i) => acc + i.quantity - i.returnedQuantity, 0)
      target.gross += s.subtotal
      target.discount += s.discountTotal
      target.taxable += s.taxableTotal
      target.gst += s.gstTotal
      target.net += n.revenue
      target.cost += n.cost
      target.returns += n.refunds
    }
    rows.set(key, r)
    const p = pay.get(s.paymentMethod) ?? { bills: 0, amount: 0 }
    p.bills++
    p.amount += n.revenue
    pay.set(s.paymentMethod, p)
    for (const i of s.items) {
      const g = gst.get(i.gstRate) ?? { taxable: 0, gst: 0 }
      g.taxable += i.taxableAmount
      g.gst += i.gstAmount
      gst.set(i.gstRate, g)
    }
  }
  const fin = (r: SalesReportRow): SalesReportRow => ({
    ...r,
    period: granularity === 'month' && r.period !== 'Total' ? formatMonthYear(`${r.period}-01`) : r.period,
    gross: round2(r.gross),
    discount: round2(r.discount),
    taxable: round2(r.taxable),
    gst: round2(r.gst),
    net: round2(r.net),
    cost: round2(r.cost),
    profit: round2(r.net - r.cost),
    returns: round2(r.returns),
  })
  const totalAmount = sumMoney([...pay.values()].map((p) => p.amount))
  const payments: PaymentBreakdownRow[] = METHODS.map((method) => {
    const p = pay.get(method) ?? { bills: 0, amount: 0 }
    return { method, bills: p.bills, amount: round2(p.amount), share: totalAmount > 0 ? (p.amount / totalAmount) * 100 : 0 }
  })
  return {
    rows: [...rows.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, r]) => fin(r)),
    totals: fin(totals),
    payments,
    gstByRate: [...gst.entries()].sort((x, y) => x[0] - y[0]).map(([rate, v]) => ({ rate, taxable: round2(v.taxable), gst: round2(v.gst) })),
  }
}

export function medicineSalesReport(range: DateRange): MedicineSalesRow[] {
  validateRange(range)
  const db = getDb()
  const meds = new Map(db.medicines.map((m) => [m.id, m]))
  const agg = new Map<string, MedicineSalesRow & { billSet: Set<string> }>()
  for (const s of salesIn(range)) {
    for (const i of s.items) {
      const units = i.quantity - i.returnedQuantity
      if (units <= 0) continue
      const m = meds.get(i.medicineId)
      const row = agg.get(i.medicineId) ?? {
        medicineId: i.medicineId,
        medicineName: i.medicineName,
        medicineCode: i.medicineCode,
        category: m?.category ?? '—',
        units: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: 0,
        bills: 0,
        billSet: new Set<string>(),
      }
      row.units += units
      row.revenue += (i.lineTotal * units) / i.quantity
      row.cost += i.unitCost * units
      row.billSet.add(s.id)
      agg.set(i.medicineId, row)
    }
  }
  return [...agg.values()]
    .map(({ billSet, ...r }) => ({
      ...r,
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      profit: round2(r.revenue - r.cost),
      marginPct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0,
      bills: billSet.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function purchaseReport(range: DateRange): PurchaseReport {
  validateRange(range)
  const db = getDb()
  const pos = db.purchaseOrders.filter((p) => p.status !== 'CANCELLED' && p.status !== 'DRAFT' && isWithinRange(p.orderDate, range))
  const bySupplier = new Map<string, PurchaseReport['rows'][number]>()
  const monthly = new Map<string, { value: number; orders: number }>()
  for (const p of pos) {
    const r = bySupplier.get(p.supplierId) ?? { supplierId: p.supplierId, supplierName: p.supplierName, orders: 0, received: 0, value: 0, gst: 0, paid: 0, outstanding: 0 }
    const received = poReceivedValue(p)
    r.orders++
    if (p.status === 'RECEIVED') r.received++
    r.value += received
    r.gst += received > 0 ? (p.gstTotal * received) / Math.max(0.01, p.grandTotal) : 0
    r.paid += p.amountPaid
    r.outstanding += poOutstanding(p)
    bySupplier.set(p.supplierId, r)
    const mk = p.orderDate.slice(0, 7)
    const m = monthly.get(mk) ?? { value: 0, orders: 0 }
    m.value += received
    m.orders++
    monthly.set(mk, m)
  }
  const rows = [...bySupplier.values()]
    .map((r) => ({ ...r, value: round2(r.value), gst: round2(r.gst), paid: round2(r.paid), outstanding: round2(r.outstanding) }))
    .sort((a, b) => b.value - a.value)
  return {
    rows,
    monthly: [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month: formatMonthYear(`${month}-01`), value: round2(v.value), orders: v.orders })),
    totals: {
      orders: rows.reduce((a, r) => a + r.orders, 0),
      value: sumMoney(rows.map((r) => r.value)),
      gst: sumMoney(rows.map((r) => r.gst)),
      paid: sumMoney(rows.map((r) => r.paid)),
      outstanding: sumMoney(rows.map((r) => r.outstanding)),
    },
  }
}
