import { useEffect, useMemo, useState } from 'react'
import type { ListQuery, SortDirection } from '../types/api'

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export interface TableState<F> {
  page: number
  pageSize: number
  sortBy?: string
  sortDir: SortDirection
  search: string
  filters: F
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  setSearch: (s: string) => void
  setFilters: (f: F | ((prev: F) => F)) => void
  toggleSort: (key: string) => void
  reset: () => void
  /** Debounced query ready to send to a service. */
  query: ListQuery<F>
}

/** Server-style table state (search, filters, sort, paging) for service list calls. */
export function useTableState<F extends object>(initialFilters: F, opts: { pageSize?: number; sortBy?: string; sortDir?: SortDirection } = {}): TableState<F> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(opts.pageSize ?? 15)
  const [sortBy, setSortBy] = useState<string | undefined>(opts.sortBy)
  const [sortDir, setSortDir] = useState<SortDirection>(opts.sortDir ?? 'asc')
  const [search, setSearchRaw] = useState('')
  const [filters, setFiltersRaw] = useState<F>(initialFilters)
  const debouncedSearch = useDebounced(search)

  const query = useMemo<ListQuery<F>>(
    () => ({ page, pageSize, sortBy, sortDir, search: debouncedSearch || undefined, filters }),
    [page, pageSize, sortBy, sortDir, debouncedSearch, filters],
  )

  return {
    page,
    pageSize,
    sortBy,
    sortDir,
    search,
    filters,
    setPage,
    setPageSize: (s) => {
      setPageSize(s)
      setPage(1)
    },
    setSearch: (s) => {
      setSearchRaw(s)
      setPage(1)
    },
    setFilters: (f) => {
      setFiltersRaw(f)
      setPage(1)
    },
    toggleSort: (key) => {
      if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortBy(key)
        setSortDir('asc')
      }
    },
    reset: () => {
      setFiltersRaw(initialFilters)
      setSearchRaw('')
      setPage(1)
    },
    query,
  }
}
