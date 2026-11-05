/**
 * Healthcare demo database.
 *
 * PRIVACY BY DESIGN: patient and clinical records are kept in memory only and
 * are never written to localStorage/sessionStorage/IndexedDB. Reloading the page
 * regenerates the fictional sample data. Only non-sensitive clinic settings are
 * persisted locally. Production data must live in Decisions.
 */
import { generateClinicSeed, type ClinicCounter, type ClinicDatabase } from './clinicSeed'
import { DEFAULT_CLINIC_SETTINGS } from './clinicCatalog'
import { documentNumber } from '../lib/utils'
import { safeStorage } from '../lib/storage'
import type { ClinicSettings } from '../types/clinic'

const SETTINGS_KEY = 'saraswati-medicines.clinic-settings'
let db: ClinicDatabase | null = null

function loadSettings(): ClinicSettings {
  try {
    const raw = safeStorage.get(SETTINGS_KEY)
    return raw ? { ...DEFAULT_CLINIC_SETTINGS, ...(JSON.parse(raw) as Partial<ClinicSettings>) } : structuredClone(DEFAULT_CLINIC_SETTINGS)
  } catch {
    return structuredClone(DEFAULT_CLINIC_SETTINGS)
  }
}

export function getClinicDb(): ClinicDatabase {
  if (!db) {
    db = generateClinicSeed()
    db.settings = loadSettings()
  }
  return db
}

/** Atomic mutation: the draft is discarded if the mutator throws. */
export function mutateClinic<T>(mutator: (draft: ClinicDatabase) => T): T {
  const draft = structuredClone(getClinicDb())
  const result = mutator(draft)
  db = draft
  safeStorage.set(SETTINGS_KEY, JSON.stringify(draft.settings))
  return result
}

export function clinicDocNo(draft: ClinicDatabase, key: ClinicCounter, prefix: string): string {
  draft.counters[key] += 1
  return documentNumber(prefix, draft.counters[key])
}

export function resetClinicDb(): void {
  safeStorage.remove(SETTINGS_KEY)
  db = null
}
