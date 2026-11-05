import { AlertOctagon, Archive, Boxes, CalendarClock, IndianRupee, PackageX, ShieldAlert, Tag } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { RankedBars, SegmentedBar, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { formatINR, formatINRShort, formatNumber } from '../../lib/money'
import { inventoryService } from '../../services'

const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' }

export function OverviewTab({ onTab }: { onTab: (tab: string) => void }) {
  const navigate = useNavigate()
  const q = useQuery(() => inventoryService.overview(), [], { tags: ['inventory', 'medicines', 'settings'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const o = q.data
  const totalUnits = o.sellableUnits + o.reservedUnits + o.damagedUnits + o.expiredUnits
  const bucketColors = [STATUS.critical, STATUS.serious, STATUS.warning, SERIES[1], SERIES[0]]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value (at cost)" value={formatINRShort(o.stockValueCost)} icon={<IndianRupee className="h-4 w-4" />} footer={formatINR(o.stockValueCost)} />
        <StatCard label="Retail value (MRP)" value={formatINRShort(o.stockValueRetail)} icon={<Tag className="h-4 w-4" />} tone="blue" footer={`Potential margin ${formatINRShort(o.stockValueRetail - o.stockValueCost)}`} />
        <StatCard label="Sellable units" value={formatNumber(o.sellableUnits)} icon={<Boxes className="h-4 w-4" />} tone="violet" footer={`${o.skuCount} active medicines`} />
        <StatCard
          label="Low / out of stock"
          value={
            <span>
              {o.lowStockCount} <span className="text-ink-300">/</span> <span className="text-red-600">{o.outOfStockCount}</span>
            </span>
          }
          icon={<PackageX className="h-4 w-4" />}
          tone="amber"
          footer="View alerts"
          onClick={() => onTab('alerts')}
        />
        <StatCard label="Near-expiry batches" value={o.nearExpiryBatches} icon={<CalendarClock className="h-4 w-4" />} tone="amber" footer="Sell first (FEFO)" onClick={() => navigate('/inventory?tab=batches&expiry=NEAR_EXPIRY')} />
        <StatCard label="Expired stock value" value={formatINR(o.expiredValue)} icon={<AlertOctagon className="h-4 w-4" />} tone="red" footer={`${formatNumber(o.expiredUnits)} units blocked from sale`} onClick={() => navigate('/inventory?tab=batches&expiry=EXPIRED')} />
        <StatCard label="Damaged units" value={formatNumber(o.damagedUnits)} icon={<ShieldAlert className="h-4 w-4" />} tone="ink" footer="Not sellable" />
        <StatCard label="Reserved units" value={formatNumber(o.reservedUnits)} icon={<Archive className="h-4 w-4" />} tone="ink" footer="Held for customer orders" />
      </div>

      <Card>
        <CardHeader title="Stock composition" description="Every unit on hand, by availability state. Only available units can be sold." />
        <CardBody>
          <SegmentedBar
            format={(v) => `${formatNumber(v)} units`}
            parts={[
              { label: 'Available', value: o.sellableUnits, color: SERIES[0] },
              { label: 'Reserved', value: o.reservedUnits, color: SERIES[1] },
              { label: 'Damaged', value: o.damagedUnits, color: STATUS.serious },
              { label: 'Expired', value: o.expiredUnits, color: STATUS.critical },
            ]}
          />
          <p className="mt-3 text-xs text-ink-400">Total on hand: {formatNumber(totalUnits)} units</p>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stock value by category" description="Sellable stock at purchase cost" />
          <CardBody>
            <RankedBars items={o.byCategory.slice(0, 10).map((c) => ({ key: c.category, label: c.category, value: c.value, sub: `${c.skus} SKUs · ${formatNumber(c.units)} units` }))} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Expiry profile" description="Batches with stock, by time to expiry (value at cost)" />
            <CardBody>
              <SegmentedBar parts={o.expiryBuckets.map((b, i) => ({ label: `${b.label} · ${b.batches} batches`, value: b.value, color: bucketColors[i] }))} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Value by location" description="Where sellable stock is held" />
            <CardBody>
              <RankedBars color={SERIES[1]} items={o.byLocation.map((l) => ({ key: l.location, label: l.location, value: l.value, sub: `${formatNumber(l.units)} units` }))} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
