import { vi } from 'vitest'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../lib/types'

type MockVaultStatus = 'setup' | 'locked' | 'unlocked'

const mockVault = vi.hoisted(() => ({
  error: null as string | null,
  status: 'unlocked' as MockVaultStatus,
}))

export function resetMockVault() {
  mockVault.status = 'unlocked'
  mockVault.error = null
}

export function setMockVaultStatus(status: MockVaultStatus) {
  mockVault.status = status
  mockVault.error = null
}

vi.mock('../components/NetworkGraph', () => ({
  NetworkGraph: ({
    graph,
    onAddConsumeNode,
    onAddFlowNode,
    onSelectEdge,
    onSelectNode,
  }: {
    graph: ChainGraph
    selectedId: string | null
    onSelectEdge: (edge: ChainGraphEdge) => void
    onSelectNode: (node: ChainGraphNode) => void
    onAddFlowNode?: (position: { x: number; y: number }) => void
    onAddConsumeNode?: (position: { x: number; y: number }) => void
  }) => (
    <div data-testid="network-graph">
      <button type="button" onClick={() => onAddFlowNode?.({ x: 12, y: 34 })}>
        canvas add flow node
      </button>
      <button type="button" onClick={() => onAddConsumeNode?.({ x: 56, y: 78 })}>
        canvas add consume node
      </button>
      {graph.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node)}>
          Select node {node.id}
        </button>
      ))}
      {graph.edges.map((edge) => (
        <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)}>
          Select edge {edge.id}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../hooks/useKeyVault', async () => {
  const React = await import('react')

  return {
    useKeyVault: () => {
      const [status, setStatus] = React.useState<MockVaultStatus>(mockVault.status)
      const [error, setError] = React.useState<string | null>(mockVault.error)
      const unlockSession = () => {
        mockVault.status = 'unlocked'
        mockVault.error = null
        setStatus('unlocked')
        setError(null)
        return true
      }

      return {
        status,
        error,
        setup: vi.fn(async () => unlockSession()),
        unlock: vi.fn(async () => unlockSession()),
        lock: vi.fn(() => {
          mockVault.status = 'locked'
          setStatus('locked')
        }),
        codec: {
          encrypt: (plaintext: string) => Promise.resolve({ iv: 'iv', ct: btoa(plaintext) }),
          decrypt: (secret: { ct: string }) => Promise.resolve(atob(secret.ct)),
        },
      }
    },
  }
})

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    generateKeyPair: () => ({
      privateKey: '0'.repeat(63) + '1',
      publicKey: '02'.padEnd(66, '1'),
    }),
    getPublicKeyFromPrivate: (privateKeyHex: string) =>
      privateKeyHex === '0'.repeat(63) + '1'
        ? '02'.padEnd(66, '1')
        : actual.getPublicKeyFromPrivate(privateKeyHex),
    mineNonce: async (
      _prefix: Uint8Array,
      _suffix: Uint8Array,
      _target: string,
      onProgress?: (attempts: number, hashHex: string, nonce: number) => void,
    ) => {
      onProgress?.(1000, '00', 42)
      return 42
    },
    mineTransactionRecordNonce: async (
      _prefix: Uint8Array,
      _suffix: Uint8Array,
      _target: string,
      onProgress?: (attempts: number, hashHex: string, nonce: number) => void,
    ) => {
      onProgress?.(500, '00', 7)
      return 7
    },
    mineTransactionMountNonce: async (
      _prefix: Uint8Array,
      _suffix: Uint8Array,
      _target: string,
      onProgress?: (attempts: number, hashHex: string, nonce: number) => void,
    ) => {
      onProgress?.(500, '00', 9)
      return 9
    },
  }
})
