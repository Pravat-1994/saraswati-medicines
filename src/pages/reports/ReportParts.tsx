import type { ReactNode } from 'react'
import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import type { Column } from '../../components/ui/DataTable'
import { downloadCsv, printPage, type CsvColumn } from '../../lib/export'
import { cn } from '../../lib/utils'

/** Export CSV + Print buttons shown on every report table. */
export function ReportActions<T>({ filename, rows, columns }: { filename: string; rows: T[]; columns: CsvColumn<T>[] }) {
  return (
    <div className="no-print flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        icon={<Download className="h-3.5 w-3.5" />}
        disabled={rows.length === 0}
        onClick={() => {
          const ok = downloadCsv(filename, rows, columns)
          if (ok) toast.success(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to ${filename}.csv`)
          else toast.error('Downloads are blocked in this environment.')
        }}
      >
        Export CSV
      </Button>
      <Button variant="outline" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={printPage}>
        Print
      </Button>
    </div>
  )
}

/** A <tfoot> totals row aligned to DataTable columns. */
export function TotalsFooter<T>({ columns, values }: { columns: Column<T>[]; values: Record<string, ReactNode> }) {
  return (
    <tfoot>
      <tr>
        {columns.map((c, i) => (
          <td
            key={c.key}
            className={cn(
              'border-t-2 border-ink-200 bg-ink-50/70 px-4 py-3 text-[13px] font-semibold text-ink-900',
              c.align === 'right' && 'num text-right',
              c.align === 'center' && 'text-center',
            )}
          >
            {values[c.key] ?? (i === 0 ? 'Total' : '')}
          </td>
        ))}
      </tr>
    </tfoot>
  )
}

export function ReportCard({ title, description, actions, children, className }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('print-area', className)}>
      <CardHeader title={title} description={description} action={actions} />
      {children}
    </Card>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}
