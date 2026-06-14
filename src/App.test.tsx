// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
}))

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    generateKeyPair: () => ({
      privateKey: '0'.repeat(63) + '1',
      publicKey: '02'.padEnd(66, '1'),
    }),
  }
})

describe('App initial state', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('starts without demo data or a demo reset action', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /demo/i })).toBeNull()
    expect((screen.getByLabelText('Flow node UUID') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('No chain data in the current filter.')).toBeTruthy()
    expect(screen.getByLabelText('Data status').textContent).toContain('No data')
  })

  it('generates a local flow node and persists it to localStorage', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /generate flow node/i }))

    await waitFor(() => {
      expect((screen.getByLabelText('Local flow node') as HTMLSelectElement).value)
        .toBe('02'.padEnd(66, '1'))
    })
    const raw = localStorage.getItem('nmsci.flowNodes.v1')
    expect(raw).not.toBeNull()
    const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
      nodes: Array<{ privateKeyHex: string; publicKeyHex: string }>
    }
    expect(saved.nodes).toEqual([expect.objectContaining({
      privateKeyHex: '0'.repeat(63) + '1',
      publicKeyHex: '02'.padEnd(66, '1'),
    })])
  })

  it('can copy the selected generated flow node id into the query UUID field', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /generate flow node/i }))

    let generatedId = ''
    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as { nodes: Array<{ id: string }> }
      generatedId = saved.nodes[0]?.id ?? ''
      expect(generatedId).not.toBe('')
    })

    fireEvent.click(screen.getByRole('button', { name: /fill node uuid/i }))

    expect((screen.getByLabelText('Flow node UUID') as HTMLTextAreaElement).value).toBe(generatedId)
  })

  it('loads a hex register difficulty target returned by the backend', async () => {
    const centralPubkey = '03dfb2c7716697bba0a12c21c431f86d4bfe3b536b2ec0b7f32e7f97bbcfb20cbe'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      message: 'ok',
      data: { height: 2518, registerDifficultyTarget: '20ffffff', centralPubkey },
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /use latest/i }))

    await waitFor(() => {
      expect((screen.getByLabelText('Register difficulty target') as HTMLInputElement).value)
        .toBe(String(0x20ffffff))
    })
    expect((screen.getByLabelText('Central pubkey') as HTMLTextAreaElement).value).toBe(centralPubkey)
    expect(screen.queryByText(/Latest block did not include registerDifficultyTarget/i)).toBeNull()
  })
})
