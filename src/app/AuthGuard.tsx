import { useEffect, useState, type ReactNode } from 'react'
import { appConfig } from '../config/env'
import { getAuthToken, redirectToLogin, storeAuthToken } from '../Auth'

/**
 * Decisions authentication guard (preserved from the Decisions template).
 * Obtains a JWT via AccountService/GetJWT using the Decisions session; if that
 * fails the user is redirected to the Decisions login page. Skipped when
 * VITE_REQUIRE_DECISIONS_AUTH=false (pure demo mode outside Decisions).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!appConfig.requireDecisionsAuth || !!getAuthToken())

  useEffect(() => {
    if (ready) return
    let cancelled = false
    ;(async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const forced = appConfig.forceSessionId
      if (forced) headers.Authorization = `Bearer ${forced}`
      try {
        const res = await fetch(`${appConfig.portalBase}/REST/AccountService/GetJWT`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ outputType: 'JSON' }),
        })
        const data = (await res.json()) as { GetJWTResult?: string }
        if (cancelled) return
        if (data.GetJWTResult) {
          storeAuthToken(data.GetJWTResult)
          setReady(true)
        } else {
          redirectToLogin()
        }
      } catch {
        if (!cancelled) redirectToLogin()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-500" role="status">
        Connecting to Decisions…
      </div>
    )
  }
  return <>{children}</>
}
