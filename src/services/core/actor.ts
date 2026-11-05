/**
 * The current acting user, set by the session store. Mock handlers use it to
 * stamp audit fields and to emulate the authorisation checks Decisions will
 * enforce server-side. Frontend checks are for usability only — they are not
 * a security boundary.
 */
import type { Permission, RoleId } from '../../types/domain'
import { ServiceError } from '../../types/api'

export interface Actor {
  id: string
  name: string
  roleId: RoleId
  permissions: Permission[]
  maxDiscountPct: number
  /** Linked doctor profile (Doctor role). */
  doctorId?: string
}

let current: Actor = { id: 'anonymous', name: 'Unknown user', roleId: 'SALES_OPERATOR', permissions: [], maxDiscountPct: 0 }

export const setActor = (actor: Actor): void => {
  current = actor
}

export const getActor = (): Actor => current

export const actorCan = (permission: Permission): boolean => current.permissions.includes(permission)

export function requirePermission(permission: Permission, action: string): void {
  if (!actorCan(permission)) {
    throw new ServiceError(`Your role is not permitted to ${action}.`, 'FORBIDDEN', 403)
  }
}
