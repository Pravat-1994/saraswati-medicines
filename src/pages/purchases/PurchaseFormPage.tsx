import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, PackageSearch, Plus, Save, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { addDays, todayISO, toISODate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { pricePurchaseOrder } from '../../lib/purchases'
import { medicineService, purchaseService, supplierService } from '../../services'
import { useSettings } from '../../stores/settingsStore'
import type { PurchaseOrder } from '../../types/domain'
import type { MedicineDetail } from '../../types/views'
import { MedicinePicker } from '../inventory/MedicinePicker'

const itemSchema = z.object({
  medicineId: z.string().min(1),
  medicineName: z.string(),
  medicineCode: z.string(),
  orderedQty: z.number({ message: 'Required' }).int('Whole units').positive('> 0'),
  freeQty: z.number({ message: 'Required' }).int('Whole units').min(0, '≥ 0'),
  purchasePrice: z.number({ message: 'Required' }).positive('> 0'),
  discountPct: z.number({ message: 'Required' }).min(0, '≥ 0').max(100, '≤ 100'),
  gstRate: z.number(),
})

const schema = z
  .object({
    supplierId: z.string().min(1, 'Select a supplier'),
    orderDate: z.string().min(1, 'Required'),
    expectedDate: z.string().optional(),
    items: z.array(itemSchema).min(1, 'Add at least one medicine'),
    charges: z.array(z.object({ label: z.string().trim().min(1, 'Label required'), amount: z.number({ message: 'Required' }).min(0, '≥ 0') })),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => !v.expectedDate || v.expectedDate >= v.orderDate, { path: ['expectedDate'], message: 'Must be on or after the order date' })

type FormValues = z.infer<typeof schema>

function Summary({ control }: { control: Control<FormValues> }) {
  const items = useWatch({ control, name: 'items' })
  const charges = useWatch({ control, name: 'charges' })
  const priced = useMemo(
    () =>
      pricePurchaseOrder(
        (items ?? []).map((i) => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName,
          orderedQty: Number(i.orderedQty) || 0,
          freeQty: Number(i.freeQty) || 0,
          purchasePrice: Number(i.purchasePrice) || 0,
          discountPct: Number(i.discountPct) || 0,
          gstRate: Number(i.gstRate) || 0,
        })),
        (charges ?? []).map((c) => ({ label: c.label, amount: Number(c.amount) || 0 })),
      ),
    [items, charges],
  )
  const units = (items ?? []).reduce((a, i) => a + (Number(i.orderedQty) || 0) + (Number(i.freeQty) || 0), 0)
  const rows: [string, number, string?][] = [
    ['Subtotal', priced.subtotal],
    ['Trade discount', -priced.discountTotal, 'text-emerald-700'],
    ['Taxable value', priced.subtotal - priced.discountTotal],
    ['GST (input)', priced.gstTotal],
    ['Other charges', priced.chargesTotal],
  ]
  return (
    <Card className="overflow-hidden">
      <div className="brand-gradient px-5 py-4 text-white">
        <div className="text-xs font-medium tracking-wide text-brand-100/80 uppercase">Order total</div>
        <div className="num mt-1 font-display text-3xl font-bold">{formatINR(priced.grandTotal)}</div>
        <div className="mt-1 text-xs text-brand-100/70">
          {(items ?? []).length} line{(items ?? []).length === 1 ? '' : 's'} · {units} units incl. free
        </div>
      </div>
      <dl className="space-y-2.5 px-5 py-4 text-[13px]">
        {rows.map(([label, value, cls]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-ink-500">{label}</dt>
            <dd className={`num font-medium text-ink-900 ${cls ?? ''}`}>{formatINR(value)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-dashed border-ink-200 pt-2.5 text-sm">
          <dt className="font-semibold text-ink-900">Grand total</dt>
          <dd className="num font-bold text-ink-950">{formatINR(priced.grandTotal)}</dd>
        </div>
      </dl>
      <p className="border-t border-ink-100 bg-ink-50/60 px-5 py-3 text-[11.5px] leading-relaxed text-ink-500">
        Supplier prices are GST-exclusive. Totals use the same calculation as the server; final amounts are confirmed by Decisions on save.
      </p>
    </Card>
  )
}

function PurchaseForm({ existing, prefill }: { existing?: PurchaseOrder; prefill?: { medicine?: MedicineDetail; supplierId?: string } }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const suppliers = useQuery(() => supplierService.list({ pageSize: 200, filters: { status: 'ACTIVE' } }), [], { tags: ['suppliers'] })
  const today = todayISO()
  const prefillMed = prefill?.medicine?.medicine
  const defaults: FormValues = existing
    ? {
        supplierId: existing.supplierId,
        orderDate: existing.orderDate,
        expectedDate: existing.expectedDate ?? '',
        items: existing.items.map((i) => ({ medicineId: i.medicineId, medicineName: i.medicineName, medicineCode: '', orderedQty: i.orderedQty, freeQty: i.freeQty, purchasePrice: i.purchasePrice, discountPct: i.discountPct, gstRate: i.gstRate })),
        charges: existing.charges,
        notes: existing.notes ?? '',
      }
    : {
        supplierId: prefill?.supplierId ?? prefillMed?.primarySupplierId ?? '',
        orderDate: today,
        expectedDate: toISODate(addDays(new Date(), 4)),
        items: prefillMed
          ? [{ medicineId: prefillMed.id, medicineName: prefillMed.name, medicineCode: prefillMed.code, orderedQty: Math.max(prefillMed.reorderQuantity, 1), freeQty: 0, purchasePrice: prefillMed.purchasePrice, discountPct: 0, gstRate: prefillMed.gstRate }]
          : [],
        charges: [],
        notes: '',
      }
  const { register, control, handleSubmit, formState, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const items = useFieldArray({ control, name: 'items' })
  const charges = useFieldArray({ control, name: 'charges' })
  const watchedItems = useWatch({ control, name: 'items' })
  const [mode, setMode] = useState<'DRAFT' | 'ORDERED'>('ORDERED')
  const synced = useRef(false)
  const initialSupplier = defaults.supplierId
  // A native select can't show a value before its options exist; re-apply the default once suppliers load.
  useEffect(() => {
    if (synced.current || !initialSupplier || !suppliers.data) return
    synced.current = true
    setValue('supplierId', initialSupplier)
  }, [initialSupplier, suppliers.data, setValue])

  const save = useMutation(
    (v: FormValues, status: 'DRAFT' | 'ORDERED') => {
      const input = {
        supplierId: v.supplierId,
        orderDate: v.orderDate,
        expectedDate: v.expectedDate || undefined,
        items: v.items.map((i) => ({ medicineId: i.medicineId, orderedQty: i.orderedQty, freeQty: i.freeQty, purchasePrice: i.purchasePrice, discountPct: i.discountPct, gstRate: i.gstRate })),
        charges: v.charges,
        notes: v.notes || undefined,
        status,
      }
      return existing ? purchaseService.update(existing.id, input) : purchaseService.create(input)
    },
    {
      successMessage: (po) => (po.status === 'DRAFT' ? `Draft ${po.poNumber} saved.` : `Purchase order ${po.poNumber} placed with ${po.supplierName}.`),
      onSuccess: (po) => navigate(`/purchases/${po.id}`),
    },
  )

  const submit = (s: 'DRAFT' | 'ORDERED') => {
    setMode(s)
    void handleSubmit((v) => save.run(v, s))()
  }
  const e = formState.errors
  const gstOptions = settings.gstRates.map((r) => ({ value: String(r), label: `${r}%` }))

  return (
    <form onSubmit={(ev) => ev.preventDefault()} noValidate>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Order details" description="Supplier and delivery schedule" />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label="Supplier" required error={e.supplierId?.message} className="sm:col-span-3 lg:col-span-1">
                {(id) => (
                  <Select
                    id={id}
                    invalid={!!e.supplierId}
                    placeholder={suppliers.loading ? 'Loading…' : 'Select supplier'}
                    options={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.address.city}` }))}
                    {...register('supplierId')}
                  />
                )}
              </Field>
              <Field label="Order date" required error={e.orderDate?.message}>
                {(id) => <Input id={id} type="date" invalid={!!e.orderDate} {...register('orderDate')} />}
              </Field>
              <Field label="Expected delivery" error={e.expectedDate?.message}>
                {(id) => <Input id={id} type="date" invalid={!!e.expectedDate} {...register('expectedDate')} />}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Medicines" description="Prices default to the catalogue purchase price and GST rate — adjust to match the supplier quote." />
            <CardBody className="space-y-4">
              <MedicinePicker
                clearOnSelect
                excludeIds={(watchedItems ?? []).map((i) => i.medicineId)}
                placeholder="Add medicine — search by name, generic, code or barcode…"
                onSelect={(m) =>
                  items.append({ medicineId: m.id, medicineName: m.name, medicineCode: m.code, orderedQty: Math.max(m.reorderQuantity, 1), freeQty: 0, purchasePrice: m.purchasePrice, discountPct: 0, gstRate: m.gstRate })
                }
              />
              {e.items?.message && <p className="text-xs font-medium text-red-600">{e.items.message}</p>}
              {items.fields.length === 0 ? (
                <EmptyState compact icon={<PackageSearch className="h-5 w-5" />} title="No medicines added" description="Search above to add medicines to this purchase order." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-ink-200/80">
                  <div className="hidden grid-cols-[minmax(0,2fr)_80px_70px_110px_80px_90px_110px_36px] gap-2 bg-ink-50 px-3 py-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase lg:grid">
                    <span>Medicine</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Free</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Disc %</span>
                    <span>GST</span>
                    <span className="text-right">Line total</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {items.fields.map((f, idx) => {
                      const w = watchedItems?.[idx]
                      const line = w ? pricePurchaseOrder([{ ...w, orderedQty: Number(w.orderedQty) || 0, purchasePrice: Number(w.purchasePrice) || 0, discountPct: Number(w.discountPct) || 0, gstRate: Number(w.gstRate) || 0, freeQty: 0 }], []).grandTotal : 0
                      const ie = e.items?.[idx]
                      return (
                        <li key={f.id} className="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4 lg:grid-cols-[minmax(0,2fr)_80px_70px_110px_80px_90px_110px_36px] lg:items-center">
                          <div className="col-span-2 min-w-0 sm:col-span-4 lg:col-span-1">
                            <div className="truncate text-[13px] font-medium text-ink-900">{f.medicineName}</div>
                            {f.medicineCode && <div className="text-[11px] text-ink-500">{f.medicineCode}</div>}
                          </div>
                          <label className="flex flex-col gap-1 lg:block">
                            <span className="text-[11px] text-ink-500 lg:hidden">Qty</span>
                            <Input inputSize="sm" type="number" min={1} className="text-right" aria-label="Quantity" invalid={!!ie?.orderedQty} {...register(`items.${idx}.orderedQty`, { valueAsNumber: true })} />
                          </label>
                          <label className="flex flex-col gap-1 lg:block">
                            <span className="text-[11px] text-ink-500 lg:hidden">Free</span>
                            <Input inputSize="sm" type="number" min={0} className="text-right" aria-label="Free quantity" invalid={!!ie?.freeQty} {...register(`items.${idx}.freeQty`, { valueAsNumber: true })} />
                          </label>
                          <label className="flex flex-col gap-1 lg:block">
                            <span className="text-[11px] text-ink-500 lg:hidden">Price (₹)</span>
                            <Input inputSize="sm" type="number" step="0.01" className="text-right" aria-label="Purchase price" invalid={!!ie?.purchasePrice} {...register(`items.${idx}.purchasePrice`, { valueAsNumber: true })} />
                          </label>
                          <label className="flex flex-col gap-1 lg:block">
                            <span className="text-[11px] text-ink-500 lg:hidden">Disc %</span>
                            <Input inputSize="sm" type="number" step="0.5" min={0} max={100} className="text-right" aria-label="Discount percent" invalid={!!ie?.discountPct} {...register(`items.${idx}.discountPct`, { valueAsNumber: true })} />
                          </label>
                          <label className="flex flex-col gap-1 lg:block">
                            <span className="text-[11px] text-ink-500 lg:hidden">GST</span>
                            <Select selectSize="sm" aria-label="GST rate" options={gstOptions} {...register(`items.${idx}.gstRate`, { valueAsNumber: true })} />
                          </label>
                          <div className="num self-end pb-1.5 text-right text-[13px] font-semibold text-ink-900 lg:self-auto lg:pb-0">{formatINR(line)}</div>
                          <div className="flex justify-end self-end lg:self-auto">
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.medicineName}`} onClick={() => items.remove(idx)}>
                              <Trash2 className="h-4 w-4 text-ink-400" />
                            </Button>
                          </div>
                          {ie && <p className="col-span-full text-xs text-red-600">Check the highlighted values for this line.</p>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Other charges"
              description="Freight, handling, cold-chain packaging etc."
              action={
                <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => charges.append({ label: '', amount: 0 })}>
                  Add charge
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {charges.fields.length === 0 && <p className="text-[13px] text-ink-400">No additional charges.</p>}
              {charges.fields.map((f, idx) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Field className="flex-1" error={e.charges?.[idx]?.label?.message}>
                    {(id) => <Input id={id} placeholder="e.g. Freight & handling" aria-label="Charge label" invalid={!!e.charges?.[idx]?.label} {...register(`charges.${idx}.label`)} />}
                  </Field>
                  <Field className="w-36" error={e.charges?.[idx]?.amount?.message}>
                    {(id) => <Input id={id} type="number" step="0.01" leading="₹" aria-label="Charge amount" {...register(`charges.${idx}.amount`, { valueAsNumber: true })} />}
                  </Field>
                  <Button variant="ghost" size="icon" aria-label="Remove charge" onClick={() => charges.remove(idx)}>
                    <Trash2 className="h-4 w-4 text-ink-400" />
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <Textarea rows={3} placeholder="Delivery instructions, scheme details, cold-chain requirements…" aria-label="Notes" {...register('notes')} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Summary control={control} />
          <div className="flex flex-col gap-2">
            <Button size="lg" icon={<Send className="h-4 w-4" />} loading={save.pending && mode === 'ORDERED'} disabled={save.pending} onClick={() => submit('ORDERED')}>
              {existing?.status === 'ORDERED' ? 'Save changes' : 'Place order'}
            </Button>
            {(!existing || existing.status === 'DRAFT') && (
              <Button variant="outline" size="lg" icon={<Save className="h-4 w-4" />} loading={save.pending && mode === 'DRAFT'} disabled={save.pending} onClick={() => submit('DRAFT')}>
                Save as draft
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate(existing ? `/purchases/${existing.id}` : '/purchases')} disabled={save.pending}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default function PurchaseFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const medicineId = params.get('medicineId') ?? undefined
  const supplierId = params.get('supplierId') ?? undefined
  const po = useQuery(() => purchaseService.get(id!), [id], { enabled: !!id, tags: ['purchases'] })
  const med = useQuery(() => medicineService.get(medicineId!), [medicineId], { enabled: !id && !!medicineId, tags: ['medicines'] })

  const title = id ? `Edit ${po.data?.poNumber ?? 'purchase order'}` : 'New purchase order'
  const header = (
    <PageHeader
      title={title}
      description={id ? 'Update quantities, prices or charges before goods are received.' : 'Raise an order to a supplier. Stock increases only when goods are received.'}
      breadcrumbs={[{ label: 'Purchases', to: '/purchases' }, ...(id && po.data ? [{ label: po.data.poNumber, to: `/purchases/${id}` }] : []), { label: id ? 'Edit' : 'New' }]}
    />
  )

  if (id) {
    if (po.error) return (<>{header}<Card><ErrorState message={po.error} onRetry={po.refetch} /></Card></>)
    if (!po.data) return (<>{header}<PageLoader /></>)
    const editable = po.data.receipts.length === 0 && (po.data.status === 'DRAFT' || po.data.status === 'ORDERED')
    if (!editable)
      return (
        <>
          {header}
          <Alert tone="warning" icon={<Lock className="h-4 w-4" />} title="This purchase order can no longer be edited" action={<Link to={`/purchases/${id}`}><Button size="sm" variant="outline">View order</Button></Link>}>
            Only draft or ordered purchase orders without any goods receipts can be changed.
          </Alert>
        </>
      )
    return (
      <>
        {header}
        <PurchaseForm key={po.data.id} existing={po.data} />
      </>
    )
  }

  if (medicineId && !med.data && !med.error) return (<>{header}<PageLoader /></>)
  return (
    <>
      {header}
      {med.error && <Alert tone="warning" className="mb-4">The requested medicine could not be loaded — add items manually.</Alert>}
      <PurchaseForm key={medicineId ?? 'blank'} prefill={{ medicine: med.data, supplierId }} />
    </>
  )
}
