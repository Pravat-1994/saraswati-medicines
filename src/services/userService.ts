import { invoke } from './core/invoke'
import { FLOWS } from './core/flows'
import * as mock from '../mock/handlers/adminHandlers'
import { appConfig } from '../config/env'
import { GetCurrentUserAccount } from '../api/apiclient'
import type { AppSettings, AppUser, Role } from '../types/domain'
import type { WorkflowStatus } from '../types/api'

export type { UserInput } from '../mock/handlers/adminHandlers'

/** Users, roles/permissions, settings and workflow status. */
export const userService = {
  /**
   * Resolves the signed-in user. Integrated mode: Decisions account from
   * AccountService/GetCurrentAccount mapped to an AppUser by the Users/Current
   * flow (role from Decisions group membership).
   */
  async current(demoUserId: string): Promise<AppUser | undefined> {
    if (!appConfig.demoMode) {
      // TODO: Replace with Decisions flow that maps the Decisions account to an app role.
      const account = (await GetCurrentUserAccount()) as { EmailAddress?: string } | null
      return invoke(FLOWS.users.current, { email: account?.EmailAddress }, () => undefined)
    }
    return invoke(FLOWS.users.current, {}, () => mock.getUser(demoUserId))
  },

  list(): Promise<AppUser[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.users.list, {}, () => mock.listUsers())
  },

  save(input: mock.UserInput, id?: string): Promise<AppUser> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.users.save, { id, ...input }, () => mock.saveUser(input, id))
  },

  roles(): Promise<Role[]> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.users.roles, {}, () => mock.listRoles())
  },

  saveRole(role: Role): Promise<Role> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.users.saveRole, role, () => mock.saveRole(role))
  },

  settings(): Promise<AppSettings> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.settings.get, {}, () => mock.getSettings())
  },

  saveSettings(settings: AppSettings): Promise<AppSettings> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.settings.save, settings, () => mock.saveSettings(settings))
  },

  /** Status of a Decisions workflow (e.g. approval) started by a service call. */
  workflowStatus(workflowId: string): Promise<WorkflowStatus> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(FLOWS.workflows.status, { workflowId }, () => ({
      workflowId,
      name: 'Demo workflow',
      status: 'COMPLETED' as const,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message: 'Workflows complete instantly in demo mode.',
    }))
  },

  /** Demo mode only: regenerate sample data. */
  resetDemoData(): Promise<void> {
    return invoke('demo/reset', {}, () => mock.resetDemo())
  },
}
