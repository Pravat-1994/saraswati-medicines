import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { DateRangeFilter, type DateFilterValue } from '../../components/ui/DateRangeFilter'
import { dateFilter } from '../../lib/dates'
import { describeRange } from '../../lib/dates'
import SalesReportTab from './SalesReportTab'
import MedicineReportTab from './MedicineReportTab'
import ProfitReportTab from './ProfitReportTab'
import PurchaseReportTab from './PurchaseReportTab'
import PaymentReportTab from './PaymentReportTab'
import { ExpiryReportTab, InventoryValuationTab, LowStockReportTab } from './InventoryReportTabs'
import HealthcareReportTab from './HealthcareReportTab'
import { useCan } from '../../stores/sessionStore'

const TABS = [
  { key: 'sales', label: 'Sales', dated: true },
  { key: 'medicines', label: 'Medicine-wise', dated: true },
  { key: 'profit', label: 'Profit & revenue', dated: true },
  { key: 'purchases', label: 'Purchases', dated: true },
  { key: 'payments', label: 'Payment methods', dated: true },
  { key: 'valuation', label: 'Inventory valuation', dated: false },
  { key: 'lowstock', label: 'Low stock', dated: false },
  { key: 'expiry', label: 'Expiry', dated: false },
  { key: 'healthcare', label: 'Healthcare', dated: true },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const can = useCan()
  const healthcare = can('appointments.view') || can('billing.view') || can('admissions.view')
  const visible = TABS.filter((t) => t.key !== 'healthcare' || healthcare)
  const raw = params.get('tab')
  const tab: TabKey = visible.some((t) => t.key === raw) ? (raw as TabKey) : 'sales'
  const [date, setDate] = useState<DateFilterValue>(dateFilter('MONTH'))
  const dated = TABS.find((t) => t.key === tab)?.dated ?? true

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Sales, profitability, purchasing and stock health — every figure is derived from the underlying transactions."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Reports' }]}
      />
      <div className="no-print mb-6 flex flex-col gap-4">
        <Tabs<TabKey> items={visible.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {dated ? (
            <>
              <DateRangeFilter value={date} onChange={setDate} />
              <span className="text-xs text-ink-500">Period: {describeRange(date.range)}</span>
            </>
          ) : (
            <span className="text-[13px] text-ink-500">Live stock snapshot as of today — date range does not apply.</span>
          )}
        </div>
      </div>
      <div className="hidden print:mb-4 print:block">
        <h2 className="text-lg font-semibold">{TABS.find((t) => t.key === tab)?.label} report</h2>
        {dated && <p className="text-sm">{describeRange(date.range)}</p>}
      </div>
      {tab === 'sales' && <SalesReportTab range={date.range} />}
      {tab === 'medicines' && <MedicineReportTab range={date.range} />}
      {tab === 'profit' && <ProfitReportTab range={date.range} />}
      {tab === 'purchases' && <PurchaseReportTab range={date.range} />}
      {tab === 'payments' && <PaymentReportTab range={date.range} />}
      {tab === 'valuation' && <InventoryValuationTab />}
      {tab === 'lowstock' && <LowStockReportTab />}
      {tab === 'expiry' && <ExpiryReportTab />}
      {tab === 'healthcare' && healthcare && <HealthcareReportTab range={date.range} />}
    </>
  )
}
