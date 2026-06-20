import { vi } from 'vitest'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../lib/types'

type MockVaultStatus = 'disabled' | 'setup' | 'locked' | 'unlocked'

const mockVault = vi.hoisted(() => ({
  error: null as string | null,
  // 默认关闭：贴合真实默认（保险库关闭、私钥明文存储、无需口令）。
  status: 'disabled' as MockVaultStatus,
}))

const mockKeyPairs = vi.hoisted(() => ({
  next: 1,
  privateToPublic: new Map<string, string>(),
}))

export function resetMockVault() {
  mockVault.status = 'disabled'
  mockVault.error = null
  mockKeyPairs.next = 1
  mockKeyPairs.privateToPublic.clear()
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
    onRegisterFlowNode,
    onAuthorizeFlowNode,
    onGenerateRecord,
    onMountRecord,
    onLoadChain,
    onExportNodeKey,
    onRenameNode,
    onDeleteNode,
    onSelectEdge,
    onSelectNode,
  }: {
    graph: ChainGraph
    selectedId: string | null
    onSelectEdge: (edge: ChainGraphEdge) => void
    onSelectNode: (node: ChainGraphNode) => void
    onAddFlowNode?: (position: { x: number; y: number }) => void
    onAddConsumeNode?: (position: { x: number; y: number }) => void
    onRegisterFlowNode?: (node: ChainGraphNode) => void
    onAuthorizeFlowNode?: (node: ChainGraphNode) => void
    onGenerateRecord?: (node: ChainGraphNode) => void
    onMountRecord?: (node: ChainGraphNode) => void
    onLoadChain?: (node: ChainGraphNode, mode: 'start' | 'end' | 'node') => void
    onExportNodeKey?: (node: ChainGraphNode) => void
    onRenameNode?: (node: ChainGraphNode) => void
    onDeleteNode?: (node: ChainGraphNode) => void
  }) => (
    <div data-testid="network-graph">
      <button type="button" onClick={() => onAddFlowNode?.({ x: 12, y: 34 })}>
        canvas add flow node
      </button>
      <button type="button" onClick={() => onAddConsumeNode?.({ x: 56, y: 78 })}>
        canvas add consume node
      </button>
      {graph.nodes.map((node) => (
        <div key={node.id}>
          <button type="button" onClick={() => onSelectNode(node)}>
            Select node {node.id}
          </button>
          {node.kind === 'local-flow' ? (
            <>
              <button type="button" onClick={() => onRegisterFlowNode?.(node)}>
                context register {node.id}
              </button>
              <button type="button" onClick={() => onAuthorizeFlowNode?.(node)}>
                context authorize {node.id}
              </button>
            </>
          ) : null}
          {node.kind === 'local-flow' || node.kind === 'local-consume' ? (
            <>
              <button type="button" onClick={() => onGenerateRecord?.(node)}>
                context generate record {node.id}
              </button>
              <button type="button" onClick={() => onMountRecord?.(node)}>
                context mount record {node.id}
              </button>
              <button type="button" onClick={() => onExportNodeKey?.(node)}>
                context export key {node.id}
              </button>
              <button type="button" onClick={() => onRenameNode?.(node)}>
                context rename {node.id}
              </button>
              <button type="button" onClick={() => onDeleteNode?.(node)}>
                context delete {node.id}
              </button>
            </>
          ) : null}
          {/* 加载消费链对本地与链节点都可用。 */}
          <button type="button" onClick={() => onLoadChain?.(node, 'end')}>
            context load preceding {node.id}
          </button>
          <button type="button" onClick={() => onLoadChain?.(node, 'start')}>
            context load following {node.id}
          </button>
          <button type="button" onClick={() => onLoadChain?.(node, 'node')}>
            context load all {node.id}
          </button>
        </div>
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
        enable: vi.fn(() => {
          mockVault.status = 'setup'
          setStatus('setup')
        }),
        disable: vi.fn(() => {
          mockVault.status = 'disabled'
          setStatus('disabled')
        }),
        // 关闭态 codec 为 null：存储层据此以明文落盘，贴合真实行为。
        codec:
          status === 'disabled'
            ? null
            : {
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
    generateKeyPair: () => {
      const keyDigit = (mockKeyPairs.next++).toString(16).slice(-1)
      const privateKey = '0'.repeat(63) + keyDigit
      const publicKey = '02'.padEnd(66, keyDigit)
      mockKeyPairs.privateToPublic.set(privateKey, publicKey)

      return { privateKey, publicKey }
    },
    getPublicKeyFromPrivate: (privateKeyHex: string) =>
      mockKeyPairs.privateToPublic.get(privateKeyHex) ?? actual.getPublicKeyFromPrivate(privateKeyHex),
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
