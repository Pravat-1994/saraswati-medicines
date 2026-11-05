import { newId } from '../../lib/utils'
import { getActor, requirePermission } from '../../services/core/actor'
import { ServiceError } from '../../types/api'
import type { AppSettings, AppUser, Role } from '../../types/domain'
import { getDb, mutate, resetDb } from '../db'
import { findOrThrow } from '../helpers'
import { DOCTOR_ONLY_PERMISSIONS } from '../catalog'

export const listUsers = (): AppUser[] => [...getDb().users].sort((a, b) => a.name.localeCompare(b.name))

export const getUser = (id: string): AppUser | undefined => getDb().users.find((u) => u.id === id)

export type UserInput = Omit<AppUser, 'id' | 'createdAt' | 'lastActiveAt'>

export function saveUser(input: UserInput, id?: string): AppUser {
  requirePermission('admin.users', 'manage users')
  return mutate((db) => {
    const email = input.email.trim().toLowerCase()
    if (db.users.some((u) => u.email.toLowerCase() === email && u.id !== id)) throw new ServiceError('A user with this email already exists.', 'DUPLICATE', 409)
    if (id) {
      const u = findOrThrow(db.users, id, 'User')
      if (u.id === getActor().id && (!input.isActive || input.roleId !== u.roleId)) {
        throw new ServiceError('You cannot deactivate yourself or change your own role.', 'VALIDATION', 422)
      }
      const adminsLeft = db.users.filter((x) => x.id !== id && x.roleId === 'ADMIN' && x.isActive).length
      if (u.roleId === 'ADMIN' && (input.roleId !== 'ADMIN' || !input.isActive) && adminsLeft === 0) {
        throw new ServiceError('At least one active administrator is required.', 'VALIDATION', 422)
      }
      Object.assign(u, input, { email })
      return u
    }
    const user: AppUser = { ...input, email, id: newId('usr'), createdAt: new Date().toISOString() }
    db.users.push(user)
    return user
  })
}

export const listRoles = (): Role[] => getDb().roles

export function saveRole(role: Role): Role {
  requirePermission('admin.users', 'configure role permissions')
  return mutate((db) => {
    const r = findOrThrow(db.roles, role.id, 'Role')
    if (role.id === 'ADMIN' && !role.permissions.includes('admin.users')) {
      throw new ServiceError('Administrators must keep user management permission.', 'VALIDATION', 422)
    }
    const restricted = role.permissions.filter((p) => DOCTOR_ONLY_PERMISSIONS.includes(p))
    if (role.id !== 'DOCTOR' && restricted.length > 0) {
      throw new ServiceError(`Only the Doctor role may hold clinical-authority permissions (${restricted.join(', ')}).`, 'VALIDATION', 422)
    }
    if (role.maxDiscountPct < 0 || role.maxDiscountPct > 100) throw new ServiceError('Max discount must be between 0 and 100%.', 'VALIDATION', 422)
    Object.assign(r, { permissions: [...new Set(role.permissions)], maxDiscountPct: role.maxDiscountPct, description: role.description })
    return r
  })
}

export const getSettings = (): AppSettings => getDb().settings

export function saveSettings(settings: AppSettings): AppSettings {
  requirePermission('admin.settings', 'change settings')
  if (settings.criticalExpiryDays >= settings.nearExpiryDays) {
    throw new ServiceError('Critical expiry window must be shorter than the near-expiry window.', 'VALIDATION', 422)
  }
  if (settings.locations.length === 0) throw new ServiceError('At least one stock location is required.', 'VALIDATION', 422)
  if (settings.gstRates.length === 0) throw new ServiceError('At least one GST rate is required.', 'VALIDATION', 422)
  return mutate((db) => {
    db.settings = { ...settings, gstRates: [...new Set(settings.gstRates)].sort((a, b) => a - b) }
    return db.settings
  })
}

/** Demo-only utility: regenerates the sample dataset. Not a business operation. */
export function resetDemo(): void {
  resetDb()
}
