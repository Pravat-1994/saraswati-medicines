import { useState } from 'react'
import { ArrowRight, Check, FileText, Plus, Search, ShieldCheck, Stethoscope, Store, Truck, Video } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { shopService } from '../../services'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { useShopCart } from '../../stores/shopCartStore'
import type { ShopProduct } from '../../types/views'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'

function ProductCard({ p }: { p: ShopProduct }) {
  const add = useShopCart((s) => s.add)
  const inCart = useShopCart((s) => s.lines.find((l) => l.product.id === p.id)?.quantity ?? 0)
  const out = p.availability === 'OUT_OF_STOCK' || p.maxQty <= 0
  const atMax = inCart >= p.maxQty
  return (
    <article className="group flex flex-col rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-[11px] font-bold text-brand-700">{p.dosageForm.slice(0, 3).toUpperCase()}</div>
        <div className="flex flex-wrap justify-end gap-1">
          {p.prescriptionRequired && (
            <Badge tone="violet" icon={<FileText className="h-3 w-3" />}>
              Rx required
            </Badge>
          )}
          {p.availability === 'LIMITED' && <Badge tone="warning">Few left</Badge>}
          {out && <Badge tone="danger">Out of stock</Badge>}
        </div>
      </div>
      <h3 className="mt-3 font-display text-[15px] font-semibold text-ink-950">{p.name}</h3>
      <p className="text-xs text-ink-500">
        {p.genericName} · {p.strength}
      </p>
      <p className="mt-1 text-xs text-ink-400">
        {p.packSize} · {p.manufacturer}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <div className="num font-display text-lg font-bold text-ink-950">{formatINR(p.price)}</div>
          <div className="text-[11px] text-ink-400">MRP incl. GST</div>
        </div>
        <Button
          size="sm"
          variant={inCart ? 'subtle' : 'primary'}
          disabled={out || atMax}
          icon={inCart ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            add(p, 1)
            toast.success(`${p.name} added to cart`, { duration: 1400 })
          }}
          aria-label={`Add ${p.name} to cart`}
        >
          {out ? 'Unavailable' : inCart ? `In cart (${inCart})` : 'Add'}
        </Button>
      </div>
    </article>
  )
}

export default function ShopHomePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>()
  const debounced = useDebounced(search, 200)
  const info = useQuery(() => shopService.info(), [], { tags: ['settings'] })
  const products = useQuery(() => shopService.catalog({ search: debounced || undefined, category }), [debounced, category], { tags: ['inventory', 'medicines'] })

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl brand-gradient px-6 py-8 text-white shadow-raised sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -top-20 -right-10 h-64 w-64 rounded-full bg-accent-300/20 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">Order your medicines online</h1>
          <p className="mt-2 text-sm text-brand-100/85 sm:text-base">Genuine medicines from {info.data?.storeName ?? 'Saraswati Medicines Store'} — pick up at the counter or get them delivered home.</p>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by medicine, generic name or brand…"
              aria-label="Search medicines"
              className="h-13 w-full rounded-2xl border-0 bg-white pr-4 pl-12 text-[15px] text-ink-900 shadow-pop placeholder:text-ink-400 focus:ring-4 focus:ring-accent-300/50 focus:outline-none"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-brand-100/90">
            <span className="flex items-center gap-1.5"><Store className="h-4 w-4 text-accent-300" /> Store pickup</span>
            {info.data?.deliveryEnabled && <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-accent-300" /> Home delivery</span>}
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent-300" /> Pharmacist-verified prescriptions</span>
          </div>
        </div>
      </section>

      <Link
        to="/shop/doctors"
        className="group flex flex-col gap-4 rounded-3xl border border-violet-200/70 bg-gradient-to-r from-violet-50 via-white to-brand-50 p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised sm:flex-row sm:items-center sm:p-6"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
          <Stethoscope className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-ink-950">Consult a doctor online</span>
          <span className="mt-0.5 block text-[13px] text-ink-600">
            Book a video, audio or in-person consultation with our physicians and specialists. Prescriptions can be filled right here at the pharmacy.
          </span>
        </span>
        <span className="inline-flex items-center gap-2 self-start rounded-xl bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white transition group-hover:bg-ink-800 sm:self-center">
          <Video className="h-4 w-4" /> Book a consultation <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </Link>

      {info.data && !info.data.ordersEnabled && (
        <Alert tone="warning" title="Online ordering is paused">
          You can still browse, but checkout is unavailable right now. Please call {info.data.phone}.
        </Alert>
      )}

      <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Categories">
        {[undefined, ...(info.data?.categories ?? [])].map((c) => (
          <button
            key={c ?? 'all'}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition',
              category === c ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
            )}
          >
            {c ?? 'All medicines'}
          </button>
        ))}
      </div>

      {products.error ? (
        <ErrorState message={products.error} onRetry={products.refetch} />
      ) : !products.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : products.data.length === 0 ? (
        <EmptyState title="No medicines found" description="Try a different name, or call the store — we may be able to order it for you." />
      ) : (
        <>
          <p className="text-[13px] text-ink-500">{products.data.length} medicines</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.data.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
