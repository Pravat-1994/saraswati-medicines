import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, FileText, Paperclip, ShoppingBag, Store, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { shopService } from '../../services'
import { formatINR, sumMoney } from '../../lib/money'
import { cn } from '../../lib/utils'
import { PAYMENT_PREFERENCE_LABEL } from '../../lib/orders'
import { recentOrders, useShopCart } from '../../stores/shopCartStore'
import type { OnlineOrder } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert, EmptyState } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { QtyControl } from './CartDrawer'

const MAX_FILE = 5 * 1024 * 1024
const SLOTS = ['As soon as possible', 'Today, 10 am – 12 pm', 'Today, 4 – 6 pm', 'Today, 6 – 8 pm', 'Tomorrow, 10 am – 12 pm', 'Tomorrow, 6 – 8 pm']

const schema = z
  .object({
    customerName: z.string().trim().min(2, 'Enter your full name').max(80),
    customerPhone: z.string().trim().refine((v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid 10-digit Indian mobile number'),
    customerEmail: z.string().trim().regex(/^([^\s@]+@[^\s@]+\.[^\s@]{2,})?$/, 'Enter a valid email').optional(),
    fulfilment: z.enum(['PICKUP', 'DELIVERY']),
    deliveryAddress: z.string().trim().max(240).optional(),
    preferredSlot: z.string(),
    prescriptionRef: z.string().trim().max(60).optional(),
    doctorName: z.string().trim().max(80).optional(),
    prescriptionFile: z.custom<File | undefined>().optional(),
    customerNote: z.string().trim().max(300).optional(),
    paymentPreference: z.enum(['PAY_AT_STORE', 'CASH_ON_DELIVERY', 'UPI_ON_DELIVERY']),
    needsRx: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === 'DELIVERY' && (!v.deliveryAddress || v.deliveryAddress.length < 10)) ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Enter your complete address with PIN code' })
    if (v.needsRx && !v.prescriptionRef && !v.prescriptionFile) ctx.addIssue({ code: 'custom', path: ['prescriptionRef'], message: 'Add the prescription number or attach a photo of the prescription' })
    if (v.prescriptionFile && v.prescriptionFile.size > MAX_FILE) ctx.addIssue({ code: 'custom', path: ['prescriptionFile'], message: 'File must be 5 MB or smaller' })
    if (v.fulfilment === 'PICKUP' && v.paymentPreference !== 'PAY_AT_STORE') ctx.addIssue({ code: 'custom', path: ['paymentPreference'], message: 'Pickup orders are paid at the store' })
  })

type FormValues = z.infer<typeof schema>

export default function CheckoutPage() {
  const { lines, setQty, remove, clear } = useShopCart()
  const navigate = useNavigate()
  const info = useQuery(() => shopService.info(), [], { tags: ['settings'] })
  const needsRx = lines.some((l) => l.product.prescriptionRequired)
  const total = sumMoney(lines.map((l) => l.product.price * l.quantity))

  const { register, handleSubmit, control, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { customerName: '', customerPhone: '', customerEmail: '', fulfilment: 'PICKUP', deliveryAddress: '', preferredSlot: SLOTS[0], prescriptionRef: '', doctorName: '', customerNote: '', paymentPreference: 'PAY_AT_STORE', needsRx },
  })
  const errors = formState.errors
  const fulfilment = useWatch({ control, name: 'fulfilment' })
  const file = useWatch({ control, name: 'prescriptionFile' })
  // Keep the Rx requirement in sync if the cart changes on this page.
  useEffect(() => {
    setValue('needsRx', needsRx)
  }, [needsRx, setValue])

  const onSubmit = async (v: FormValues) => {
    try {
      const placed = await shopService.placeOrder({
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        customerEmail: v.customerEmail || undefined,
        fulfilment: v.fulfilment,
        deliveryAddress: v.fulfilment === 'DELIVERY' ? v.deliveryAddress : undefined,
        preferredSlot: v.preferredSlot,
        items: lines.map((l) => ({ medicineId: l.product.id, quantity: l.quantity })),
        prescriptionRef: v.prescriptionRef || undefined,
        doctorName: v.doctorName || undefined,
        // TODO: upload the file through Decisions FileReferenceService (apiclient.uploadFileThroughFileReferenceService) and send its id.
        prescriptionFileName: v.prescriptionFile?.name,
        customerNote: v.customerNote || undefined,
        paymentPreference: v.paymentPreference,
      })
      clear()
      recentOrders.add(placed.orderNumber)
      invalidate()
      navigate('/shop/track', { state: { tracking: placed, phone: v.customerPhone, justPlaced: true } })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
        <h1 className="sr-only">Checkout</h1>
        <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Your cart is empty" description="Add medicines to your cart before checking out." action={<Link to="/shop"><Button>Browse medicines</Button></Link>} />
      </div>
    )
  }

  const belowMin = !!info.data && info.data.minOrderValue > 0 && total < info.data.minOrderValue
  const payOptions: OnlineOrder['paymentPreference'][] = fulfilment === 'DELIVERY' ? ['CASH_ON_DELIVERY', 'UPI_ON_DELIVERY'] : ['PAY_AT_STORE']

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <Link to="/shop" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Continue shopping
      </Link>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-ink-950">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
            <h2 className="mb-4 font-display text-[15px] font-semibold text-ink-900">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={errors.customerName?.message}>
                {(id) => <Input id={id} autoComplete="name" invalid={!!errors.customerName} {...register('customerName')} />}
              </Field>
              <Field label="Mobile number" required error={errors.customerPhone?.message} hint="We’ll call or message you about this order">
                {(id) => <Input id={id} inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" invalid={!!errors.customerPhone} {...register('customerPhone')} />}
              </Field>
              <Field label="Email" error={errors.customerEmail?.message} hint="Optional" className="sm:col-span-2">
                {(id) => <Input id={id} type="email" autoComplete="email" invalid={!!errors.customerEmail} {...register('customerEmail')} />}
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
            <h2 className="mb-4 font-display text-[15px] font-semibold text-ink-900">How would you like to receive it?</h2>
            <Controller
              control={control}
              name="fulfilment"
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fulfilment">
                  {([
                    { key: 'PICKUP', label: 'Store pickup', desc: info.data?.address ?? 'Collect at the counter', icon: Store, disabled: false },
                    { key: 'DELIVERY', label: 'Home delivery', desc: info.data?.deliveryAreaNote ?? '', icon: Truck, disabled: info.data?.deliveryEnabled === false },
                  ] as const).map((o) => (
                    <button
                      type="button"
                      key={o.key}
                      role="radio"
                      aria-checked={field.value === o.key}
                      disabled={o.disabled}
                      onClick={() => {
                        field.onChange(o.key)
                        setValue('paymentPreference', o.key === 'DELIVERY' ? 'CASH_ON_DELIVERY' : 'PAY_AT_STORE')
                      }}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                        field.value === o.key ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15' : 'border-ink-200 hover:border-ink-300',
                      )}
                    >
                      <o.icon className={cn('mt-0.5 h-5 w-5 shrink-0', field.value === o.key ? 'text-brand-700' : 'text-ink-400')} />
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{o.label}{o.disabled ? ' (unavailable)' : ''}</span>
                        <span className="mt-0.5 block text-xs text-ink-500">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fulfilment === 'DELIVERY' && (
                <Field label="Delivery address" required error={errors.deliveryAddress?.message} className="sm:col-span-2">
                  {(id) => <Textarea id={id} rows={2} autoComplete="street-address" placeholder="House / flat, street, area, PIN code" invalid={!!errors.deliveryAddress} {...register('deliveryAddress')} />}
                </Field>
              )}
              <Field label={fulfilment === 'DELIVERY' ? 'Preferred delivery time' : 'Preferred pickup time'}>
                {(id) => <Select id={id} options={SLOTS.map((s) => ({ value: s, label: s }))} {...register('preferredSlot')} />}
              </Field>
              <Field label="Payment" error={errors.paymentPreference?.message}>
                {(id) => <Select id={id} options={payOptions.map((p) => ({ value: p, label: PAYMENT_PREFERENCE_LABEL[p] }))} {...register('paymentPreference')} />}
              </Field>
            </div>
          </section>

          {needsRx && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-card">
              <h2 className="mb-1 flex items-center gap-2 font-display text-[15px] font-semibold text-ink-900">
                <FileText className="h-4 w-4 text-violet-600" /> Prescription
              </h2>
              <p className="mb-4 text-[13px] text-ink-600">Some items need a valid prescription. A pharmacist verifies it before your order is confirmed. Please keep the original handy at pickup or delivery.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prescription / OPD number" error={errors.prescriptionRef?.message}>
                  {(id) => <Input id={id} invalid={!!errors.prescriptionRef} {...register('prescriptionRef')} />}
                </Field>
                <Field label="Doctor’s name">{(id) => <Input id={id} {...register('doctorName')} />}</Field>
                <Field label="Attach prescription (photo or PDF)" error={errors.prescriptionFile?.message as string | undefined} className="sm:col-span-2">
                  {(id) => (
                    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-violet-300 bg-white px-4 py-3 text-[13px] text-ink-600 hover:border-violet-400">
                      <Paperclip className="h-4 w-4 text-violet-600" />
                      <span className="flex-1 truncate">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : 'Choose a file (max 5 MB)'}</span>
                      <input id={id} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setValue('prescriptionFile', e.target.files?.[0], { shouldValidate: true })} />
                    </label>
                  )}
                </Field>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-card">
            <Field label="Note for the pharmacist" hint="Optional — e.g. preferred brand, allergies, landmark">
              {(id) => <Textarea id={id} rows={2} {...register('customerNote')} />}
            </Field>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
            <h2 className="border-b border-ink-100 px-5 py-4 font-display text-[15px] font-semibold text-ink-900">Order summary</h2>
            <ul className="divide-y divide-ink-100 px-5">
              {lines.map((l) => (
                <li key={l.product.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                        {l.product.name}
                        {l.product.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
                      </div>
                      <div className="text-xs text-ink-500">{l.product.packSize}</div>
                    </div>
                    <span className="num text-sm font-semibold">{formatINR(l.product.price * l.quantity)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <QtyControl value={l.quantity} max={l.product.maxQty} onChange={(v) => setQty(l.product.id, v)} label={l.product.name} />
                    <button type="button" onClick={() => remove(l.product.id)} className="text-xs font-medium text-ink-400 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-ink-100 px-5 py-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-ink-600">Estimated total</span>
                <span className="num font-display text-2xl font-bold text-ink-950">{formatINR(total)}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-400">MRP inclusive of GST. No delivery charge. Final amount appears on your invoice; it may differ slightly if a different batch price applies.</p>
              {belowMin && <Alert tone="warning">Minimum order value is {formatINR(info.data!.minOrderValue)}.</Alert>}
              {info.data && !info.data.ordersEnabled && <Alert tone="warning">Online ordering is paused right now.</Alert>}
              <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting} disabled={belowMin || info.data?.ordersEnabled === false}>
                Place order
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </form>
  )
}
