import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flowNodeStorageKey, type LocalFlowNode } from '../../../lib/flowNodeStorage'
import { useLocalKeyringController } from './useLocalKeyringController'

const VAULT_KEY = 'nmsci.vault.v1'
const VERIFIER_PLAINTEXT = 'nmsci-key-vault-verifier'

const vaultCrypto = vi.hoisted(() => {
  const pendingPrivateEncryptions: Array<() => void> = []
  const pendingPrivateDecryptions: Array<() => void> = []

  return {
    pendingPrivateDecryptions,
    pendingPrivateEncryptions,
    reset() {
      pendingPrivateDecryptions.length = 0
      pendingPrivateEncryptions.length = 0
    },
    resolvePrivateDecryptions() {
      const pending = pendingPrivateDecryptions.splice(0)
      for (const resolve of pending) resolve()
    },
    resolvePrivateEncryptions() {
      const pending = pendingPrivateEncryptions.splice(0)
      for (const resolve of pending) resolve()
    },
  }
})

vi.mock('../../../lib/keyVault', () => ({
  randomSalt: () => 'mock-salt',
  deriveKey: () => Promise.resolve({}),
  encryptSecret: (_key: unknown, plaintext: string) => {
    if (plaintext === VERIFIER_PLAINTEXT) {
      return Promise.resolve({ iv: 'verifier', ct: btoa(plaintext) })
    }

    return new Promise<{ iv: string; ct: string }>((resolve) => {
      vaultCrypto.pendingPrivateEncryptions.push(() => {
        resolve({ iv: 'private-key', ct: btoa(plaintext) })
      })
    })
  },
  decryptSecret: (_key: unknown, secret: { iv: string; ct: string }) => {
    if (secret.iv === 'verifier') return Promise.resolve(atob(secret.ct))

    return new Promise<string>((resolve) => {
      vaultCrypto.pendingPrivateDecryptions.push(() => {
        resolve(atob(secret.ct))
      })
    })
  },
}))

beforeEach(() => {
  localStorage.clear()
  vaultCrypto.reset()
})

describe('useLocalKeyringController vault disable races', () => {
  it('does not let a stale encrypted migration hide plaintext nodes after refresh', async () => {
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

    await waitFor(() => {
      expect(vaultCrypto.pendingPrivateEncryptions).toHaveLength(1)
    })

    act(() => result.current.handleDisableVault())
    expect(localStorage.getItem(VAULT_KEY)).toBeNull()
    expect(readFlowNodes().nodes[0]?.privateKeyHex).toBe(flowNode.privateKeyHex)

    await act(async () => {
      vaultCrypto.resolvePrivateEncryptions()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(readFlowNodes().nodes[0]?.privateKeyHex).toBe(flowNode.privateKeyHex)
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

  it('does not erase encrypted nodes when vault disable is clicked before keyring load finishes', async () => {
    const flowNode = localFlowNode()
    localStorage.setItem(
      VAULT_KEY,
      JSON.stringify({
        version: 1,
        salt: 'mock-salt',
        check: { iv: 'verifier', ct: btoa(VERIFIER_PLAINTEXT) },
      }),
    )
    localStorage.setItem(
      flowNodeStorageKey,
      JSON.stringify({
        version: 1,
        nodes: [
          {
            ...withoutPrivateKeyHex(flowNode),
            privateKey: { iv: 'private-key', ct: btoa(flowNode.privateKeyHex) },
          },
        ],
      }),
    )

    const { result, unmount } = renderHook(() =>
      useLocalKeyringController({ clearSelectedLocalNode: vi.fn() }),
    )

    expect(result.current.vault.status).toBe('locked')
    await act(async () => {
      await result.current.vault.unlock('session-passphrase')
    })
    await waitFor(() => {
      expect(vaultCrypto.pendingPrivateDecryptions).toHaveLength(1)
    })
    expect(result.current.localFlowNodes).toHaveLength(0)

    act(() => result.current.handleDisableVault())
    await act(async () => {
      vaultCrypto.resolvePrivateDecryptions()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

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

function withoutPrivateKeyHex(node: LocalFlowNode): Omit<LocalFlowNode, 'privateKeyHex'> {
  const { privateKeyHex: _privateKeyHex, ...rest } = node
  return rest
}
