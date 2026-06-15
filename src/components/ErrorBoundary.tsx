import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <strong>{this.props.label ?? 'View failed'}</strong>
          <span>{this.state.error.message}</span>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reload view
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
