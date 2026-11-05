import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn, sortBy as sortRows } from '../../lib/utils'
import type { SortDirection } from '../../types/api'
import { EmptyState, ErrorState, Skeleton } from './Feedback'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Enables sorting. For client mode, provide `sortValue`. */
  sortable?: boolean
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  /** Hide below a breakpoint for responsive tables. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  width?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: string
  onRetry?: () => void
  onRowClick?: (row: T) => void
  empty?: ReactNode
  /** Server mode: parent supplies paging/sorting state and the total. */
  server?: {
    total: number
    page: number
    pageSize: number
    sortBy?: string
    sortDir: SortDirection
    onPageChange: (p: number) => void
    onPageSizeChange?: (s: number) => void
    onSort: (key: string) => void
  }
  /** Client mode page size (0 = no paging). */
  pageSize?: number
  dense?: boolean
  className?: string
  rowClassName?: (row: T) => string | undefined
  footer?: ReactNode
  caption?: string
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, onRowClick, empty, server, pageSize = 10, dense, className, rowClassName, footer, caption }: DataTableProps<T>) {
  const [clientPage, setClientPage] = useState(1)
  const [clientSort, setClientSort] = useState<{ key?: string; dir: SortDirection }>({ dir: 'asc' })

  const sortKey = server ? server.sortBy : clientSort.key
  const sortDir = server ? server.sortDir : clientSort.dir

  const processed = useMemo(() => {
    if (!rows) return []
    if (server) return rows
    let out = rows
    const col = columns.find((c) => c.key === clientSort.key)
    if (col?.sortValue) out = sortRows(out, col.sortValue, clientSort.dir)
    return out
  }, [rows, server, columns, clientSort])

  const total = server ? server.total : processed.length
  const size = server ? server.pageSize : pageSize
  const page = server ? server.page : Math.min(clientPage, Math.max(1, Math.ceil(total / (size || 1))))
  const visible = server || !size ? processed : processed.slice((page - 1) * size, page * size)
  const pages = size ? Math.max(1, Math.ceil(total / size)) : 1

  const onSort = (key: string) => {
    if (server) return server.onSort(key)
    setClientSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setClientPage(1)
  }
  const goto = (p: number) => (server ? server.onPageChange(p) : setClientPage(p))

  if (error) return <ErrorState message={error} onRetry={onRetry} />

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3'
  const showSkeleton = loading && (!rows || rows.length === 0)

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable && (server || c.sortValue)
                const active = sortKey === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'sticky top-0 z-[1] border-b border-ink-200/80 bg-ink-50/90 font-semibold whitespace-nowrap text-ink-500 backdrop-blur',
                      dense ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-[11px]',
                      'tracking-wide uppercase',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.hideBelow && hide[c.hideBelow],
                      c.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        onClick={() => onSort(c.key)}
                        className={cn('inline-flex items-center gap-1 uppercase transition-colors hover:text-ink-800', active && 'text-ink-800', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        {active ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={cn(loading && rows && rows.length > 0 && 'opacity-60 transition-opacity')}>
            {showSkeleton &&
              Array.from({ length: Math.min(size || 6, 8) }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn(cellPad, 'border-b border-ink-100', c.hideBelow && hide[c.hideBelow])}>
                      <Skeleton className={cn('h-3.5', i % 2 ? 'w-3/4' : 'w-1/2')} />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton &&
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn('group transition-colors', onRowClick && 'cursor-pointer hover:bg-brand-50/40 focus-visible:bg-brand-50/60', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        cellPad,
                        'border-b border-ink-100 align-middle text-ink-800 group-last:border-b-0',
                        c.align === 'right' && 'num text-right',
                        c.align === 'center' && 'text-center',
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
          {footer}
        </table>
      </div>
      {!showSkeleton && visible.length === 0 && (empty ?? <EmptyState title="No records found" description="Try adjusting your search or filters." compact />)}
      {size > 0 && total > 0 && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          pageSize={size}
          onPage={goto}
          onPageSize={server?.onPageSizeChange}
        />
      )}
    </div>
  )
}

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize?: (s: number) => void }) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const nums = useMemo(() => {
    const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
    return [...set].sort((a, b) => a - b)
  }, [page, pages])
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-[13px] text-ink-500 sm:flex-row">
      <div className="flex items-center gap-3">
        <span>
          Showing <span className="num font-medium text-ink-800">{from}</span>–<span className="num font-medium text-ink-800">{to}</span> of{' '}
          <span className="num font-medium text-ink-800">{total}</span>
        </span>
        {onPageSize && (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-7 rounded-md border border-ink-200 bg-white px-1.5 text-xs text-ink-700 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          >
            {[10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-md p-1.5 hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-300">…</span>}
            <button
              onClick={() => onPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cn('num h-7 min-w-7 rounded-md px-2 text-xs font-medium', n === page ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100')}
            >
              {n}
            </button>
          </span>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="rounded-md p-1.5 hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}
