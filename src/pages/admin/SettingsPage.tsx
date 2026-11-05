import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Database, Hospital, Plus, PlugZap, Save, Scale, Trash2, Undo2, Video } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, FormSection, Input, Select, Switch } from '../../components/ui/Form'
import { Alert, PageLoader } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { appConfig } from '../../config/env'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { clinicSettingsService } from '../../services'
import { CHARGE_CATEGORY_LABEL } from '../../lib/clinic'
import type { ChargeCategory, ClinicSettings } from '../../types/clinic'
import { useSettingsStore } from '../../stores/settingsStore'
import { useCan } from '../../stores/sessionStore'
import type { AppSettings } from '../../types/domain'
import { GSTIN_REGEX, PINCODE_REGEX, isValidIndianPhone } from '../customers/validation'
import { ChipListEditor } from './ChipListEditor'

const prefix = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,8}$/, '1–8 letters, digits or hyphens')
const wholeDays = (max: number) => z.number({ message: 'Enter a number' }).int('Whole numbers only').min(0, 'Cannot be negative').max(max, `Maximum ${max}`)

const schema = z
  .object({
    store: z.object({
      name: z.string().trim().min(3, 'Store name is required').max(80),
      tagline: z.string().trim().max(80),
      addressLine: z.string().trim().min(3, 'Address is required').max(160),
      city: z.string().trim().min(2, 'City is required'),
      state: z.string().trim().min(2, 'State is required'),
      pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),
      phone: z.string().trim().refine(isValidIndianPhone, 'Enter a valid phone number'),
      email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email'),
      gstin: z.string().trim().toUpperCase().regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN'),
      drugLicenseNo: z.string().trim().min(3, 'Drug licence number is required').max(80),
    }),
    pricesIncludeGst: z.boolean(),
    roundOffInvoice: z.boolean(),
    gstRates: z.array(z.number().min(0).max(28)).min(1, 'Add at least one GST rate'),
    invoicePrefix: prefix,
    poPrefix: prefix,
    nearExpiryDays: wholeDays(730).min(1, 'At least 1 day'),
    criticalExpiryDays: wholeDays(365).min(1, 'At least 1 day'),
    lowStockAlertsEnabled: z.boolean(),
    expiryAlertsEnabled: z.boolean(),
    adjustmentApprovalThreshold: wholeDays(100000),
    returnApprovalThreshold: z.number({ message: 'Enter an amount' }).min(0, 'Cannot be negative').max(1_000_000),
    enableStockTransfers: z.boolean(),
    locations: z.array(z.string()).min(1, 'At least one stock location is required'),
    categories: z.array(z.string()).min(1, 'At least one category is required'),
    defaultPaymentTermsDays: wholeDays(365),
    onlineOrdersEnabled: z.boolean(),
    onlineDeliveryEnabled: z.boolean(),
    onlineMinOrderValue: z.number({ message: 'Enter an amount' }).min(0, 'Cannot be negative').max(100000),
    onlineMaxQtyPerItem: wholeDays(100).min(1, 'At least 1'),
    deliveryAreaNote: z.string().trim().max(240),
  })
  .superRefine((v, ctx) => {
    if (v.criticalExpiryDays >= v.nearExpiryDays) ctx.addIssue({ code: 'custom', path: ['criticalExpiryDays'], message: 'Must be shorter than the near-expiry window' })
  })

type FormValues = z.infer<typeof schema>

const pick = (s: AppSettings): FormValues => ({
  store: { ...s.store },
  pricesIncludeGst: s.pricesIncludeGst,
  roundOffInvoice: s.roundOffInvoice,
  gstRates: [...s.gstRates],
  invoicePrefix: s.invoicePrefix,
  poPrefix: s.poPrefix,
  nearExpiryDays: s.nearExpiryDays,
  criticalExpiryDays: s.criticalExpiryDays,
  lowStockAlertsEnabled: s.lowStockAlertsEnabled,
  expiryAlertsEnabled: s.expiryAlertsEnabled,
  adjustmentApprovalThreshold: s.adjustmentApprovalThreshold,
  returnApprovalThreshold: s.returnApprovalThreshold,
  enableStockTransfers: s.enableStockTransfers,
  locations: [...s.locations],
  categories: [...s.categories],
  defaultPaymentTermsDays: s.defaultPaymentTermsDays,
  onlineOrdersEnabled: s.onlineOrdersEnabled,
  onlineDeliveryEnabled: s.onlineDeliveryEnabled,
  onlineMinOrderValue: s.onlineMinOrderValue,
  onlineMaxQtyPerItem: s.onlineMaxQtyPerItem,
  deliveryAreaNote: s.deliveryAreaNote,
})

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings)
  if (!settings) return <PageLoader />
  return (
    <>
      <SettingsForm key={JSON.stringify(settings)} settings={settings} />
      <ClinicSettingsLoader />
    </>
  )
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const can = useCan()
  const editable = can('admin.settings')
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: pick(settings) })

  const onSubmit = async (v: FormValues) => {
    try {
      await useSettingsStore.getState().save({ ...settings, ...v, store: { ...settings.store, ...v.store } })
      toast.success('Settings saved. Changes apply immediately across the app.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const text = (name: `store.${keyof AppSettings['store']}`, label: string, opts: { required?: boolean; span?: boolean; hint?: string } = {}) => {
    const key = name.split('.')[1] as keyof AppSettings['store']
    const err = errors.store?.[key]?.message
    return (
      <Field label={label} required={opts.required} error={err} hint={opts.hint} className={opts.span ? 'sm:col-span-2' : undefined}>
        {(id, d) => <Input id={id} aria-describedby={d} invalid={!!err} disabled={!editable} {...register(name)} />}
      </Field>
    )
  }
  const num = (name: 'nearExpiryDays' | 'criticalExpiryDays' | 'adjustmentApprovalThreshold' | 'returnApprovalThreshold' | 'defaultPaymentTermsDays' | 'onlineMinOrderValue' | 'onlineMaxQtyPerItem', label: string, hint?: string, step?: string) => (
    <Field label={label} error={errors[name]?.message} hint={hint} required>
      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step={step ?? '1'} invalid={!!errors[name]} disabled={!editable} {...register(name, { valueAsNumber: true })} />}
    </Field>
  )
  const toggle = (name: 'pricesIncludeGst' | 'roundOffInvoice' | 'lowStockAlertsEnabled' | 'expiryAlertsEnabled' | 'enableStockTransfers' | 'onlineOrdersEnabled' | 'onlineDeliveryEnabled', label: string, description: string) => (
    <div className="sm:col-span-2">
      <Controller control={control} name={name} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} disabled={!editable} label={label} description={description} />} />
    </div>
  )

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <PageHeader
        title="Settings"
        description="Store profile, tax & billing, inventory rules and catalogue configuration."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Administration' }, { label: 'Settings' }]}
        actions={
          editable && (
            <Button type="submit" icon={<Save className="h-4 w-4" />} disabled={!isDirty} loading={isSubmitting}>
              Save settings
            </Button>
          )
        }
      />

      <Alert tone="warning" icon={<Scale className="h-4 w-4" />} title="Review before production" className="mb-6">
        Tax treatment, GST rates, expiry windows and approval thresholds are configurable business rules, not legal or regulatory guarantees. Have them reviewed by your accountant and
        compliance advisor before going live.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardBody className="pt-2">
            <FormSection title="Store profile" description="Printed on invoices and purchase orders.">
              {text('store.name', 'Store name', { required: true, span: true })}
              {text('store.tagline', 'Tagline', { span: true })}
              {text('store.addressLine', 'Address', { required: true, span: true })}
              {text('store.city', 'City', { required: true })}
              {text('store.state', 'State', { required: true })}
              {text('store.pincode', 'PIN code', { required: true })}
              {text('store.phone', 'Phone', { required: true })}
              {text('store.email', 'Email', { required: true, span: true })}
              {text('store.gstin', 'GSTIN', { required: true })}
              {text('store.drugLicenseNo', 'Drug licence no(s).', { required: true })}
            </FormSection>

            <FormSection title="Tax & billing" description="How prices, GST and invoice numbers are handled at the counter.">
              {toggle('pricesIncludeGst', 'Selling prices include GST (MRP model)', 'When on, GST is extracted from the selling price. When off, GST is added on top of the price.')}
              {toggle('roundOffInvoice', 'Round invoice total to nearest rupee', 'The difference is shown as a round-off line on the invoice.')}
              <Field label="GST rates (%)" error={errors.gstRates?.message} className="sm:col-span-2" hint="Rates available when creating medicines and purchase orders">
                {(id) => (
                  <Controller
                    control={control}
                    name="gstRates"
                    render={({ field }) => (
                      <ChipListEditor
                        id={id}
                        numeric
                        placeholder="e.g. 5"
                        value={field.value.map(String)}
                        format={(v) => `${v}%`}
                        invalid={!!errors.gstRates}
                        validate={(v) => {
                          const n = Number(v)
                          if (!Number.isFinite(n) || n < 0 || n > 28) return 'Enter a rate between 0 and 28'
                          if (field.value.includes(n)) return 'Already in the list'
                          return undefined
                        }}
                        onChange={(list) => field.onChange(list.map(Number).sort((a, b) => a - b))}
                      />
                    )}
                  />
                )}
              </Field>
              <Field label="Invoice prefix" error={errors.invoicePrefix?.message} required hint="e.g. SMS → SMS/26-27/00001">
                {(id, d) => <Input id={id} aria-describedby={d} className="uppercase" invalid={!!errors.invoicePrefix} disabled={!editable} {...register('invoicePrefix')} />}
              </Field>
              <Field label="Purchase order prefix" error={errors.poPrefix?.message} required>
                {(id, d) => <Input id={id} aria-describedby={d} className="uppercase" invalid={!!errors.poPrefix} disabled={!editable} {...register('poPrefix')} />}
              </Field>
            </FormSection>

            <FormSection title="Inventory rules" description="Expiry alerts, low-stock alerts and authorisation thresholds.">
              {num('nearExpiryDays', 'Near-expiry window (days)', 'Batches expiring within this window are flagged')}
              {num('criticalExpiryDays', 'Critical window (days)', 'Highlighted as expiring soon')}
              {toggle('expiryAlertsEnabled', 'Expiry alerts', 'Show near-expiry and expired batches in alerts and on the dashboard.')}
              {toggle('lowStockAlertsEnabled', 'Low-stock alerts', 'Uses each medicine’s own minimum stock level.')}
              {num('adjustmentApprovalThreshold', 'Adjustment approval threshold (units)', 'Adjustments above this need manager approval. 0 = always.')}
              {num('returnApprovalThreshold', 'Return approval threshold (₹)', 'Refunds above this need approval. 0 = always.', '0.01')}
              {toggle('enableStockTransfers', 'Enable stock transfers', 'Allow moving batch quantities between storage locations.')}
              <Field label="Stock locations" error={errors.locations?.message} className="sm:col-span-2">
                {(id) => (
                  <Controller
                    control={control}
                    name="locations"
                    render={({ field }) => <ChipListEditor id={id} placeholder="e.g. Counter Shelf" value={field.value} invalid={!!errors.locations} onChange={field.onChange} />}
                  />
                )}
              </Field>
            </FormSection>

            <FormSection title="Catalogue" description="Medicine categories available in forms and filters.">
              <Field label="Medicine categories" error={errors.categories?.message} className="sm:col-span-2">
                {(id) => (
                  <Controller
                    control={control}
                    name="categories"
                    render={({ field }) => <ChipListEditor id={id} placeholder="e.g. Paediatrics" value={field.value} invalid={!!errors.categories} onChange={field.onChange} />}
                  />
                )}
              </Field>
            </FormSection>

            <FormSection title="Online orders" description="Customer storefront (#/shop): ordering, delivery and limits.">
              {toggle('onlineOrdersEnabled', 'Accept online orders', 'When off, the storefront stays browsable but checkout is disabled.')}
              {toggle('onlineDeliveryEnabled', 'Offer home delivery', 'When off, customers can only choose store pickup.')}
              {num('onlineMinOrderValue', 'Minimum order value (₹)', '0 = no minimum', '1')}
              {num('onlineMaxQtyPerItem', 'Max units per medicine', 'Per online order')}
              <Field label="Delivery area note" error={errors.deliveryAreaNote?.message} className="sm:col-span-2" hint="Shown to customers at checkout">
                {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.deliveryAreaNote} disabled={!editable} {...register('deliveryAreaNote')} />}
              </Field>
            </FormSection>

            <FormSection title="Payments" description="Defaults for new suppliers.">
              {num('defaultPaymentTermsDays', 'Default supplier payment terms (days)')}
            </FormSection>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Integration" icon={<PlugZap className="h-4 w-4" />} description="Read-only runtime configuration" />
            <CardBody>
              <dl className="grid gap-3">
                <InfoRow label="Build mode" value={<code className="text-xs">{appConfig.mode}</code>} />
                <InfoRow label="Data provider" value={appConfig.demoMode ? <Badge tone="accent">Demo (local mock data)</Badge> : <Badge tone="brand">Decisions BPM flows</Badge>} />
                <InfoRow label="Decisions portal base" value={<code className="text-xs">{appConfig.portalBase}</code>} />
                <InfoRow label="Decisions authentication" value={appConfig.requireDecisionsAuth ? 'Required (JWT via AccountService)' : 'Skipped'} />
                <InfoRow label="App version" value={appConfig.appVersion} />
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">Change these through VITE_* environment variables at build time (see README).</p>
            </CardBody>
          </Card>
          {appConfig.demoMode && (
            <Card>
              <CardHeader title="Demo data" icon={<Database className="h-4 w-4" />} />
              <CardBody>
                <p className="text-[13px] leading-relaxed text-ink-600">
                  In demo mode all records — including these settings — are stored in this browser’s local storage only. Nothing is sent to a server. Use <strong>Reset demo data</strong> from the
                  profile menu to restore the original sample dataset.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {isDirty && editable && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur lg:left-[var(--sidebar-w,0px)]">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row sm:px-8">
            <span className="text-[13px] font-medium text-ink-700">You have unsaved changes</span>
            <div className="flex gap-2">
              <Button variant="outline" icon={<Undo2 className="h-4 w-4" />} onClick={() => reset(pick(settings))} disabled={isSubmitting}>
                Discard
              </Button>
              <Button type="submit" icon={<Save className="h-4 w-4" />} loading={isSubmitting}>
                Save settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

// ───────────────────────────── Clinic settings ─────────────────────────────

const CATEGORIES = Object.keys(CHARGE_CATEGORY_LABEL) as ChargeCategory[]

const clinicSchema = z
  .object({
    facilityName: z.string().trim().min(3, 'Facility name is required').max(80),
    departments: z.array(z.string()).min(1, 'Add at least one department'),
    specializations: z.array(z.string()),
    admissionCharge: z.number({ message: 'Enter an amount' }).min(0, 'Cannot be negative').max(100000),
    defaultSlotMinutes: z.number({ message: 'Enter minutes' }).int('Whole minutes').min(5, 'At least 5 minutes').max(120, 'At most 120 minutes'),
    bookingWindowDays: z.number({ message: 'Enter days' }).int('Whole days').min(1, 'At least 1 day').max(90, 'At most 90 days'),
    maxReportSizeMb: z.number({ message: 'Enter a size' }).min(1, 'At least 1 MB').max(50, 'At most 50 MB'),
    videoProvider: z.enum(['NONE', 'JITSI', 'CUSTOM']),
    videoBaseUrl: z.string().trim(),
    serviceCatalog: z
      .array(
        z.object({
          code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,10}$/, '2–10 letters/digits'),
          name: z.string().trim().min(2, 'Name required').max(80),
          rate: z.number({ message: 'Rate' }).min(0, '≥ 0').max(1_000_000),
          taxRate: z.number({ message: 'Tax' }).min(0, '≥ 0').max(28, '≤ 28'),
          category: z.enum(CATEGORIES as [ChargeCategory, ...ChargeCategory[]]),
        }),
      )
      .min(1, 'Add at least one service'),
  })
  .superRefine((v, ctx) => {
    if (v.videoProvider !== 'NONE' && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v.videoBaseUrl)) ctx.addIssue({ code: 'custom', path: ['videoBaseUrl'], message: 'Enter the provider’s https:// base URL' })
    const codes = v.serviceCatalog.map((s) => s.code.toUpperCase())
    codes.forEach((code, i) => {
      if (codes.indexOf(code) !== i) ctx.addIssue({ code: 'custom', path: ['serviceCatalog', i, 'code'], message: 'Duplicate code' })
    })
  })

type ClinicValues = z.infer<typeof clinicSchema>

function ClinicSettingsLoader() {
  const q = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  if (!q.data) return null
  return <ClinicSettingsForm key={JSON.stringify(q.data)} settings={q.data} />
}

function ClinicSettingsForm({ settings }: { settings: ClinicSettings }) {
  const can = useCan()
  const editable = can('admin.settings')
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ClinicValues>({ resolver: zodResolver(clinicSchema), defaultValues: structuredClone(settings) })
  const tariff = useFieldArray({ control, name: 'serviceCatalog' })
  const provider = useWatch({ control, name: 'videoProvider' })

  const onSubmit = async (v: ClinicValues) => {
    try {
      await clinicSettingsService.save({ ...settings, ...v })
      invalidate()
      toast.success('Clinic settings saved.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const num = (name: 'admissionCharge' | 'defaultSlotMinutes' | 'bookingWindowDays' | 'maxReportSizeMb', label: string, hint?: string) => (
    <Field label={label} error={errors[name]?.message} hint={hint} required>
      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} invalid={!!errors[name]} disabled={!editable} {...register(name, { valueAsNumber: true })} />}
    </Field>
  )

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="-mt-16 pb-16" aria-labelledby="clinic-settings">
      <Card>
        <CardHeader
          title={<span id="clinic-settings">Clinic</span>}
          icon={<Hospital className="h-4 w-4" />}
          description="Consultations, admissions and patient billing. Healthcare records are held in memory only in demo mode."
          action={
            editable && (
              <>
                {isDirty && (
                  <Button variant="ghost" size="sm" icon={<Undo2 className="h-4 w-4" />} onClick={() => reset(structuredClone(settings))}>
                    Discard
                  </Button>
                )}
                <Button type="submit" size="sm" icon={<Save className="h-4 w-4" />} disabled={!isDirty} loading={isSubmitting}>
                  Save clinic settings
                </Button>
              </>
            )
          }
        />
        <CardBody className="pt-0">
          <FormSection title="Facility" description="Shown on prescriptions, discharge summaries and patient bills.">
            <Field label="Facility name" required error={errors.facilityName?.message} className="sm:col-span-2">
              {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.facilityName} disabled={!editable} {...register('facilityName')} />}
            </Field>
            <Field label="Departments" error={errors.departments?.message} className="sm:col-span-2">
              {(id) => <Controller control={control} name="departments" render={({ field }) => <ChipListEditor id={id} placeholder="e.g. Neurology" value={field.value} invalid={!!errors.departments} onChange={field.onChange} />} />}
            </Field>
            <Field label="Specialisations" hint="Used to filter the doctor directory" className="sm:col-span-2">
              {(id) => <Controller control={control} name="specializations" render={({ field }) => <ChipListEditor id={id} placeholder="e.g. Nephrologist" value={field.value} onChange={field.onChange} />} />}
            </Field>
          </FormSection>

          <FormSection title="Scheduling & admissions" description="Booking limits and standard charges.">
            {num('defaultSlotMinutes', 'Default consultation duration (minutes)', 'Each doctor can override this in their profile')}
            {num('bookingWindowDays', 'Booking window (days)', 'How far ahead patients can book')}
            {num('admissionCharge', 'Admission charge (₹)', 'Posted when an admission is confirmed')}
            {num('maxReportSizeMb', 'Max report upload size (MB)', 'Applies to patient reports and consultation files')}
          </FormSection>

          <FormSection title="Video consultations" description="Video and audio calls run on an external provider approved by the clinic.">
            <Field label="Provider" className="sm:col-span-2">
              {(id) => (
                <Select
                  id={id}
                  disabled={!editable}
                  options={[
                    { value: 'NONE', label: 'None — demo UI only (no call is connected)' },
                    { value: 'JITSI', label: 'Jitsi Meet' },
                    { value: 'CUSTOM', label: 'Custom / other approved provider' },
                  ]}
                  {...register('videoProvider')}
                />
              )}
            </Field>
            {provider !== 'NONE' && (
              <Field label="Provider base URL" required error={errors.videoBaseUrl?.message} className="sm:col-span-2" hint="Meeting rooms are created as {base URL}/{room id}">
                {(id, d) => <Input id={id} aria-describedby={d} placeholder="https://meet.example.org" invalid={!!errors.videoBaseUrl} disabled={!editable} {...register('videoBaseUrl')} />}
              </Field>
            )}
            <Alert tone={provider === 'NONE' ? 'info' : 'warning'} icon={<Video className="h-4 w-4" />} className="sm:col-span-2">
              {provider === 'NONE'
                ? 'No video provider is configured. The consultation room shows a clearly labelled demo area and never claims a call is connected.'
                : 'Only use a provider your organisation has approved for patient consultations (consent, encryption and data residency). Room links are generated per consultation.'}
            </Alert>
          </FormSection>

          <FormSection title="Service tariff" description="Treatment and service charges available when billing patients. Tax rates are configurable — confirm applicability with your accountant.">
            <div className="space-y-2 sm:col-span-2">
              {errors.serviceCatalog?.message && <p className="text-xs font-medium text-red-600">{errors.serviceCatalog.message}</p>}
              <div className="hidden grid-cols-[90px_1fr_110px_80px_150px_36px] gap-2 px-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase md:grid">
                <span>Code</span>
                <span>Service</span>
                <span>Rate (₹)</span>
                <span>Tax %</span>
                <span>Category</span>
                <span />
              </div>
              {tariff.fields.map((f, i) => {
                const e = errors.serviceCatalog?.[i]
                return (
                  <div key={f.id} className="grid grid-cols-2 gap-2 rounded-xl border border-ink-100 p-2 md:grid-cols-[90px_1fr_110px_80px_150px_36px] md:border-0 md:p-0">
                    <Input aria-label={`Service ${i + 1} code`} className="font-mono uppercase" invalid={!!e?.code} disabled={!editable} {...register(`serviceCatalog.${i}.code`)} title={e?.code?.message} />
                    <Input aria-label={`Service ${i + 1} name`} invalid={!!e?.name} disabled={!editable} {...register(`serviceCatalog.${i}.name`)} title={e?.name?.message} />
                    <Input aria-label={`Service ${i + 1} rate`} type="number" min={0} invalid={!!e?.rate} disabled={!editable} {...register(`serviceCatalog.${i}.rate`, { valueAsNumber: true })} title={e?.rate?.message} />
                    <Input aria-label={`Service ${i + 1} tax`} type="number" min={0} max={28} invalid={!!e?.taxRate} disabled={!editable} {...register(`serviceCatalog.${i}.taxRate`, { valueAsNumber: true })} title={e?.taxRate?.message} />
                    <Select aria-label={`Service ${i + 1} category`} disabled={!editable} options={CATEGORIES.map((k) => ({ value: k, label: CHARGE_CATEGORY_LABEL[k] }))} {...register(`serviceCatalog.${i}.category`)} />
                    {editable && (
                      <button type="button" onClick={() => tariff.remove(i)} className="flex h-10 items-center justify-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove service ${i + 1}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {(e?.code || e?.name || e?.rate || e?.taxRate) && (
                      <p className="col-span-full text-xs font-medium text-red-600">{e.code?.message ?? e.name?.message ?? e.rate?.message ?? e.taxRate?.message}</p>
                    )}
                  </div>
                )
              })}
              {editable && (
                <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => tariff.append({ code: '', name: '', rate: 0, taxRate: 0, category: 'SERVICE' })}>
                  Add service
                </Button>
              )}
            </div>
          </FormSection>
        </CardBody>
      </Card>
    </form>
  )
}