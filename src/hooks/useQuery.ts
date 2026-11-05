/**
 * Minimal async data hooks with tag-based invalidation. Services return
 * Promises; screens never read mock data directly. Swap for TanStack Query
 * later if desired — the call sites stay the same shape.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { ServiceError } from '../types/api'

export type QueryTag =
  | 'medicines'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'dashboard'
  | 'reports'
  | 'users'
  | 'settings'

let version = 0
const tagVersions = new Map<QueryTag, number>()
const subscribers = new Set<() => void>()

/** Invalidate queries by tag; no tags = invalidate everything. */
export function invalidate(...tags: QueryTag[]): void {
  version++
  const all: QueryTag[] = ['medicines', 'inventory', 'sales', 'purchases', 'suppliers', 'customers', 'dashboard', 'reports', 'users', 'settings']
  for (const t of tags.length ? tags : all) tagVersions.set(t, version)
  subscribers.forEach((s) => s())
}

function subscribe(cb: () => void) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function useTagVersion(tags: QueryTag[]): number {
  const key = tags.join('|')
  const getSnapshot = useCallback(() => key.split('|').reduce((acc, t) => Math.max(acc, tagVersions.get(t as QueryTag) ?? 0), 0), [key])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function errorMessage(err: unknown): string {
  if (err instanceof ServiceError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

export interface QueryState<T> {
  data: T | undefined
  error: string | undefined
  /** True only while there is no data yet. */
  loading: boolean
  /** True for any in-flight request, including background refreshes. */
  fetching: boolean
  refetch: () => void
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[], options: { tags?: QueryTag[]; enabled?: boolean } = {}): QueryState<T> {
  const { tags = [], enabled = true } = options
  const [nonce, setNonce] = useState(0)
  const tagVersion = useTagVersion(tags)
  // Deps are primitives or plain query objects, so a JSON key identifies a request.
  const key = JSON.stringify([deps, tagVersion, nonce])
  const [res, setRes] = useState<{ key?: string; data?: T; error?: string }>({})
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setRes({ key, data })
      },
      (err: unknown) => {
        if (!cancelled) setRes((r) => ({ key, data: r.data, error: errorMessage(err) }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, enabled])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  const fetching = enabled && res.key !== key
  return { data: res.data, error: fetching ? undefined : res.error, loading: fetching && res.data === undefined, fetching, refetch }
}

export interface MutationOptions<TResult> {
  /** Tags to invalidate on success. Default: everything (mutations ripple across modules). */
  invalidates?: QueryTag[]
  successMessage?: string | ((result: TResult) => string)
  /** Show errors as toasts (default true). */
  toastErrors?: boolean
  onSuccess?: (result: TResult) => void
}

export function useMutation<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>, options: MutationOptions<TResult> = {}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const optsRef = useRef(options)
  const fnRef = useRef(fn)
  useEffect(() => {
    optsRef.current = options
    fnRef.current = fn
  })

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setPending(true)
    setError(undefined)
    try {
      const result = await fnRef.current(...args)
      const o = optsRef.current
      invalidate(...(o.invalidates ?? []))
      if (o.successMessage) toast.success(typeof o.successMessage === 'function' ? o.successMessage(result) : o.successMessage)
      o.onSuccess?.(result)
      return result
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      if (optsRef.current.toastErrors !== false) toast.error(msg)
      return undefined
    } finally {
      setPending(false)
    }
  }, [])

  return { run, pending, error, clearError: () => setError(undefined) }
}
