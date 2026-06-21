import { StrictMode, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyVault } from '../../../hooks/useKeyVault'
import { flowNodeStorageKey, type LocalFlowNode } from '../../../lib/flowNodeStorage'
import { useLocalKeyringController } from './useLocalKeyringController'

const VAULT_KEY = 'nmsci.vault.v1'

beforeEach(() => {
  localStorage.clear()
})

describe('useLocalKeyringController vault disable flow', () => {
  it('loads plaintext nodes on disabled startup under StrictMode', async () => {
    const flowNode = localFlowNode()
    localStorage.setItem(
      flowNodeStorageKey,
      JSON.stringify({
        version: 1,
        nodes: [flowNode],
      }),
    )

    const { result } = renderHook(
      () => useLocalKeyringController({ clearSelectedLocalNode: vi.fn() }),
      { wrapper: StrictModeWrapper },
    )

    await waitFor(() => {
      expect(result.current.vault.status).toBe('disabled')
      expect(result.current.localFlowNodes).toHaveLength(1)
    })
    expect(result.current.localFlowNodes[0]?.publicKeyHex).toBe(flowNode.publicKeyHex)
  })

  it('makes a disabled vault survive an immediate refresh without an unlock prompt', async () => {
    const flowNode = localFlowNode()
    localStorage.setItem(
      flowNodeStorageKey,
      JSON.stringify({
        version: 1,
        nodes: [flowNode],
      }),
    )

    const { result } = renderHook(() =>
      useLocalKeyringController({ clearSelectedLocalNode: vi.fn() }),
    )

    await waitFor(() => expect(result.current.keyringReady).toBe(true))
    expect(result.current.localFlowNodes).toHaveLength(1)

    act(() => result.current.vault.enable())
    await act(async () => {
      await result.current.vault.setup('session-passphrase')
    })

    await waitFor(() => {
      const saved = readFlowNodes()
      expect(saved.nodes[0]?.privateKey).toBeTruthy()
      expect(saved.nodes[0]?.privateKeyHex).toBeUndefined()
    })
    expect(localStorage.getItem(VAULT_KEY)).toBeTruthy()

    act(() => result.current.handleDisableVault())

    expect(localStorage.getItem(VAULT_KEY)).toBeNull()
    expect(readFlowNodes().nodes[0]).toMatchObject({
      privateKeyHex: flowNode.privateKeyHex,
    })
    expect(readFlowNodes().nodes[0]?.privateKey).toBeUndefined()

    const { result: reloadedVault } = renderHook(() => useKeyVault(localStorage))
    expect(reloadedVault.current.status).toBe('disabled')
    expect(reloadedVault.current.codec).toBeNull()
  })

  it('keeps nodes visible after refresh when disable races with an in-flight encryption migration', async () => {
    const flowNode = localFlowNode()
    localStorage.setItem(
      flowNodeStorageKey,
      JSON.stringify({
        version: 1,
        nodes: [flowNode],
      }),
    )

    const { result, unmount } = renderHook(() =>
      useLocalKeyringController({ clearSelectedLocalNode: vi.fn() }),
    )

    await waitFor(() => expect(result.current.keyringReady).toBe(true))

    act(() => result.current.vault.enable())
    await act(async () => {
      await result.current.vault.setup('session-passphrase')
    })
    act(() => result.current.handleDisableVault())

    await settleAsyncWork()

    expect(localStorage.getItem(VAULT_KEY)).toBeNull()
    expect(readFlowNodes().nodes[0]).toMatchObject({
      privateKeyHex: flowNode.privateKeyHex,
    })
    expect(readFlowNodes().nodes[0]?.privateKey).toBeUndefined()

    unmount()
    const { result: refreshed } = renderHook(() =>
      useLocalKeyringController({ clearSelectedLocalNode: vi.fn() }),
    )

    await waitFor(() => {
      expect(refreshed.current.vault.status).toBe('disabled')
      expect(refreshed.current.localFlowNodes).toHaveLength(1)
    })
    expect(refreshed.current.localFlowNodes[0]?.publicKeyHex).toBe(flowNode.publicKeyHex)
  })
})

function readFlowNodes() {
  return JSON.parse(localStorage.getItem(flowNodeStorageKey) ?? '{"nodes":[]}') as {
    nodes: Array<{ privateKey?: unknown; privateKeyHex?: string }>
  }
}

async function settleAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
  })
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>
}

function localFlowNode(): LocalFlowNode {
  return {
    id: 'flow-node-1',
    label: 'Flow node 1',
    publicKeyHex: '02'.padEnd(66, '1'),
    privateKeyHex: '0'.repeat(63) + '1',
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    authorizations: [],
  }
}
