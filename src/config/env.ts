/**
 * Centralised runtime configuration. Every environment-specific value is read
 * here (from Vite `VITE_*` variables) so the rest of the app never touches
 * `import.meta.env` directly.
 */
const env = import.meta.env

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return value.toLowerCase() === 'true'
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return value !== undefined && Number.isFinite(n) ? n : fallback
}

export const appConfig = {
  /** Use the local mock data provider instead of Decisions flows. */
  demoMode: bool(env.VITE_DEMO_MODE, true),
  /** Obtain a Decisions JWT before rendering the app. */
  requireDecisionsAuth: bool(env.VITE_REQUIRE_DECISIONS_AUTH, false),
  /** Decisions portal base, e.g. `/Primary` (no trailing slash). */
  portalBase: (env.VITE_DEC_PORTAL_BASE ?? '/Primary').replace(/\/$/, ''),
  /** Project API base path appended to the portal base. */
  projectApiBase: env.VITE_DEC_PROJECT_API_BASE_URL ?? '/',
  /** Dev proxy target (only set in localdevelopment). */
  portalForProxy: env.VITE_DEC_PORTAL_FOR_PROXY,
  /** Developer JWT override for local development. */
  forceSessionId: env.VITE_DEC_FORCE_SESSION_ID,
  apiTimeoutMs: num(env.VITE_API_TIMEOUT_MS, 20000),
  mockLatencyMs: num(env.VITE_MOCK_LATENCY_MS, 150),
  baseUrl: env.BASE_URL,
  mode: env.MODE,
  appVersion: '1.0.0',
} as const

export type AppConfig = typeof appConfig
