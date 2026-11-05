import { invoke } from './core/invoke'
import { CLINIC_FLOWS as F } from './core/clinicFlows'
import { getClinicDb, mutateClinic } from '../mock/clinicDb'
import { clinicSnapshot } from '../mock/clinic/schedulingHandlers'
import { requirePermission } from './core/actor'
import type { ClinicSettings } from '../types/clinic'

/** Clinic configuration (departments, video provider, booking window, service tariff). */
export const clinicSettingsService = {
  get(): Promise<ClinicSettings> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.settings.get, {}, () => getClinicDb().settings)
  },
  save(settings: ClinicSettings): Promise<ClinicSettings> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.settings.save, settings, () => {
      requirePermission('admin.settings', 'change clinic settings')
      return mutateClinic((db) => (db.settings = settings))
    })
  },
  /** Counts for dashboard tiles and navigation badges. */
  snapshot(): Promise<ReturnType<typeof clinicSnapshot>> {
    // TODO: Replace mock implementation with Decisions BPM API/Flow integration.
    return invoke(F.admissions.dashboard, { snapshot: true }, () => clinicSnapshot())
  },
}
