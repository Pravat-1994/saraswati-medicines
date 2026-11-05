import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Banknote,
  CreditCard,
  QrCode,
  CalendarClock,
  IndianRupee,
  Package,
  PackageX,
  Pill,
  ReceiptText,
  ScanBarcode,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { dashboardService } from '../../services'
import { formatINR, formatINRShort, formatNumber } from '../../lib/money'
import { describeRange, eachDay, formatMonthYear, formatShortDay, formatTime, relativeTime } from '../../lib/dates'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { cn } from '../../lib/utils'
import { useSessionStore, useCan } from '../../stores/sessionStore'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import { pctChange } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { DateRangeFilter, type DateFilterValue } from '../../components/ui/DateRangeFilter'
import { dateFilter } from '../../lib/dates'
import { ErrorState, EmptyState, Skeleton } from '../../components/ui/Feedback'
import { Badge, PoStatusBadge } from '../../components/ui/Badge'
import { Legend, RankedBars, SegmentedBar, SERIES, TrendChart } from '../../components/charts/Charts'
import type { DashboardSummary } from '../../types/views'
import type { PaymentMethod } from '../../types/domain'
import { ClinicalHome } from './ClinicalHome'
import { HealthcareToday } from './HealthcareToday'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const HEALTH_COLORS: Record<string, string> = { healthy: SERIES[0], low: SERIES[4], out: '#d03b3b', near: SERIES[2], expired: '#7c2d12' }

/**
 * Role-aware home: pharmacy roles see the store dashboard (plus today's clinic
 * activity when they have healthcare access); clinical roles get a clinical home.
 */
export default function DashboardPage() {
  const can = useCan()
  if (!can('sales.view')) return <ClinicalHome />
  return (
    <div className="space-y-8">
      <PharmacyDashboard />
      {(can('appointments.view') || can('admissions.view')) && <HealthcareToday />}
    </div>
  )
}

function PharmacyDashboard() {
  const [filter, setFilter] = useState<DateFilterValue>(dateFilter('MONTH'))
  const user = useSessionStore((s) => s.user)
  const can = useCan()
  const navigate = useNavigate()
  const q = useQuery(() => dashboardService.summary(filter.range), [filter.range.from, filter.range.to], { tags: ['dashboard', 'sales', 'inventory', 'purchases'] })
  const d = q.data

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl brand-gradient px-6 py-6 text-white shadow-raised sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-accent-300/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-brand-300/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-100/80">
              {greeting()}, {user?.name.split(' ')[0]}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Store overview</h1>
            <p className="mt-1.5 max-w-xl text-sm text-brand-100/75">
              {d ? (
                <>
                  <span className="font-semibold text-white">{formatINR(d.salesToday)}</span> billed today across{' '}
                  <span className="font-semibold text-white">{d.billsToday}</span> invoices.
                  {d.pendingApprovals > 0 && <> {d.pendingApprovals} item(s) awaiting approval.</>}
                </>
              ) : (
                'Loading today’s activity…'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('sales.pos') && (
              <Button variant="accent" icon={<ScanBarcode className="h-4 w-4" />} onClick={() => navigate('/pos')}>
                New sale
              </Button>
            )}
            {can('purchases.manage') && (
              <Button className="bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20" variant="ghost" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate('/purchases/new')}>
                Purchase order
              </Button>
            )}
            {can('medicines.manage') && (
              <Button className="bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20" variant="ghost" icon={<Pill className="h-4 w-4" />} onClick={() => navigate('/medicines/new')}>
                Add medicine
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">Performance</h2>
          <p className="text-[13px] text-ink-500">{describeRange(filter.range)} · compared with the previous period</p>
        </div>
        <DateRangeFilter value={filter} onChange={setFilter} />
      </div>

      {q.error && !d ? (
        <Card>
          <ErrorState message={q.error} onRetry={q.refetch} />
        </Card>
      ) : !d ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody d={d} />
      )}
    </div>
  )
}

function DashboardBody({ d }: { d: DashboardSummary }) {
  const navigate = useNavigate()
  const can = useCan()
  // The service buckets by month for ranges longer than 62 days.
  const monthly = eachDay(d.range).length > 62
  const margin = d.salesTotal.value > 0 ? (d.grossProfit.value / d.salesTotal.value) * 100 : 0
  const healthTotal = d.inventoryHealth.reduce((a, h) => a + h.count, 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Sales in period" value={formatINR(d.salesTotal.value)} icon={<IndianRupee className="h-4 w-4" />} delta={pctChange(d.salesTotal.value, d.salesTotal.previous)} deltaLabel="vs previous" />
        <StatCard label="Gross profit" value={formatINR(d.grossProfit.value)} icon={<TrendingUp className="h-4 w-4" />} tone="blue" delta={pctChange(d.grossProfit.value, d.grossProfit.previous)} footer={`${margin.toFixed(1)}% margin`} />
        <StatCard label="Invoices" value={formatNumber(d.billCount.value)} icon={<ReceiptText className="h-4 w-4" />} tone="violet" delta={pctChange(d.billCount.value, d.billCount.previous)} footer={`Avg ${formatINR(d.averageBill.value)}`} />
        <StatCard
          label="Monthly revenue"
          value={formatINR(d.monthRevenue)}
          icon={<Wallet className="h-4 w-4" />}
          tone="amber"
          delta={pctChange(d.monthRevenue, d.monthRevenuePrevious)}
          deltaLabel="vs last month, same days"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Medicines" value={formatNumber(d.totalMedicines)} sub={`${d.activeMedicines} active`} icon={<Package className="h-4 w-4" />} to="/medicines" tone="brand" />
        <MiniStat label="Low stock" value={d.lowStockCount} sub="below minimum" icon={<AlertTriangle className="h-4 w-4" />} to="/inventory?tab=alerts" tone="amber" />
        <MiniStat label="Out of stock" value={d.outOfStockCount} sub="cannot be sold" icon={<PackageX className="h-4 w-4" />} to="/inventory?tab=alerts" tone="red" />
        <MiniStat label="Expiring soon" value={d.nearExpiryCount} sub="medicines" icon={<CalendarClock className="h-4 w-4" />} to="/inventory?tab=alerts" tone="amber" />
        <MiniStat label="Expired stock" value={d.expiredCount} sub="medicines to write off" icon={<Ban className="h-4 w-4" />} to="/inventory?tab=alerts" tone="red" />
        <MiniStat label="Customers" value={formatNumber(d.totalCustomers)} sub={`${d.newCustomers} new in 30 days`} icon={<Users className="h-4 w-4" />} to="/customers" tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Sales performance"
            description={`Revenue and gross profit${monthly ? ' by month' : ' by day'}`}
            action={<Legend items={[{ label: 'Revenue', color: SERIES[0] }, { label: 'Gross profit', color: SERIES[1] }]} />}
          />
          <CardBody>
            {d.salesTrend.every((p) => p.revenue === 0) ? (
              <EmptyState compact title="No sales in this period" description="Completed sales will appear here." />
            ) : (
              <TrendChart
                data={d.salesTrend}
                xKey="date"
                formatX={(v) => (monthly ? formatMonthYear(v) : formatShortDay(v))}
                series={[
                  { key: 'revenue', label: 'Revenue', color: SERIES[0], type: d.salesTrend.length > 1 ? 'area' : 'bar' },
                  { key: 'profit', label: 'Gross profit', color: SERIES[1], type: d.salesTrend.length > 1 ? 'line' : 'bar' },
                ]}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Inventory health" description={`${healthTotal} status flags across ${d.activeMedicines} medicines`} action={<Link to="/inventory" className="text-xs font-semibold text-brand-700 hover:text-brand-800">Inventory →</Link>} />
          <CardBody>
            <SegmentedBar format={(v) => formatNumber(v)} parts={d.inventoryHealth.map((h) => ({ label: h.label, value: h.count, color: HEALTH_COLORS[h.key] ?? SERIES[3] }))} />
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
              <div className="rounded-xl bg-ink-50 p-3">
                <div className="text-xs text-ink-500">Supplier dues</div>
                <div className="num mt-0.5 font-display text-lg font-bold text-ink-900">{formatINRShort(d.pendingSupplierPayments)}</div>
                <div className="text-[11px] text-ink-500">{d.pendingSupplierCount} suppliers</div>
              </div>
              <div className="rounded-xl bg-ink-50 p-3">
                <div className="text-xs text-ink-500">Pending approvals</div>
                <div className="num mt-0.5 font-display text-lg font-bold text-ink-900">{d.pendingApprovals}</div>
                <div className="text-[11px] text-ink-500">returns & adjustments</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Top-selling medicines" description="By net revenue in period" />
          <CardBody>
            {d.topMedicines.length === 0 ? (
              <EmptyState compact title="No sales yet" />
            ) : (
              <RankedBars items={d.topMedicines.map((m) => ({ key: m.medicineId, label: m.name, value: m.revenue, sub: `${m.units} units` }))} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payment methods" description="Share of net sales" />
          <CardBody>
            <SegmentedBar parts={d.paymentMix.map((p, i) => ({ label: PAYMENT_METHOD_LABEL[p.method], value: p.amount, color: SERIES[i + 1] }))} />
            <div className="mt-6">
              <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Revenue by category</div>
              <RankedBars color={SERIES[1]} items={d.categoryMix.slice(0, 5).map((c) => ({ key: c.category, label: c.category, value: c.revenue }))} />
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Needs attention" description="Stock and expiry alerts" action={<Link to="/inventory?tab=alerts" className="text-xs font-semibold text-brand-700 hover:text-brand-800">All alerts →</Link>} />
          <CardBody className="px-2">
            {d.alerts.length === 0 ? (
              <EmptyState compact title="All clear" description="No stock or expiry alerts right now." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {d.alerts.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => navigate(`/medicines/${a.medicineId}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ink-50">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          a.severity === 'critical' ? 'bg-red-50 text-red-600' : a.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700',
                        )}
                      >
                        {a.kind === 'OUT_OF_STOCK' ? <PackageX className="h-4 w-4" /> : a.kind === 'LOW_STOCK' ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{a.medicineName}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {a.kind === 'OUT_OF_STOCK' && 'Out of stock — reorder now'}
                          {a.kind === 'LOW_STOCK' && `${a.quantity} left · minimum ${a.minStockLevel}`}
                          {a.kind === 'EXPIRED' && `Batch ${a.batchNumber} expired · ${a.quantity} units`}
                          {a.kind === 'NEAR_EXPIRY' && `Batch ${a.batchNumber} · ${a.daysToExpiry} days left`}
                        </span>
                      </span>
                      <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>
                        {a.kind === 'OUT_OF_STOCK' ? 'Out' : a.kind === 'LOW_STOCK' ? 'Low' : a.kind === 'EXPIRED' ? 'Expired' : 'Expiring'}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent sales" icon={<ReceiptText className="h-4 w-4" />} action={can('sales.view') && <Link to="/sales" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">View all <ArrowRight className="h-3 w-3" /></Link>} />
          <ul className="divide-y divide-ink-100 px-2 pb-2">
            {d.recentSales.map((s) => (
              <li key={s.id}>
                <Link to={`/sales/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700" title={PAYMENT_METHOD_LABEL[s.paymentMethod]}>
                    <PaymentIcon method={s.paymentMethod} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{s.customerName}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {s.invoiceNumber} · {PAYMENT_METHOD_LABEL[s.paymentMethod]} · {s.itemCount} item{s.itemCount > 1 ? 's' : ''} · {relativeTime(s.date)}
                    </span>
                  </span>
                  <span className="num text-right text-[13px] font-semibold text-ink-900">{formatINR(s.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent purchase activity" icon={<Truck className="h-4 w-4" />} action={can('purchases.view') && <Link to="/purchases" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">View all <ArrowRight className="h-3 w-3" /></Link>} />
          <ul className="divide-y divide-ink-100 px-2 pb-2">
            {d.recentPurchases.map((p) => (
              <li key={p.id}>
                <Link to={`/purchases/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{p.supplierName}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {p.poNumber} · {p.itemCount} items · {formatShortDay(p.orderDate)} {p.createdAt ? `· ${formatTime(p.createdAt)}` : ''}
                    </span>
                  </span>
                  <PoStatusBadge status={p.status} />
                  <span className="num hidden w-24 text-right text-[13px] font-semibold text-ink-900 sm:block">{formatINR(p.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

function PaymentIcon({ method }: { method: PaymentMethod }) {
  const Icon = method === 'CASH' ? Banknote : method === 'UPI' ? QrCode : method === 'CARD' ? CreditCard : Wallet
  return <Icon className="h-4 w-4" aria-hidden />
}

function MiniStat({ label, value, sub, icon, to, tone }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode; to: string; tone: 'brand' | 'amber' | 'red' | 'blue' }) {
  const t = { brand: 'text-brand-700 bg-brand-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-600 bg-red-50', blue: 'text-sky-700 bg-sky-50' }[tone]
  return (
    <Link to={to} className="group rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', t)}>{icon}</span>
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      <div className="num mt-2 font-display text-xl font-bold text-ink-950">{value}</div>
      <div className="truncate text-[11px] text-ink-500">{sub}</div>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
