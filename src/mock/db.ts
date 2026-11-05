/**
 * Demo-mode database. Holds the generated dataset in memory and persists it to
 * localStorage so demo edits survive a page reload. This is NOT a backend and
 * provides no security — it exists only so every screen can be exercised
 * before Decisions flows are available.
 */
import { DB_VERSION, generateSeed, type CounterKey, type DemoDatabase } from './seed'
import { documentNumber } from '../lib/utils'
import { resetClinicDb } from './clinicDb'

const STORAGE_KEY = 'saraswati-medicines.demo-db'

let db: DemoDatabase | null = null
let persistenceAvailable = true
const listeners = new Set<() => void>()

function safeRead(): DemoDatabase | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoDatabase
    return parsed.version === DB_VERSION ? parsed : null
  } catch {
    return null
  }
}

function safeWrite(value: DemoDatabase): void {
  if (!persistenceAvailable) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode / embedded host). Keep working in memory.
    persistenceAvailable = false
  }
}

export function getDb(): DemoDatabase {
  if (!db) {
    db = safeRead()
    if (!db) {
      db = generateSeed()
      safeWrite(db)
    }
  }
  return db
}

/** Apply a mutation atomically: changes are discarded if the mutator throws. */
export function mutate<T>(mutator: (draft: DemoDatabase) => T): T {
  const current = getDb()
  const draft = structuredClone(current)
  const result = mutator(draft)
  db = draft
  safeWrite(draft)
  listeners.forEach((l) => l())
  return result
}

export function nextDocumentNumber(draft: DemoDatabase, key: CounterKey, prefix: string): string {
  draft.counters[key] += 1
  return documentNumber(prefix, draft.counters[key])
}

export function resetDb(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  persistenceAvailable = true
  resetClinicDb()
  db = generateSeed()
  safeWrite(db)
  listeners.forEach((l) => l())
}

export const isPersistenceAvailable = (): boolean => persistenceAvailable

export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
