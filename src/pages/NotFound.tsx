import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/Feedback'
import { Button } from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-ink-200/70 bg-white shadow-card">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={<Compass className="h-5 w-5" />}
        title="Page not found"
        description="The page you’re looking for doesn’t exist or may have moved."
        action={
          <Link to="/">
            <Button>Go to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}
