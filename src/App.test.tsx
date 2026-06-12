// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
}))

describe('App initial state', () => {
  it('starts without demo data or a demo reset action', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /demo/i })).toBeNull()
    expect((screen.getByLabelText('Flow node UUID') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('No chain data in the current filter.')).toBeTruthy()
    expect(screen.getByLabelText('Data status').textContent).toContain('No data')
  })
})
