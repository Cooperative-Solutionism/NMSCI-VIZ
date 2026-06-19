import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('adds a flow node from the canvas and persists it as plaintext by default (vault off)', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKeyHex?: string; privateKey?: unknown; publicKeyHex: string }>
      }
      // 默认保险库关闭：私钥以明文 privateKeyHex 落盘，没有密文字段，pubkey 明文。
      expect(saved.nodes[0]?.publicKeyHex).toBe('02'.padEnd(66, '1'))
      expect(saved.nodes[0]?.privateKeyHex).toBe('0'.repeat(63) + '1')
      expect(saved.nodes[0]?.privateKey).toBeUndefined()
    })
    // selecting the new node opens its key-details panel in the inspector
    expect(await screen.findByRole('button', { name: /导出私钥/ })).toBeTruthy()
  })

  it('encrypts existing plaintext nodes when the vault is enabled', async () => {
    render(<App />)

    // 关闭态下添加一个明文节点。
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKeyHex?: string }>
      }
      expect(saved.nodes[0]?.privateKeyHex).toBe('0'.repeat(63) + '1')
    })

    // 启用保险库并创建口令：现存明文私钥应迁移为密文。
    fireEvent.click(screen.getByRole('button', { name: /启用密钥保险库/ }))
    fireEvent.change(await screen.findByLabelText('新保险库口令'), {
      target: { value: 'session-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /创建保险库/ }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKey?: { ct: string }; privateKeyHex?: string }>
      }
      // 明文私钥不再落盘，密文可解回原私钥。
      expect(raw).not.toContain('0'.repeat(63) + '1')
      expect(saved.nodes[0]?.privateKeyHex).toBeUndefined()
      expect(atob(saved.nodes[0]!.privateKey!.ct)).toBe('0'.repeat(63) + '1')
    })
  })

  it('returns encrypted keys to plaintext when the vault is disabled again', async () => {
    render(<App />)

    // 关闭态添加节点 → 启用并加密。
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /启用密钥保险库/ }))
    fireEvent.change(await screen.findByLabelText('新保险库口令'), {
      target: { value: 'session-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /创建保险库/ }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKey?: { ct: string } }>
      }
      expect(saved.nodes[0]?.privateKey?.ct).toBeTruthy()
    })

    // 关闭保险库：内存中的私钥应以明文重新落盘，且不丢失。
    fireEvent.click(await screen.findByRole('button', { name: /关闭保险库/ }))
    const confirmDialog = await screen.findByRole('alertdialog', { name: /关闭密钥保险库/ })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: '关闭保险库' }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKey?: unknown; privateKeyHex?: string }>
      }
      expect(saved.nodes[0]?.privateKeyHex).toBe('0'.repeat(63) + '1')
      expect(saved.nodes[0]?.privateKey).toBeUndefined()
    })
    // 关闭后重新出现“启用密钥保险库”入口。
    expect(await screen.findByRole('button', { name: /启用密钥保险库/ })).toBeTruthy()
  })

  it('does not disable the vault when the confirmation is declined', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /启用密钥保险库/ }))
    fireEvent.change(await screen.findByLabelText('新保险库口令'), {
      target: { value: 'session-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /创建保险库/ }))
    await screen.findByRole('button', { name: /关闭保险库/ })

    fireEvent.click(screen.getByRole('button', { name: /关闭保险库/ }))
    const confirmDialog = await screen.findByRole('alertdialog', { name: /关闭密钥保险库/ })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: '取消' }))

    // 取消确认：仍处于已解锁加密态，未回退到关闭。
    expect(screen.getByRole('button', { name: /关闭保险库/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /启用密钥保险库/ })).toBeNull()
    const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
      nodes: Array<{ privateKey?: { ct: string } }>
    }
    expect(saved.nodes[0]?.privateKey?.ct).toBeTruthy()
  })

  it('abandons enabling when the setup dialog is closed without creating a passphrase', async () => {
    render(<App />)

    // 关闭态添加一个明文节点，再打开“启用”流程进入 setup。
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /启用密钥保险库/ }))
    const dialog = await screen.findByRole('dialog', { name: /创建密钥保险库/ })
    expect(await screen.findByLabelText('新保险库口令')).toBeTruthy()

    // 不创建口令直接关闭弹窗 → 放弃启用，回退到关闭态。
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByLabelText('新保险库口令')).toBeNull()
    })
    // 回到“启用密钥保险库”入口，且私钥仍是明文、未被加密。
    expect(await screen.findByRole('button', { name: /启用密钥保险库/ })).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
      nodes: Array<{ privateKey?: unknown; privateKeyHex?: string }>
    }
    expect(saved.nodes[0]?.privateKeyHex).toBe('0'.repeat(63) + '1')
    expect(saved.nodes[0]?.privateKey).toBeUndefined()

    // 未卡在 setup：仍可继续添加节点（明文）。
    fireEvent.click(screen.getByRole('button', { name: /canvas add flow node/i }))
    await waitFor(() => {
      const after = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: unknown[]
      }
      expect(after.nodes).toHaveLength(2)
    })
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

  it('authorizes a flow node from the context menu, auto-fetching the central pubkey', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const centralPubkey = '03dfb2c7716697bba0a12c21c431f86d4bfe3b536b2ec0b7f32e7f97bbcfb20cbe'
    stubFetchByUrl((url, init) => {
      if (url.pathname === '/blocks/latest') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { height: 2518, registerDifficultyTarget: '20ffffff', centralPubkey },
        })
      }
      if (url.pathname === '/central-pubkey-empowerments' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: 'empower-1', txid: 'emptxid' },
        })
      }
      if (url.pathname === `/flow-nodes/${pubkey}`) {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            registered: true,
            authorized: true,
            locked: false,
            currentCentralPubkeyAuthorized: true,
          },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /context authorize/ }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ authorizations?: Array<{ status: string; centralPubkeyHex: string }> }>
      }
      expect(saved.nodes[0]?.authorizations?.[0]?.status).toBe('sent')
      expect(saved.nodes[0]?.authorizations?.[0]?.centralPubkeyHex).toBe(centralPubkey)
    })
  })

  it('renames and deletes a local flow node', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await screen.findByRole('button', { name: /导出私钥/ })

    fireEvent.click(screen.getByRole('button', { name: /^重命名$/ }))
    const renameDialog = await screen.findByRole('dialog', { name: /重命名流转节点/ })
    fireEvent.change(within(renameDialog).getByLabelText('节点名称'), {
      target: { value: 'Renamed node' },
    })
    fireEvent.click(within(renameDialog).getByRole('button', { name: '保存' }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.flowNodes.v1') ?? '{"nodes":[]}') as {
        nodes: Array<{ label: string }>
      }
      expect(saved.nodes[0]?.label).toBe('Renamed node')
    })

    fireEvent.click(screen.getByRole('button', { name: /^删除$/ }))
    const deleteDialog = await screen.findByRole('alertdialog', { name: /删除本地流转节点/ })
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '删除' }))
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
    render(<App />)

    openFlowNodesTab()
    fireEvent.click(await screen.findByRole('button', { name: /导入流转节点/ }))
    const importDialog = await screen.findByRole('dialog', { name: /导入流转节点/ })
    fireEvent.change(within(importDialog).getByLabelText('私钥（hex）'), {
      target: { value: privateKey },
    })
    fireEvent.click(within(importDialog).getByRole('button', { name: '导入' }))

    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
        nodes: Array<{ privateKeyHex?: string; privateKey?: unknown; publicKeyHex: string }>
      }
      // 默认保险库关闭：导入的私钥以明文 privateKeyHex 落盘，无密文字段。
      expect(saved.nodes[0]?.privateKeyHex).toBe(privateKey)
      expect(saved.nodes[0]?.privateKey).toBeUndefined()
      expect(saved.nodes[0]?.publicKeyHex.length).toBe(66)
    })
  })
})
