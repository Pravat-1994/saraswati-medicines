import { useEffect, type ReactNode } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { BrandMark } from '../components/layout/BrandLogo'
import { Button } from '../components/ui/Button'

/** Loads the session and store settings before rendering the shell. */
export function Boot({ children }: { children: ReactNode }) {
  const session = useSessionStore()
  const settings = useSettingsStore()

  useEffect(() => {
    if (session.status === 'idle') void session.init()
    if (!settings.settings && !settings.error) void settings.load()
  }, [session, settings])

  const error = session.error ?? settings.error
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <BrandMark className="h-12 w-12" />
        <div>
          <h1 className="font-display text-lg font-semibold text-ink-900">Unable to start the application</h1>
          <p className="mt-1 max-w-md text-sm text-ink-500">{error}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void session.init()
            void settings.load()
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  if (session.status !== 'ready' || !settings.settings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4" role="status" aria-live="polite">
        <BrandMark className="h-12 w-12 animate-pulse" />
        <p className="text-sm font-medium text-ink-500">Preparing Saraswati Medicines Store…</p>
      </div>
    )
  }
  return <>{children}</>
}
