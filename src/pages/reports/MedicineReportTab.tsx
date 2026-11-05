import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CardBody } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { RankedBars, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { reportService } from '../../services'
import { formatINR, formatNumber, formatPct, sumMoney } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { DateRange } from '../../types/api'
import type { MedicineSalesRow } from '../../types/views'
import { ReportActions, ReportCard, TotalsFooter } from './ReportParts'

export default function MedicineReportTab({ range }: { range: DateRange }) {
  const q = useQuery(() => reportService.medicineSales(range), [range.from, range.to], { tags: ['sales', 'reports'] })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const all = useMemo(() => q.data ?? [], [q.data])
  const rows = useMemo(
    () =>
      all.filter(
        (r) => (!category || r.category === category) && (!search || `${r.medicineName} ${r.medicineCode}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [all, search, category],
  )

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading) return <Skeleton className="h-96 rounded-2xl" />

  const categories = [...new Set(all.map((r) => r.category))].sort()
  const revenue = sumMoney(rows.map((r) => r.revenue))
  const profit = sumMoney(rows.map((r) => r.profit))
  const columns: Column<MedicineSalesRow>[] = [
    {
      key: 'name',
      header: 'Medicine',
      sortable: true,
      sortValue: (r) => r.medicineName,
      cell: (r) => (
        <div>
          <Link to={`/medicines/${r.medicineId}`} className="font-medium text-ink-900 hover:text-brand-700">
            {r.medicineName}
          </Link>
          <div className="text-xs text-ink-500">
            {r.medicineCode} · {r.category}
          </div>
        </div>
      ),
    },
    { key: 'bills', header: 'Bills', align: 'right', sortable: true, sortValue: (r) => r.bills, cell: (r) => formatNumber(r.bills) },
    { key: 'units', header: 'Units', align: 'right', sortable: true, sortValue: (r) => r.units, cell: (r) => formatNumber(r.units) },
    { key: 'revenue', header: 'Revenue', align: 'right', sortable: true, sortValue: (r) => r.revenue, cell: (r) => <span className="font-semibold">{formatINR(r.revenue)}</span> },
    { key: 'cost', header: 'Cost', align: 'right', cell: (r) => formatINR(r.cost) },
    { key: 'profit', header: 'Profit', align: 'right', sortable: true, sortValue: (r) => r.profit, cell: (r) => <span className="text-emerald-700">{formatINR(r.profit)}</span> },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.marginPct,
      cell: (r) => <span className={cn('font-medium', r.marginPct < 20 ? 'text-amber-700' : 'text-ink-800')}>{formatPct(r.marginPct)}</span>,
    },
  ]

  if (all.length === 0)
    return (
      <ReportCard title="Medicine-wise sales">
        <EmptyState title="No medicines sold in this period" description="Choose a different date range." />
      </ReportCard>
    )

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <ReportCard
        title="Medicine-wise sales"
        description={`${rows.length} medicines · ${formatINR(revenue)} revenue`}
        actions={
          <ReportActions
            filename={`medicine-sales-${range.from}-to-${range.to}`}
            rows={rows}
            columns={[
              { header: 'Code', value: (r) => r.medicineCode },
              { header: 'Medicine', value: (r) => r.medicineName },
              { header: 'Category', value: (r) => r.category },
              { header: 'Bills', value: (r) => r.bills },
              { header: 'Units', value: (r) => r.units },
              { header: 'Revenue', value: (r) => r.revenue },
              { header: 'Cost', value: (r) => r.cost },
              { header: 'Profit', value: (r) => r.profit },
              { header: 'Margin %', value: (r) => r.marginPct.toFixed(2) },
            ]}
          />
        }
      >
        <FilterBar active={!!search || !!category} onReset={() => { setSearch(''); setCategory('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search medicine or code…" />
          <FilterSelect label="Category" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={[...rows].sort((a, b) => b.revenue - a.revenue)}
          rowKey={(r) => r.medicineId}
          pageSize={15}
          dense
          caption="Medicine-wise sales"
          footer={
            rows.length > 0 ? (
              <TotalsFooter
                columns={columns}
                values={{
                  units: formatNumber(rows.reduce((a, r) => a + r.units, 0)),
                  revenue: formatINR(revenue),
                  cost: formatINR(sumMoney(rows.map((r) => r.cost))),
                  profit: formatINR(profit),
                  margin: revenue > 0 ? formatPct((profit / revenue) * 100) : '—',
                }}
              />
            ) : undefined
          }
        />
      </ReportCard>
      <ReportCard title="Top 10 by revenue" description="Net of returns">
        <CardBody>
          <RankedBars color={SERIES[0]} items={all.slice(0, 10).map((r) => ({ key: r.medicineId, label: r.medicineName, value: r.revenue, sub: `${formatNumber(r.units)} units` }))} />
        </CardBody>
      </ReportCard>
    </div>
  )
}
