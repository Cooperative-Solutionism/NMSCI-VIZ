import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  installAppTestLifecycle,
  jsonResponse,
  openKeysTab,
  openQueryTab,
  stubFetchByUrl,
} from './test/appTestHarness'
import App from './App'

describe('App initial state', () => {
  installAppTestLifecycle()

  it('adds a flow node from the keys toolbar and persists it', async () => {
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))

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
    // selecting the new node opens its operate panel in the inspector
    expect(await screen.findByRole('button', { name: /注册节点/ })).toBeTruthy()
  })

  it('fills the selected flow node public key into the query field', async () => {
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /查询此节点/ }))
    openQueryTab()

    expect((screen.getByLabelText('流转节点 ID / 公钥') as HTMLTextAreaElement).value).toBe(
      '02'.padEnd(66, '1'),
    )
  })

  it('loads a hex register difficulty target returned by the backend', async () => {
    const centralPubkey = '03dfb2c7716697bba0a12c21c431f86d4bfe3b536b2ec0b7f32e7f97bbcfb20cbe'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 200,
              message: 'ok',
              data: { height: 2518, registerDifficultyTarget: '20ffffff', centralPubkey },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            },
          ),
      ),
    )
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /使用最新难度/ }))

    await waitFor(() => {
      expect((screen.getByLabelText('注册难度目标') as HTMLInputElement).value).toBe('20ffffff')
    })
    expect((screen.getByLabelText('中心公钥') as HTMLTextAreaElement).value).toBe(centralPubkey)
    expect(screen.queryByText(/最新区块未包含 registerDifficultyTarget/)).toBeNull()
  })

  it('registers a flow node end to end and persists a sent registration', async () => {
    const pubkey = '02'.padEnd(66, '1')
    stubFetchByUrl((url, init) => {
      if (url.pathname === '/flow-node-registrations' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            id: 'reg-1',
            msgType: 0,
            registerDifficultyTarget: '1d00ffff',
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

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))
    fireEvent.change(await screen.findByLabelText('注册难度目标'), {
      target: { value: '1d00ffff' },
    })
    fireEvent.click(screen.getByRole('button', { name: /注册节点/ }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ registration?: { status: string; txid?: string } }>
      }
      expect(saved.nodes[0]?.registration?.status).toBe('sent')
      expect(saved.nodes[0]?.registration?.txid).toBe('regtxid')
    })
    await waitFor(() => {
      expect(screen.getAllByText(/已注册 021111/).length).toBeGreaterThan(0)
    })
  })

  it('renames and deletes a local flow node', async () => {
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))
    await screen.findByRole('button', { name: /注册节点/ })

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

    fireEvent.click(screen.getByRole('button', { name: /canvas add flow node/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ position?: { x: number; y: number } }>
      }
      expect(saved.nodes[0]?.position).toEqual({ x: 12, y: 34 })
    })

    fireEvent.click(screen.getByRole('button', { name: /canvas add consume node/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.consumeNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ position?: { x: number; y: number } }>
      }
      expect(saved.nodes[0]?.position).toEqual({ x: 56, y: 78 })
    })
  })

  it('imports a flow node from a pasted private key', async () => {
    const privateKey = '01'.padStart(64, '0')
    vi.stubGlobal(
      'prompt',
      vi.fn(() => privateKey),
    )
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /导入流转节点/ }))

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
