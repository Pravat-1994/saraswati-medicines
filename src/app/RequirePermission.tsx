import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { useCan } from '../stores/sessionStore'
import type { Permission } from '../types/domain'
import { EmptyState } from '../components/ui/Feedback'
import { Button } from '../components/ui/Button'

/** Route-level presentation guard. Real enforcement belongs to Decisions. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = useCan()
  if (can(permission)) return <>{children}</>
  return (
    <div className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
      <h1 className="sr-only">Access restricted</h1>
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="You don’t have access to this page"
        description="Your role does not include permission for this module. Ask an administrator if you need access."
        action={
          <Link to="/">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}
