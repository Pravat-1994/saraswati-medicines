import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error?: Error
}

/** Last-resort boundary so a rendering error never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook for Decisions/telemetry logging once available.
    void error
    void info
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-lg font-semibold text-ink-900">Something went wrong</h1>
        <p className="max-w-md text-sm text-ink-500">{this.state.error.message}</p>
        <button
          className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          onClick={() => {
            this.setState({ error: undefined })
            window.location.hash = '#/'
          }}
        >
          Return to dashboard
        </button>
      </div>
    )
  }
}
