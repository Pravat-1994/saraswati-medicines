import { HashRouter } from 'react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { AuthGuard } from './app/AuthGuard'
import { Boot } from './app/Boot'
import { AppRoutes } from './app/routes'
import { ErrorBoundary } from './app/ErrorBoundary'

/**
 * Root component.
 *  - AuthGuard: Decisions JWT handshake (template behaviour), skipped in pure demo mode.
 *  - Boot: loads the session (user/role) and store settings.
 *  - HashRouter: reliable deep links inside the Decisions Custom Web App host.
 */
const App = () => (
  <ErrorBoundary>
    <AuthGuard>
      <TooltipProvider delayDuration={200}>
        <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} />
        <Boot>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </Boot>
      </TooltipProvider>
    </AuthGuard>
  </ErrorBoundary>
)

export default App
