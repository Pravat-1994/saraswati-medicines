/**
 * Session: the signed-in user, their role and permissions.
 * Permissions here drive navigation and UI affordances only; Decisions must
 * enforce them server-side.
 */
import { create } from 'zustand'
import { setActor } from '../services/core/actor'
import { userService } from '../services/userService'
import { errorMessage } from '../hooks/useQuery'
import { safeStorage } from '../lib/storage'
import type { AppUser, Permission, Role } from '../types/domain'

const DEMO_USER_KEY = 'saraswati-medicines.demo-user'

interface SessionState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  user: AppUser | null
  role: Role | null
  roles: Role[]
  init: () => Promise<void>
  /** Demo mode: act as another user to preview role-based access. */
  switchUser: (userId: string) => Promise<void>
  refreshRoles: () => Promise<void>
}

function apply(user: AppUser, role: Role) {
  setActor({ id: user.id, name: user.name, roleId: user.roleId, permissions: role.permissions, maxDiscountPct: role.maxDiscountPct, doctorId: user.doctorId })
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  user: null,
  role: null,
  roles: [],

  init: async () => {
    set({ status: 'loading', error: undefined })
    try {
      const preferred = safeStorage.get(DEMO_USER_KEY) ?? 'usr_admin'
      const roles = await userService.roles()
      let user = await userService.current(preferred)
      if (!user || !user.isActive) user = await userService.current('usr_admin')
      if (!user) throw new Error('Unable to resolve the current user.')
      const role = roles.find((r) => r.id === user.roleId)
      if (!role) throw new Error(`Role ${user.roleId} is not configured.`)
      apply(user, role)
      set({ status: 'ready', user, role, roles })
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) })
    }
  },

  switchUser: async (userId) => {
    const user = await userService.current(userId)
    if (!user) return
    const roles = await userService.roles()
    const role = roles.find((r) => r.id === user.roleId)
    if (!role) return
    safeStorage.set(DEMO_USER_KEY, userId)
    apply(user, role)
    set({ user, role, roles })
  },

  refreshRoles: async () => {
    const roles = await userService.roles()
    const { user } = get()
    const role = user ? roles.find((r) => r.id === user.roleId) ?? null : null
    if (user && role) apply(user, role)
    set({ roles, role })
  },
}))

export function useCan(): (permission: Permission) => boolean {
  const role = useSessionStore((s) => s.role)
  return (permission) => !!role?.permissions.includes(permission)
}
