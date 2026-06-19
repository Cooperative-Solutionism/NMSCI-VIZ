import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  installAppTestLifecycle,
  jsonResponse,
  openFlowNodesTab,
  requestInputUrl,
  setMockVaultStatus,
  stubFetchByUrl,
} from './test/appTestHarness'
import App from './App'

describe('App initial state', () => {
  installAppTestLifecycle()

  it('adds a flow node from the keys toolbar and persists it', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKey: { ct: string }; publicKeyHex: string }>
      }
      // 私钥以密文落盘（明文不出现在 raw），pubkey 明文；密文用替身编解码器可解回原私钥。
      expect(raw).not.toContain('0'.repeat(63) + '1')
      expect(saved.nodes[0]?.publicKeyHex).toBe('02'.padEnd(66, '1'))
      expect(atob(saved.nodes[0]!.privateKey.ct)).toBe('0'.repeat(63) + '1')
    })
    // selecting the new node opens its key-details panel in the inspector
    expect(await screen.findByRole('button', { name: /导出私钥/ })).toBeTruthy()
  })

  it('does not expose the removed consume-chain query shortcut for local flow nodes', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    expect(screen.queryByRole('button', { name: /浏览此节点/ })).toBeNull()
    expect(screen.queryByLabelText('流转节点 ID / 公钥')).toBeNull()
  })

  it('registers a flow node from the context menu, auto-fetching the latest difficulty', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const centralPubkey = '03dfb2c7716697bba0a12c21c431f86d4bfe3b536b2ec0b7f32e7f97bbcfb20cbe'
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/blocks/latest') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { height: 2518, registerDifficultyTarget: '20ffffff', centralPubkey },
        })
      }
      if (url.pathname === '/flow-node-registrations' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            id: 'reg-1',
            msgType: 0,
            registerDifficultyTarget: '20ffffff',
            nonce: 42,
            flowNodePubkey: pubkey,
            flowNodeSignature: '00',
            rawBytes: '00',
            txid: 'regtxid',
          },
        })
      }
      if (url.pathname === `/flow-nodes/${pubkey}`) {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            registered: true,
            authorized: false,
            locked: false,
            currentCentralPubkeyAuthorized: false,
          },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /context register/ }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{
          registration?: { status: string; txid?: string; registerDifficultyTarget?: string }
        }>
      }
      expect(saved.nodes[0]?.registration?.status).toBe('sent')
      expect(saved.nodes[0]?.registration?.txid).toBe('regtxid')
      // 难度目标取自最新区块，无需手动填写。
      expect(saved.nodes[0]?.registration?.registerDifficultyTarget).toBe('20ffffff')
    })
    // 注册前自动拉取了最新区块。
    expect(
      fetchMock.mock.calls.some(([input]) => requestInputUrl(input).includes('/blocks/latest')),
    ).toBe(true)
  })

  it('renames and deletes a local flow node', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await screen.findByRole('button', { name: /导出私钥/ })

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Renamed node'),
    )
    fireEvent.click(screen.getByRole('button', { name: /^重命名$/ }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ label: string }>
      }
      expect(saved.nodes[0]?.label).toBe('Renamed node')
    })

    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    fireEvent.click(screen.getByRole('button', { name: /^删除$/ }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: unknown[]
      }
      expect(saved.nodes).toHaveLength(0)
    })
  })

  it('adds flow and consume nodes to the canvas via the context menu actions', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ position?: { x: number; y: number } }>
      }
      expect(saved.nodes[0]?.position).toEqual({ x: 12, y: 34 })
    })

    fireEvent.click(await screen.findByRole('button', { name: /canvas add consume node/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.consumeNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ position?: { x: number; y: number } }>
      }
      expect(saved.nodes[0]?.position).toEqual({ x: 56, y: 78 })
    })
  })

  it('opens the vault dialog from a locked encrypted action and then resumes it', async () => {
    setMockVaultStatus('locked')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    expect(await screen.findByRole('dialog', { name: /解锁密钥保险库/ })).toBeTruthy()
    expect(localStorage.getItem('nmsci.flowNodes.v1')).toBeNull()

    fireEvent.change(screen.getByLabelText('保险库口令'), {
      target: { value: 'session-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^解锁$/ }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ publicKeyHex: string }>
      }
      expect(saved.nodes[0]?.publicKeyHex).toBe('02'.padEnd(66, '1'))
    })
    expect(screen.queryByRole('dialog', { name: /解锁密钥保险库/ })).toBeNull()
  })

  it('imports a flow node from a pasted private key', async () => {
    const privateKey = '01'.padStart(64, '0')
    vi.stubGlobal(
      'prompt',
      vi.fn(() => privateKey),
    )
    render(<App />)

    openFlowNodesTab()
    fireEvent.click(await screen.findByRole('button', { name: /导入流转节点/ }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKey: { ct: string }; publicKeyHex: string }>
      }
      // 导入的私钥同样以密文落盘（明文不出现在 raw），密文可解回原私钥。
      expect(raw).not.toContain(privateKey)
      expect(atob(saved.nodes[0]!.privateKey.ct)).toBe(privateKey)
      expect(saved.nodes[0]?.publicKeyHex.length).toBe(66)
    })
  })
})
