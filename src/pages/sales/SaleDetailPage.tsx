import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Printer, ShieldAlert, Undo2 } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { salesService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { printPage } from '../../lib/export'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ApprovalBadge, Badge, SaleStatusBadge } from '../../components/ui/Badge'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { InvoiceDocument } from './InvoiceDocument'
import { ReturnModal } from './ReturnModal'

export default function SaleDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const can = useCan()
  const settings = useSettings()
  const [returning, setReturning] = useState(false)
  const q = useQuery(() => salesService.get(id!), [id], { tags: ['sales'] })
  const autoPrint = params.get('print') === '1'

  useEffect(() => {
    if (!autoPrint || !q.data) return
    const t = setTimeout(() => {
      printPage()
      setParams({}, { replace: true })
    }, 400)
    return () => clearTimeout(t)
  }, [autoPrint, q.data, setParams])

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { sale, returns } = q.data
  const fullyReturned = sale.items.every((i) => i.returnedQuantity >= i.quantity)
  const overrides = sale.items.filter((i) => i.fefoOverridden)

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={sale.invoiceNumber}
          badge={<SaleStatusBadge status={sale.status} />}
          description={`${formatDateTime(sale.date)} · ${sale.customerName} · billed by ${sale.cashierName}`}
          breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: sale.invoiceNumber }]}
          actions={
            <>
              {can('returns.request') && !fullyReturned && (
                <Button variant="outline" icon={<Undo2 className="h-4 w-4" />} onClick={() => setReturning(true)}>
                  Return items
                </Button>
              )}
              <Button icon={<Printer className="h-4 w-4" />} onClick={printPage}>
                Print invoice
              </Button>
            </>
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="print-area p-5 sm:p-8">
          <InvoiceDocument sale={sale} settings={settings} />
        </Card>
        <div className="no-print space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-500">Customer</span>
                {sale.customerId ? (
                  <Link to={`/customers/${sale.customerId}`} className="font-medium text-brand-700 hover:underline">
                    {sale.customerName}
                  </Link>
                ) : (
                  <span className="font-medium">{sale.customerName}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Gross profit</span>
                <span className="num font-medium">{formatINR(sale.grandTotal - sale.costTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Refunded</span>
                <span className="num font-medium">{formatINR(returns.filter((r) => r.status === 'APPROVED').reduce((a, r) => a + r.totalRefund, 0))}</span>
              </div>
            </CardBody>
          </Card>
          {overrides.length > 0 && (
            <Card>
              <CardHeader title="FEFO overrides" icon={<ShieldAlert className="h-4 w-4" />} description="Batches chosen manually instead of earliest expiry." />
              <CardBody>
                <ul className="space-y-1 text-[13px]">
                  {overrides.map((i) => (
                    <li key={i.lineId}>
                      {i.medicineName} · <span className="font-mono">{i.batchNumber}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Returns" description={returns.length ? `${returns.length} return(s) against this invoice` : 'No returns'} />
            {returns.length > 0 && (
              <ul className="divide-y divide-ink-100 px-5 pb-4">
                {returns.map((r) => (
                  <li key={r.id} className="py-3 text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{r.returnNumber}</span>
                      <ApprovalBadge status={r.status} />
                    </div>
                    <div className="mt-1 text-ink-600">{r.items.map((i) => `${i.quantity} × ${i.medicineName}`).join(', ')}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
                      <span>{r.reason}</span>
                      <span className="num font-semibold text-ink-900">{formatINR(r.totalRefund)}</span>
                    </div>
                    {r.items.some((i) => !i.restock) && <Badge className="mt-1.5">Not restocked</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <ReturnModal sale={sale} open={returning} onClose={() => setReturning(false)} />
    </div>
  )
}
