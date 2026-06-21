import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/button'

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
          <strong>{this.props.label ?? '视图加载失败'}</strong>
          <span>{this.state.error.message}</span>
          <Button type="button" onClick={() => this.setState({ error: null })}>
            重新加载视图
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
