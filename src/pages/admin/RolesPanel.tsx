import { useState } from 'react'
import { Save, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { useMutation } from '../../hooks/useQuery'
import { userService } from '../../services'
import { useSessionStore } from '../../stores/sessionStore'
import { cn } from '../../lib/utils'
import type { Permission, Role } from '../../types/domain'

const GROUPS: { label: string; items: { key: Permission; label: string }[] }[] = [
  { label: 'Dashboard', items: [{ key: 'dashboard.view', label: 'View dashboard' }] },
  {
    label: 'Medicines',
    items: [
      { key: 'medicines.view', label: 'View catalogue' },
      { key: 'medicines.manage', label: 'Add / edit medicines' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { key: 'inventory.view', label: 'View stock' },
      { key: 'inventory.adjust', label: 'Request adjustments / stock-in' },
      { key: 'inventory.approve', label: 'Approve adjustments' },
      { key: 'inventory.transfer', label: 'Transfer between locations' },
    ],
  },
  {
    label: 'Sales & returns',
    items: [
      { key: 'sales.pos', label: 'Use point of sale' },
      { key: 'sales.view', label: 'View sales history' },
      { key: 'sales.overrideFefo', label: 'Override FEFO batch' },
      { key: 'sales.discount.extended', label: 'Extended discounts' },
      { key: 'returns.request', label: 'Request returns' },
      { key: 'returns.approve', label: 'Approve returns & refunds' },
    ],
  },
  {
    label: 'Purchases',
    items: [
      { key: 'purchases.view', label: 'View purchase orders' },
      { key: 'purchases.manage', label: 'Create / edit orders' },
      { key: 'purchases.receive', label: 'Receive goods (GRN)' },
    ],
  },
  {
    label: 'Suppliers',
    items: [
      { key: 'suppliers.view', label: 'View suppliers' },
      { key: 'suppliers.manage', label: 'Add / edit suppliers' },
      { key: 'suppliers.payments', label: 'Record payments' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { key: 'customers.view', label: 'View customers' },
      { key: 'customers.manage', label: 'Add / edit customers' },
    ],
  },
  {
    label: 'Online orders',
    items: [
      { key: 'orders.view', label: 'View online orders' },
      { key: 'orders.manage', label: 'Confirm, fulfil & cancel orders' },
      { key: 'orders.verifyRx', label: 'Verify prescriptions' },
    ],
  },
  { label: 'Reports', items: [{ key: 'reports.view', label: 'View reports & analytics' }] },
  {
    label: 'Administration',
    items: [
      { key: 'admin.users', label: 'Manage users & roles' },
      { key: 'admin.settings', label: 'Change store settings' },
    ],
  },
]

export function RolesPanel({ roles, canEdit }: { roles: Role[]; canEdit: boolean }) {
  return (
    <div className="space-y-6">
      <Alert tone="warning" icon={<ShieldAlert className="h-4 w-4" />} title="Interface permissions only">
        Permissions shown here control the interface only. Decisions BPM must enforce them on the server.
      </Alert>
      {roles.map((r) => (
        <RoleCard key={`${r.id}-${r.permissions.join(',')}-${r.maxDiscountPct}`} role={r} canEdit={canEdit} />
      ))}
    </div>
  )
}

function RoleCard({ role, canEdit }: { role: Role; canEdit: boolean }) {
  const [perms, setPerms] = useState<Set<Permission>>(() => new Set(role.permissions))
  const [discount, setDiscount] = useState(String(role.maxDiscountPct))
  const [description, setDescription] = useState(role.description)
  const discountNum = Number(discount)
  const discountError = discount === '' || !Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100 ? 'Enter 0–100' : undefined
  const dirty =
    description !== role.description || discountNum !== role.maxDiscountPct || perms.size !== role.permissions.length || role.permissions.some((p) => !perms.has(p))
  const locked = (p: Permission) => role.id === 'ADMIN' && p === 'admin.users'

  const save = useMutation(
    () => userService.saveRole({ ...role, description: description.trim(), maxDiscountPct: discountNum, permissions: [...perms] }),
    {
      invalidates: ['users'],
      successMessage: `${role.name} permissions saved`,
      onSuccess: () => void useSessionStore.getState().refreshRoles(),
    },
  )

  const toggle = (p: Permission) =>
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-4 w-4" />}
        title={
          <span className="flex items-center gap-2">
            {role.name}
            <Badge tone="neutral">{perms.size} permissions</Badge>
          </span>
        }
        description={role.description}
        action={
          canEdit && (
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} disabled={!dirty || !!discountError} loading={save.pending} onClick={() => void save.run()}>
              Save
            </Button>
          )
        }
      />
      <CardBody>
        <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Description">{(id) => <Textarea id={id} rows={2} value={description} disabled={!canEdit} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <Field label="Max discount (%)" error={discountError} hint="Line & bill discount limit at POS">
            {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} max={100} invalid={!!discountError} value={discount} disabled={!canEdit} onChange={(e) => setDiscount(e.target.value)} />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map((g) => (
            <fieldset key={g.label} className="rounded-xl border border-ink-200/70 bg-ink-50/40 p-3">
              <legend className="px-1 text-xs font-semibold tracking-wide text-ink-500 uppercase">{g.label}</legend>
              <div className="space-y-1.5">
                {g.items.map((p) => (
                  <label key={p.key} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-[13px] text-ink-700 hover:bg-white', (!canEdit || locked(p.key)) && 'cursor-not-allowed opacity-70')}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={perms.has(p.key)}
                      disabled={!canEdit || locked(p.key)}
                      onChange={() => toggle(p.key)}
                    />
                    <span className="flex-1">{p.label}</span>
                    <code className="hidden text-[10px] text-ink-400 2xl:inline">{p.key}</code>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
