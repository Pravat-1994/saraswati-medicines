import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Pencil, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Tabs } from '../../components/ui/Tabs'
import { ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { FilterBar, SearchInput } from '../../components/ui/FilterBar'
import { useQuery } from '../../hooks/useQuery'
import { userService } from '../../services'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { relativeTime } from '../../lib/dates'
import { initials } from '../../lib/utils'
import type { AppUser, RoleId } from '../../types/domain'
import { UserFormModal } from './UserFormModal'
import { RolesPanel } from './RolesPanel'

type TabKey = 'users' | 'roles'
const ROLE_TONE: Record<RoleId, BadgeTone> = { ADMIN: 'violet', STORE_MANAGER: 'info', PHARMACIST: 'brand', SALES_OPERATOR: 'neutral', DOCTOR: 'success', RECEPTIONIST: 'accent', NURSE: 'info', BILLING_OPERATOR: 'warning' }

export default function UsersPage() {
  const can = useCan()
  const me = useSessionStore((s) => s.user?.id)
  const [params, setParams] = useSearchParams()
  const tab: TabKey = params.get('tab') === 'roles' ? 'roles' : 'users'
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [creating, setCreating] = useState(false)
  const q = useQuery(
    async () => {
      const [users, roles] = await Promise.all([userService.list(), userService.roles()])
      return { users, roles }
    },
    [],
    { tags: ['users'] },
  )
  const manage = can('admin.users')

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  const users = q.data?.users ?? []
  const roles = q.data?.roles ?? []
  const roleName = (id: RoleId) => roles.find((r) => r.id === id)?.name ?? id
  const filtered = users.filter((u) => !search || `${u.name} ${u.email} ${roleName(u.roleId)}`.toLowerCase().includes(search.toLowerCase()))

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      sortValue: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-bold text-white">{initials(u.name)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate font-medium text-ink-900">
              {u.name}
              {u.id === me && <Badge tone="accent">You</Badge>}
            </div>
            <div className="truncate text-xs text-ink-500">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortable: true, sortValue: (u) => roleName(u.roleId), cell: (u) => <Badge tone={ROLE_TONE[u.roleId]}>{roleName(u.roleId)}</Badge> },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (u) => <span className="num text-ink-600">{u.phone ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (u) => (u.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Inactive</Badge>) },
    { key: 'last', header: 'Last active', hideBelow: 'md', sortable: true, sortValue: (u) => u.lastActiveAt ?? '', cell: (u) => (u.lastActiveAt ? relativeTime(u.lastActiveAt) : <span className="text-ink-400">Never</span>) },
    ...(manage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (u: AppUser) => (
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Who can use the system and what each role is allowed to do."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Administration' }, { label: 'Users & roles' }]}
        actions={
          manage &&
          tab === 'users' && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)} disabled={!q.data}>
              Add user
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {q.loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Users" value={users.length} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Active" value={users.filter((u) => u.isActive).length} icon={<UserCheck className="h-4 w-4" />} tone="blue" />
            <StatCard label="Roles" value={roles.length} icon={<ShieldCheck className="h-4 w-4" />} tone="violet" footer="Administrator, Manager, Pharmacist, Operator" />
          </>
        )}
      </div>
      <Tabs<TabKey>
        className="mb-6"
        value={tab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={[
          { key: 'users', label: 'Users', count: users.length },
          { key: 'roles', label: 'Roles & permissions', count: roles.length },
        ]}
      />
      {tab === 'users' ? (
        <Card>
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search users…" />
          </FilterBar>
          <DataTable
            columns={columns}
            rows={q.data ? filtered : undefined}
            loading={q.loading}
            rowKey={(u) => u.id}
            pageSize={15}
            caption="Users"
            rowClassName={(u) => (!u.isActive ? 'opacity-60' : undefined)}
          />
        </Card>
      ) : q.loading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <RolesPanel roles={roles} canEdit={manage} />
      )}
      <UserFormModal open={creating} onClose={() => setCreating(false)} roles={roles} />
      <UserFormModal open={!!editing} onClose={() => setEditing(null)} user={editing ?? undefined} roles={roles} />
    </>
  )
}
