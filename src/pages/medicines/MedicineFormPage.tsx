import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { inventoryService, medicineService, supplierService } from '../../services'
import { addMonths, toISODate, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { marginPct } from '../../lib/pricing'
import { useSettings } from '../../stores/settingsStore'
import { useCan } from '../../stores/sessionStore'
import type { MedicineInput } from '../../types/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormSection, Input, Select, Switch, Textarea } from '../../components/ui/Form'
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback'

const money = (label: string) => z.number({ error: `${label} is required` }).min(0, `${label} cannot be negative`).max(1_000_000, 'Too large')
const int = (label: string) => z.number({ error: `${label} is required` }).int('Whole numbers only').min(0, `${label} cannot be negative`)

const schema = z
  .object({
    code: z.string().trim().min(3, 'Medicine code is required').max(20).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only'),
    name: z.string().trim().min(2, 'Name is required').max(80),
    genericName: z.string().trim().min(2, 'Generic name is required').max(120),
    manufacturer: z.string().trim().min(2, 'Manufacturer is required').max(80),
    category: z.string().min(1, 'Choose a category'),
    composition: z.string().trim().min(2, 'Composition is required').max(250),
    strength: z.string().trim().min(1, 'Strength is required').max(40),
    dosageForm: z.string().min(1, 'Choose a dosage form'),
    packSize: z.string().trim().min(2, 'Pack size is required').max(60),
    barcode: z.string().trim().regex(/^(\d{8}|\d{12,14})?$/, 'Barcode must be 8, 12, 13 or 14 digits').optional().or(z.literal('')),
    hsnCode: z.string().trim().regex(/^\d{4,8}$/, 'HSN must be 4–8 digits'),
    gstRate: z.number({ error: 'Choose a GST rate' }),
    purchasePrice: money('Purchase price'),
    sellingPrice: money('Selling price').positive('Selling price must be greater than zero'),
    minStockLevel: int('Minimum stock'),
    reorderQuantity: int('Reorder quantity'),
    primarySupplierId: z.string().optional(),
    storageInstructions: z.string().trim().min(3, 'Storage instructions are required').max(300),
    prescriptionRequired: z.boolean(),
    isActive: z.boolean(),
    addOpening: z.boolean(),
    batchNumber: z.string().trim().optional(),
    mfgDate: z.string().optional(),
    expiryDate: z.string().optional(),
    openingQty: z.number().optional(),
    location: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.sellingPrice < v.purchasePrice) ctx.addIssue({ code: 'custom', path: ['sellingPrice'], message: 'Selling price cannot be below purchase price' })
    if (!v.addOpening) return
    if (!v.batchNumber || v.batchNumber.length < 3) ctx.addIssue({ code: 'custom', path: ['batchNumber'], message: 'Batch number is required' })
    if (!v.mfgDate) ctx.addIssue({ code: 'custom', path: ['mfgDate'], message: 'Required' })
    if (!v.expiryDate) ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Required' })
    if (v.mfgDate && v.mfgDate > todayISO()) ctx.addIssue({ code: 'custom', path: ['mfgDate'], message: 'Cannot be in the future' })
    if (v.mfgDate && v.expiryDate && v.expiryDate <= v.mfgDate) ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Must be after manufacturing date' })
    if (v.expiryDate && v.expiryDate <= todayISO()) ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Batch is already expired' })
    if (!v.openingQty || v.openingQty <= 0 || !Number.isInteger(v.openingQty)) ctx.addIssue({ code: 'custom', path: ['openingQty'], message: 'Enter a whole quantity above zero' })
  })

type FormValues = z.infer<typeof schema>

export default function MedicineFormPage() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const settings = useSettings()
  const can = useCan()
  const existing = useQuery(() => medicineService.get(id!), [id], { enabled: editing })
  const lookups = useQuery(() => medicineService.lookups(), [], { tags: ['medicines'] })
  const suppliers = useQuery(() => supplierService.list({ pageSize: 500, filters: { status: 'ACTIVE' } }), [], { tags: ['suppliers'] })
  const suggested = useQuery(() => medicineService.suggestCode(), [], { enabled: !editing })

  const defaults = useMemo<FormValues>(
    () => ({
      code: '',
      name: '',
      genericName: '',
      manufacturer: '',
      category: '',
      composition: '',
      strength: '',
      dosageForm: 'Tablet',
      packSize: '',
      barcode: '',
      hsnCode: '3004',
      gstRate: settings.gstRates.includes(12) ? 12 : settings.gstRates[0],
      purchasePrice: Number.NaN,
      sellingPrice: Number.NaN,
      minStockLevel: 10,
      reorderQuantity: 30,
      primarySupplierId: '',
      storageInstructions: 'Store below 25°C in a dry place, away from direct sunlight.',
      prescriptionRequired: false,
      isActive: true,
      addOpening: false,
      batchNumber: '',
      mfgDate: toISODate(addMonths(new Date(), -2)),
      expiryDate: toISODate(addMonths(new Date(), 22)),
      openingQty: undefined,
      location: settings.locations[0],
    }),
    [settings],
  )

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })
  const { register, handleSubmit, reset, setValue, control, formState } = form
  const errors = formState.errors

  useEffect(() => {
    if (existing.data) {
      const m = existing.data.medicine
      reset({ ...defaults, ...m, barcode: m.barcode ?? '', primarySupplierId: m.primarySupplierId ?? '', addOpening: false })
    }
  }, [existing.data, defaults, reset])

  useEffect(() => {
    if (!editing && suggested.data && !form.getValues('code')) setValue('code', suggested.data)
  }, [editing, suggested.data, setValue, form])

  const [purchase, selling, gst, addOpening, isActive] = useWatch({ control, name: ['purchasePrice', 'sellingPrice', 'gstRate', 'addOpening', 'isActive'] })
  const margin = Number.isFinite(purchase) && Number.isFinite(selling) && selling > 0 ? marginPct(selling, purchase) : undefined
  const taxable = Number.isFinite(selling) ? (settings.pricesIncludeGst ? selling / (1 + gst / 100) : selling) : undefined

  const onSubmit = async (v: FormValues) => {
    const input: MedicineInput = {
      code: v.code,
      name: v.name,
      genericName: v.genericName,
      manufacturer: v.manufacturer,
      category: v.category,
      composition: v.composition,
      strength: v.strength,
      dosageForm: v.dosageForm,
      packSize: v.packSize,
      barcode: v.barcode ?? '',
      hsnCode: v.hsnCode,
      gstRate: v.gstRate,
      purchasePrice: v.purchasePrice,
      sellingPrice: v.sellingPrice,
      minStockLevel: v.minStockLevel,
      reorderQuantity: v.reorderQuantity,
      primarySupplierId: v.primarySupplierId || undefined,
      storageInstructions: v.storageInstructions,
      prescriptionRequired: v.prescriptionRequired,
      isActive: v.isActive,
    }
    try {
      const saved = editing ? await medicineService.update(id!, input) : await medicineService.create(input)
      if (!editing && v.addOpening) {
        try {
          await inventoryService.addBatch({
            medicineId: saved.id,
            batchNumber: v.batchNumber!,
            mfgDate: v.mfgDate!,
            expiryDate: v.expiryDate!,
            purchasePrice: v.purchasePrice,
            sellingPrice: v.sellingPrice,
            quantity: v.openingQty!,
            location: v.location ?? settings.locations[0],
            supplierId: input.primarySupplierId,
          })
        } catch (err) {
          toast.error(`Medicine saved, but opening stock failed: ${errorMessage(err)}`)
        }
      }
      invalidate()
      toast.success(editing ? `${saved.name} updated` : `${saved.name} added to the catalogue`)
      navigate(`/medicines/${saved.id}`)
    } catch (err) {
      const msg = errorMessage(err)
      if (/code/i.test(msg)) form.setError('code', { message: msg })
      else if (/barcode/i.test(msg)) form.setError('barcode', { message: msg })
      else if (/selling price/i.test(msg)) form.setError('sellingPrice', { message: msg })
      toast.error(msg)
    }
  }

  if (editing && existing.error) return <ErrorState message={existing.error} onRetry={existing.refetch} />
  if (editing && !existing.data) return <PageLoader />

  const title = editing ? `Edit ${existing.data?.medicine.name}` : 'Add medicine'
  const num = { valueAsNumber: true } as const

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title={title}
        description={editing ? 'Update catalogue details. Batch-level prices and quantities are managed in Inventory.' : 'Create a new catalogue entry. You can optionally record opening stock.'}
        breadcrumbs={[{ label: 'Medicines', to: '/medicines' }, ...(editing ? [{ label: existing.data!.medicine.name, to: `/medicines/${id}` }] : []), { label: editing ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" icon={<Save className="h-4 w-4" />} loading={formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create medicine'}
            </Button>
          </>
        }
      />
      {Object.keys(errors).length > 0 && formState.isSubmitted && (
        <Alert tone="danger" className="mb-4" title="Please fix the highlighted fields">
          {Object.keys(errors).length} field(s) need attention.
        </Alert>
      )}
      <Card className="px-5 sm:px-6">
        <FormSection title="Product details" description="How the medicine appears on the counter, invoices and reports.">
          <Field label="Brand / medicine name" required error={errors.name?.message}>
            {(fid) => <Input id={fid} placeholder="e.g. Dolo 650" invalid={!!errors.name} {...register('name')} />}
          </Field>
          <Field label="Generic name" required error={errors.genericName?.message}>
            {(fid) => <Input id={fid} placeholder="e.g. Paracetamol" invalid={!!errors.genericName} {...register('genericName')} />}
          </Field>
          <Field label="Manufacturer / brand owner" required error={errors.manufacturer?.message}>
            {(fid) => (
              <>
                <Input id={fid} list="manufacturers" placeholder="e.g. Micro Labs" invalid={!!errors.manufacturer} {...register('manufacturer')} />
                <datalist id="manufacturers">{lookups.data?.manufacturers.map((m) => <option key={m} value={m} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Category" required error={errors.category?.message}>
            {(fid) => <Select id={fid} placeholder="Select category" invalid={!!errors.category} options={(lookups.data?.categories ?? settings.categories).map((c) => ({ value: c, label: c }))} {...register('category')} />}
          </Field>
          <Field label="Composition" required error={errors.composition?.message} className="sm:col-span-2">
            {(fid) => <Input id={fid} placeholder="e.g. Paracetamol 650 mg" invalid={!!errors.composition} {...register('composition')} />}
          </Field>
          <Field label="Strength" required error={errors.strength?.message}>
            {(fid) => <Input id={fid} placeholder="e.g. 650 mg" invalid={!!errors.strength} {...register('strength')} />}
          </Field>
          <Field label="Dosage form" required error={errors.dosageForm?.message}>
            {(fid) => <Select id={fid} options={settings.dosageForms.map((d) => ({ value: d, label: d }))} {...register('dosageForm')} />}
          </Field>
          <Field label="Pack size" required error={errors.packSize?.message} hint="The selling unit, e.g. Strip of 15 tablets">
            {(fid) => <Input id={fid} placeholder="Strip of 10 tablets" invalid={!!errors.packSize} {...register('packSize')} />}
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Prescription required" description="Show an Rx reminder at billing" {...register('prescriptionRequired')} />
          </div>
        </FormSection>

        <FormSection title="Identification" description="Medicine codes must be unique. Barcodes speed up scanning at the counter.">
          <Field label="Medicine code / SKU" required error={errors.code?.message}>
            {(fid) => (
              <Input
                id={fid}
                className="font-mono uppercase"
                invalid={!!errors.code}
                trailing={
                  !editing && suggested.data ? (
                    <button type="button" title="Use next available code" onClick={() => setValue('code', suggested.data!, { shouldValidate: true })} className="rounded p-1 text-brand-600 hover:bg-brand-50">
                      <Sparkles className="h-4 w-4" />
                    </button>
                  ) : undefined
                }
                {...register('code')}
              />
            )}
          </Field>
          <Field label="Barcode (EAN)" error={errors.barcode?.message} hint="Optional">
            {(fid) => <Input id={fid} inputMode="numeric" className="font-mono" placeholder="8901234567890" invalid={!!errors.barcode} {...register('barcode')} />}
          </Field>
          <Field label="HSN code" required error={errors.hsnCode?.message}>
            {(fid) => <Input id={fid} inputMode="numeric" className="font-mono" invalid={!!errors.hsnCode} {...register('hsnCode')} />}
          </Field>
        </FormSection>

        <FormSection title="Pricing & tax" description={`Prices are per selling unit. Selling prices are ${settings.pricesIncludeGst ? 'GST-inclusive (MRP)' : 'GST-exclusive'} per store settings.`}>
          <Field label="Purchase price (₹)" required error={errors.purchasePrice?.message}>
            {(fid) => <Input id={fid} type="number" step="0.01" min="0" leading="₹" invalid={!!errors.purchasePrice} {...register('purchasePrice', num)} />}
          </Field>
          <Field label={settings.pricesIncludeGst ? 'Selling price / MRP (₹)' : 'Selling price (₹)'} required error={errors.sellingPrice?.message}>
            {(fid) => <Input id={fid} type="number" step="0.01" min="0" leading="₹" invalid={!!errors.sellingPrice} {...register('sellingPrice', num)} />}
          </Field>
          <Field label="GST rate" required error={errors.gstRate?.message}>
            {(fid) => <Select id={fid} options={settings.gstRates.map((r) => ({ value: String(r), label: `${r}%` }))} {...register('gstRate', num)} />}
          </Field>
          <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3 text-[13px]">
            <div>
              <div className="text-xs text-ink-500">Margin on price</div>
              <div className={`num font-semibold ${margin !== undefined && margin < 10 ? 'text-amber-700' : 'text-ink-900'}`}>{margin !== undefined ? `${margin.toFixed(1)}%` : '—'}</div>
            </div>
            <div className="h-8 w-px bg-ink-200" />
            <div>
              <div className="text-xs text-ink-500">Taxable value</div>
              <div className="num font-semibold text-ink-900">{taxable !== undefined ? formatINR(taxable) : '—'}</div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Stock control" description="Low-stock alerts trigger when available stock falls to the minimum level.">
          <Field label="Minimum stock level" required error={errors.minStockLevel?.message}>
            {(fid) => <Input id={fid} type="number" min="0" invalid={!!errors.minStockLevel} {...register('minStockLevel', num)} />}
          </Field>
          <Field label="Reorder quantity" required error={errors.reorderQuantity?.message}>
            {(fid) => <Input id={fid} type="number" min="0" invalid={!!errors.reorderQuantity} {...register('reorderQuantity', num)} />}
          </Field>
          <Field label="Primary supplier" className="sm:col-span-2">
            {(fid) => <Select id={fid} placeholder="No preferred supplier" options={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} {...register('primarySupplierId')} />}
          </Field>
          <Field label="Storage instructions" required error={errors.storageInstructions?.message} className="sm:col-span-2">
            {(fid) => <Textarea id={fid} rows={2} invalid={!!errors.storageInstructions} {...register('storageInstructions')} />}
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={isActive} onChange={(v) => setValue('isActive', v, { shouldDirty: true })} label="Active" description="Inactive medicines are hidden from billing but keep their history." />
          </div>
        </FormSection>

        {!editing && can('inventory.adjust') && (
          <FormSection title="Opening stock" description="Optionally record the first batch now. You can add more batches later from Inventory or a purchase receipt.">
            <div className="sm:col-span-2">
              <Checkbox label="Add an opening stock batch" {...register('addOpening')} />
            </div>
            {addOpening && (
              <>
                <Field label="Batch number" required error={errors.batchNumber?.message}>
                  {(fid) => <Input id={fid} className="font-mono uppercase" invalid={!!errors.batchNumber} {...register('batchNumber')} />}
                </Field>
                <Field label="Quantity" required error={errors.openingQty?.message}>
                  {(fid) => <Input id={fid} type="number" min="1" invalid={!!errors.openingQty} {...register('openingQty', num)} />}
                </Field>
                <Field label="Manufacturing date" required error={errors.mfgDate?.message}>
                  {(fid) => <Input id={fid} type="date" max={todayISO()} invalid={!!errors.mfgDate} {...register('mfgDate')} />}
                </Field>
                <Field label="Expiry date" required error={errors.expiryDate?.message}>
                  {(fid) => <Input id={fid} type="date" invalid={!!errors.expiryDate} {...register('expiryDate')} />}
                </Field>
                <Field label="Location">
                  {(fid) => <Select id={fid} options={settings.locations.map((l) => ({ value: l, label: l }))} {...register('location')} />}
                </Field>
              </>
            )}
          </FormSection>
        )}
      </Card>
      <div className="mt-4 flex justify-end gap-2 sm:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </form>
  )
}
