import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { HandCoins, ReceiptIndianRupee, Wallet, WalletCards } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { patientBillingService } from '../../services'
import { formatDate, todayISO } from '../../lib/dates'
import { formatINR, sumMoney } from '../../lib/money'
import type { AccountFilters, AccountView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from './labels'
import { EmptyState } from '../../components/ui/Feedback'

type Tab = NonNullable<AccountFilters['status']>

export default function PatientBillingPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'DUE'
  const [type, setType] = useState<'' | 'IPD' | 'OPD'>('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const all = useQuery(() => patientBillingService.list({}), [], { tags: ['customers', 'sales'] })
  const list = useQuery(() => patientBillingService.list({ status: tab, type: type || 'ALL', search: debounced || undefined }), [tab, type, debounced], { tags: ['customers', 'sales'] })

  const a = all.data ?? []
  const today = todayISO()
  const kpi = {
    open: a.filter((x) => x.status !== 'SETTLED').length,
    outstanding: sumMoney(a.map((x) => Math.max(0, x.totals.balance))),
    collected: sumMoney(a.flatMap((x) => x.payments.filter((p) => p.date.slice(0, 10) === today).map((p) => (p.kind === 'REFUND' ? -p.amount : p.amount)))),
    advances: sumMoney(a.filter((x) => x.status === 'OPEN').flatMap((x) => x.payments.filter((p) => p.kind === 'ADVANCE').map((p) => p.amount))),
  }

  const columns: Column<AccountView>[] = [
    {
      key: 'acc',
      header: 'Account',
      cell: (x) => (
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink-900">{x.accountNo}</div>
          <div className="text-xs text-ink-500">{x.billNo ? `Bill ${x.billNo}` : `Opened ${formatDate(x.openedAt)}`}</div>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      cell: (x) => (
        <div>
          <div className="text-ink-900">{x.patientName}</div>
          <div className="text-xs text-ink-500">{x.patientCode}</div>
        </div>
      ),
    },
    {
      key: 'ref',
      header: 'Reference',
      hideBelow: 'md',
      cell: (x) => (
        <div className="flex items-center gap-2">
          <Badge tone={x.admissionId ? 'violet' : 'neutral'}>{x.admissionId ? 'IPD' : 'OPD'}</Badge>
          <span className="font-mono text-xs text-ink-600">{x.admissionNo ?? x.appointmentNo ?? '—'}</span>
        </div>
      ),
    },
    { key: 'net', header: 'Net', align: 'right', hideBelow: 'sm', cell: (x) => formatINR(x.totals.net) },
    { key: 'paid', header: 'Paid', align: 'right', hideBelow: 'lg', cell: (x) => formatINR(x.totals.paid - x.totals.refunded) },
    {
      key: 'bal',
      header: 'Balance',
      align: 'right',
      cell: (x) => (
        <div>
          <div className={x.totals.balance > 0.005 ? 'font-semibold text-amber-700' : x.totals.balance < -0.005 ? 'font-semibold text-sky-700' : 'text-ink-500'}>{formatINR(x.totals.balance)}</div>
          {x.accruedRoom && <div className="text-[11px] text-ink-400">+ {formatINR(x.accruedRoom.amount)} room accrued</div>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (x) => <Badge tone={ACCOUNT_STATUS_TONE[x.status]}>{ACCOUNT_STATUS_LABEL[x.status]}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Patient billing"
        description="Consultation and inpatient accounts — charges, advances, payments and final bills. Pharmacy sales stay as separate invoices and can be linked to an inpatient account."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Patient billing' }]}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Unsettled accounts" value={all.data ? kpi.open : '…'} tone="amber" icon={<ReceiptIndianRupee className="h-4 w-4" />} />
        <StatCard label="Outstanding balance" value={all.data ? formatINR(kpi.outstanding) : '…'} tone="red" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Collected today" value={all.data ? formatINR(kpi.collected) : '…'} icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Advances held (open)" value={all.data ? formatINR(kpi.advances) : '…'} tone="blue" icon={<WalletCards className="h-4 w-4" />} />
      </div>
      <Card>
        <Tabs
          className="px-4 pt-1"
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
          items={[
            { key: 'DUE', label: 'Balance due' },
            { key: 'OPEN', label: 'Open' },
            { key: 'FINALISED', label: 'Final bill issued' },
            { key: 'SETTLED', label: 'Settled' },
            { key: 'ALL', label: 'All' },
          ]}
        />
        <FilterBar active={!!(search || type)} onReset={() => (setSearch(''), setType(''))}>
          <SearchInput value={search} onChange={setSearch} placeholder="Account, bill, patient or admission no." />
          <FilterSelect label="Type" value={type} onChange={(v) => setType(v as '' | 'IPD' | 'OPD')} options={[{ value: 'IPD', label: 'Inpatient (IPD)' }, { value: 'OPD', label: 'Outpatient (OPD)' }]} />
        </FilterBar>
        <DataTable
          caption="Patient accounts"
          columns={columns}
          rows={list.data}
          rowKey={(x) => x.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(x) => navigate(`/billing/${x.id}`)}
          pageSize={15}
          empty={<EmptyState icon={<ReceiptIndianRupee className="h-5 w-5" />} title="No accounts here" description="Accounts open automatically on admission and when a consultation is completed." />}
        />
      </Card>
    </div>
  )
}
