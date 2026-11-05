import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { ArrowLeft, CalendarCheck, Clock, Eye, MapPin, PackageSearch, Phone, Pill, ShieldCheck, ShoppingBag, Stethoscope, Truck } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { shopService } from '../../services'
import { useShopCart } from '../../stores/shopCartStore'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import { cn } from '../../lib/utils'
import { BrandMark } from '../../components/layout/BrandLogo'
import { PageLoader } from '../../components/ui/Feedback'
import { CartDrawer } from './CartDrawer'

/** Customer-facing layout (no staff navigation). */
export default function ShopLayout() {
  const info = useQuery(() => shopService.info(), [], { tags: ['settings'] })
  const count = useShopCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0))
  const setOpen = useShopCart((s) => s.setOpen)
  const can = useCan()
  const i = info.data
  const preview = useUiStore((s) => s.customerPreview)
  const staffName = useSessionStore((s) => s.user?.name)
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8f6]">
      {preview && (
        <div className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink-900 px-4 py-2 text-[12.5px] text-white">
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-accent-300" /> Previewing as a customer — this is exactly what customers see. Signed in as {staffName}.
          </span>
          <button
            onClick={() => {
              useUiStore.getState().setCustomerPreview(false)
              navigate('/')
            }}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 font-semibold ring-1 ring-white/20 hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to staff app
          </button>
        </div>
      )}
      <div className="bg-brand-900 px-4 py-1.5 text-center text-[12px] text-brand-100">
        <span className="inline-flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-accent-300" />
          {i?.deliveryEnabled ? i.deliveryAreaNote : 'Order online and pick up at the store.'}
        </span>
      </div>
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/shop" className="flex shrink-0 items-center gap-2.5">
            <BrandMark />
            <div className="leading-none">
              <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-950">
                Saraswati<span className="text-brand-600">.</span>
              </div>
              <div className="mt-1 hidden text-[10px] font-semibold tracking-[0.18em] text-ink-400 uppercase sm:block">Pharmacy & Clinic</div>
            </div>
          </Link>
          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1.5" aria-label="Storefront">
            {[
              { to: '/shop', label: 'Medicines', icon: Pill, end: true },
              { to: '/shop/doctors', label: 'Consult a doctor', icon: Stethoscope, end: false },
              { to: '/shop/appointments', label: 'My appointments', icon: CalendarCheck, end: false },
            ].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                title={l.label}
                aria-label={l.label}
                className={({ isActive }) => cn('flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition sm:px-3', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100')}
              >
                <l.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{l.label}</span>
              </NavLink>
            ))}
            <NavLink
              to="/shop/track"
              title="Track order"
              aria-label="Track order"
              className={({ isActive }) => cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100')}
            >
              <PackageSearch className="h-4 w-4" />
              <span className="hidden lg:inline">Track order</span>
            </NavLink>
            <button onClick={() => setOpen(true)} className="relative flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && <span className="num rounded-full bg-accent-400 px-1.5 text-[11px] font-bold text-ink-950">{count}</span>}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-ink-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-[13px] text-ink-600 sm:grid-cols-3 sm:px-6">
          <div>
            <div className="font-display font-semibold text-ink-900">{i?.storeName ?? 'Saraswati Medicines Store'}</div>
            <p className="mt-1">{i?.tagline}</p>
            <p className="mt-3 flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {i?.address}
            </p>
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-600" /> {i?.phone}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-600" /> Open daily, 8:00 am – 10:00 pm
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Prescriptions checked by a registered pharmacist
            </p>
          </div>
          <div className="text-xs leading-relaxed text-ink-500">
            Prices shown are MRP inclusive of GST. The final amount appears on your invoice when the order is handed over. Prescription medicines are dispensed only against a valid prescription.
            {can('orders.view') && !preview && (
              <Link to="/orders" className="mt-3 block font-semibold text-brand-700 hover:underline">
                Staff: open the online orders queue →
              </Link>
            )}
          </div>
        </div>
      </footer>
      <CartDrawer info={i} />
    </div>
  )
}
