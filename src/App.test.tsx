import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type {
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTORaw,
} from './lib/types'

vi.mock('./components/NetworkGraph', () => ({
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

// 用预解锁的保险库 + 可逆 base64 编解码器替身：让集成测试无需真实 Web Crypto/口令交互，
// 同时仍走「加密落盘 / 解密载入」的真实存储路径（密文 = base64(明文)）。
vi.mock('./hooks/useKeyVault', () => ({
  useKeyVault: () => ({
    status: 'unlocked' as const,
    error: null,
    setup: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    codec: {
      encrypt: (plaintext: string) => Promise.resolve({ iv: 'iv', ct: btoa(plaintext) }),
      decrypt: (secret: { ct: string }) => Promise.resolve(atob(secret.ct)),
    },
  }),
}))

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    generateKeyPair: () => ({
      privateKey: '0'.repeat(63) + '1',
      publicKey: '02'.padEnd(66, '1'),
    }),
    // 与上面固定夹具保持一致：占位私钥派生回占位公钥，让 App 的密钥对完整性校验通过；
    // 其余私钥走真实派生（不影响导入路径的真实性）。
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

describe('App initial state', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  beforeEach(() => {
    localStorage.clear()
  })

  function openQueryTab() {
    fireEvent.click(screen.getByRole('tab', { name: /^查询$/ }))
  }

  function openBrowseTab() {
    fireEvent.click(screen.getByRole('tab', { name: /^浏览$/ }))
  }

  function openKeysTab() {
    fireEvent.click(screen.getByRole('tab', { name: /^密钥$/ }))
  }

  it('starts without demo data or a demo reset action', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /demo/i })).toBeNull()
    expect((screen.getByLabelText('流转节点 ID / 公钥') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('运行查询以探索消费网络。')).toBeTruthy()
    expect(screen.getByLabelText('数据状态').textContent).toContain('暂无数据')
  })

  it('renders the main interface in Chinese', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: '跳转到图谱' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '网络浏览器' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '查询' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '浏览' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '密钥' })).toBeTruthy()
  })

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

  it('loads changed filters from the first page even when the page input is stale', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(
          sliceResponse([chainRow('chain-cny', 1)], {
            page: Number(url.searchParams.get('page')),
            hasNext: false,
          }),
        )
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.change(screen.getByLabelText('页码'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const request = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(request.searchParams.get('page')).toBe('0')
  })

  it('labels currency as a current-page filter and reports visible row counts', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(
          sliceResponse([chainRow('chain-cny', 1), chainRow('chain-au', 0)], {
            page: 0,
            hasNext: true,
          }),
        )
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.change(screen.getByLabelText(/币种/), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await screen.findByText(/当前页视图过滤/)
    expect(screen.getByText(/可见 1 行 \/ 后端 2 行/)).toBeTruthy()
  })

  it('does not allow pagination after an extended graph merge', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains' && url.searchParams.get('nodeId') === 'node-1') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)], { page: 0, hasNext: true }))
      }
      if (url.pathname === '/consume-chains' && url.searchParams.get('startId') === 'node-a') {
        return jsonResponse(
          sliceResponse([chainRow('chain-extra', 1, 'node-a', 'node-c')], {
            page: 0,
            hasNext: true,
          }),
        )
      }
      if (url.pathname.startsWith('/flow-node-registrations/')) {
        return jsonResponse(flowNodeDetail(url.pathname.split('/').pop() ?? 'node-a'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /select node node-a/i }))
    fireEvent.click(await screen.findByRole('button', { name: /扩展起点/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一页/ })).toBeDisabled()
    })
    expect(screen.getByText(/已扩展图谱视图/)).toBeTruthy()
  })

  it('queries by public key when a 66-hex value is entered', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)], { page: 0 }))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    const pubkey = `02${'a'.repeat(64)}`
    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), { target: { value: pubkey } })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const request = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(request.searchParams.get('nodePubkey')).toBe(pubkey)
    expect(request.searchParams.get('nodeId')).toBeNull()
  })

  it('lists looped chains and highlights one when selected from the loops panel', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(
          sliceResponse([chainRow('open-1', 1), loopedChainRow('loop-1')], { page: 0 }),
        )
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    expect(await screen.findByText('循环 (1)')).toBeTruthy()
    const loopRow = screen.getByRole('button', { name: /LOOP-1.*跳/ })
    expect(loopRow).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(loopRow)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /LOOP-1.*跳/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  it('shows onboarding guidance and disables export before any query', () => {
    render(<App />)

    expect(screen.getByText('探索消费网络')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^csv$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^json$/i })).toBeDisabled()
  })

  it('opens transaction evidence for a selected edge', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-1', 1)], { page: 0 }))
      }
      if (url.pathname === '/transaction-records/chain-1-record') {
        return jsonResponse(transactionRecord('chain-1-record'))
      }
      if (url.pathname === '/transaction-mounts/chain-1-mount') {
        return jsonResponse(transactionMount('chain-1-mount'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    fireEvent.click(await screen.findByRole('button', { name: /打开交易/ }))

    expect(await screen.findByText(/记录 txid/)).toBeTruthy()
    expect(screen.getByText('recordtxid')).toBeTruthy()
  })

  it('discovers a node via the browser and fills its public key', async () => {
    const pubkey = `02${'d'.repeat(64)}`
    stubFetchByUrl((url) => {
      if (url.pathname === '/flow-nodes') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            content: [
              {
                id: 'n1',
                flowNodePubkey: pubkey,
                registered: true,
                authorized: false,
                locked: false,
                currentCentralPubkeyAuthorized: false,
              },
            ],
            page: 0,
            size: 10,
            numberOfElements: 1,
            hasNext: false,
            hasPrevious: false,
          },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    openBrowseTab()
    fireEvent.click(screen.getByRole('button', { name: /浏览节点/ }))
    fireEvent.click(screen.getByRole('button', { name: /^浏览$/ }))

    const row = await screen.findByRole('button', { name: /02DDDDDDDD/i })
    fireEvent.click(row)

    expect((screen.getByLabelText('流转节点 ID / 公钥') as HTMLTextAreaElement).value).toBe(pubkey)
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

  it('creates a transaction record with consume + flow double-signing', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/metadata/difficulty') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            register: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
            transaction: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
          },
        })
      }
      if (url.pathname === '/transaction-records' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: 'tx-rec-1', txid: 'txid-rec' },
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

    // a consume node (record source) then a flow node (operator) — flow node ends up selected
    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^消费节点$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /创建交易记录/ }))

    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('记录中心公钥'), {
      target: { value: '02'.padEnd(66, '2') },
    })
    await waitFor(() => {
      expect((screen.getByLabelText('交易难度') as HTMLInputElement).value).toBe('1d00ffff')
    })
    fireEvent.click(screen.getByRole('button', { name: /^创建记录$/ }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.txRecords.v1') ?? '{"records":[]}') as {
        records: Array<{ id: string; amount: string }>
      }
      expect(saved.records[0]?.id).toBe('tx-rec-1')
      expect(saved.records[0]?.amount).toBe('5000')
    })
    const recordPost = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/transaction-records') &&
        (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(recordPost).toBeTruthy()
  })

  it('mounts a created record and views the resulting consume chain by pubkey', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/metadata/difficulty') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            register: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
            transaction: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
          },
        })
      }
      if (url.pathname === '/transaction-records' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: '11111111-1111-4111-8111-1111111111aa', txid: 'r' },
        })
      }
      if (url.pathname === '/transaction-mounts' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: '22222222-2222-4222-8222-2222222222bb', txid: 'm' },
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
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-x', 1)], { page: 0 }))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    openKeysTab()
    fireEvent.click(screen.getByRole('button', { name: /^消费节点$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^流转节点$/ }))

    // create a record first
    fireEvent.click(await screen.findByRole('button', { name: /创建交易记录/ }))
    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('记录中心公钥'), {
      target: { value: '02'.padEnd(66, '2') },
    })
    await waitFor(() => {
      expect((screen.getByLabelText('交易难度') as HTMLInputElement).value).toBe('1d00ffff')
    })
    fireEvent.click(screen.getByRole('button', { name: /^创建记录$/ }))
    await waitFor(() => {
      expect(localStorage.getItem('nmsci.txRecords.v1')).toContain(
        '11111111-1111-4111-8111-1111111111aa',
      )
    })

    // mount it
    fireEvent.click(screen.getByRole('button', { name: /挂载已有记录/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^提交挂载$/ }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, requestInit]) =>
            String(input).includes('/transaction-mounts') &&
            (requestInit as RequestInit | undefined)?.method === 'POST',
        ),
      ).toBe(true)
    })

    // view the resulting consume chain — queries by pubkey
    fireEvent.click(await screen.findByRole('button', { name: /查看消费链/ }))
    await waitFor(() => {
      const chainCall = fetchMock.mock.calls.find(([input]) =>
        String(input).includes('/consume-chains'),
      )
      expect(chainCall).toBeTruthy()
      expect(
        new URL(String(chainCall![0]), 'http://localhost').searchParams.get('nodePubkey'),
      ).toBe(pubkey)
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

function stubFetchByUrl(
  handler: (url: URL, init?: RequestInit) => Response,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(rawUrl, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.slice('/api'.length)
    }
    // App 挂载即拉取系统状态；统一给个默认（未冻结）响应。
    if (url.pathname === '/system/status') {
      return jsonResponse({
        code: 200,
        message: 'ok',
        data: {
          latestBlockHeight: 100,
          latestBlockHash: 'ab',
          latestBlockTimestamp: 1,
          pendingMessageCount: 0,
          oldestPendingConfirmTimestamp: null,
          blockIntervalMs: 600000,
          currentCentralPubkeyLocked: false,
        },
      })
    }
    // 选中节点/边会触发回流率查询；统一给个默认响应，免得每个用例都要处理。
    if (url.pathname === '/returning-flow-rates') {
      return jsonResponse({
        code: 200,
        message: 'ok',
        data: {
          returningFlowRate: 0,
          loopedAmount: 0,
          unloopedAmount: 0,
          targetTotalLoopedAmount: 0,
          targetTotalUnloopedAmount: 0,
          currencyType: 1,
        },
      })
    }
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

function sliceResponse(
  content: ConsumeChainResponseDTORaw[],
  overrides: Partial<{
    page: number
    size: number
    numberOfElements: number
    hasNext: boolean
    hasPrevious: boolean
  }> = {},
) {
  return {
    code: 200,
    message: 'ok',
    data: {
      content,
      page: overrides.page ?? 0,
      size: overrides.size ?? 50,
      numberOfElements: overrides.numberOfElements ?? content.length,
      hasNext: overrides.hasNext ?? false,
      hasPrevious: overrides.hasPrevious ?? false,
    },
  }
}

function chainRow(
  id: string,
  currencyType: number,
  start = 'node-a',
  end = 'node-b',
): ConsumeChainResponseDTORaw {
  return {
    consumeChain: {
      id,
      start,
      end,
      amount: 1200,
      currencyType,
      isLoop: false,
      tailMountTimestamp: 1_700_000_000_000_000,
    },
    consumeChainEdges: [
      {
        id: `${id}-edge`,
        source: start,
        target: end,
        amount: 1200,
        currencyType,
        chain: id,
        relatedTransactionRecord: `${id}-record`,
        relatedTransactionMount: `${id}-mount`,
        relatedTransactionMountTimestamp: 1_700_000_000_000_000,
        isLoop: false,
      },
    ],
  }
}

function loopedChainRow(id: string): ConsumeChainResponseDTORaw {
  const row = chainRow(id, 1, 'node-a', 'node-b')
  row.consumeChain.isLoop = true
  row.consumeChainEdges = row.consumeChainEdges.map((edge) => ({ ...edge, isLoop: true }))
  return row
}

function transactionRecord(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 2,
      amount: 5000,
      currencyType: 1,
      transactionDifficultyTarget: '1d00ffff',
      nonce: 1,
      consumeNodePubkey: '03'.padEnd(66, 'a'),
      flowNodePubkey: '02'.padEnd(66, 'b'),
      centralPubkey: '02'.padEnd(66, 'c'),
      consumeNodeSignature: 'aa',
      flowNodeSignature: 'bb',
      confirmTimestamp: 1_700_000_000_000_000,
      centralSignature: 'cc',
      rawBytes: '00',
      txid: 'recordtxid',
    },
  }
}

function transactionMount(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 3,
      mountedTransactionRecordId: 'chain-1-record',
      transactionDifficultyTarget: '1d00ffff',
      nonce: 1,
      consumeNodePubkey: '03'.padEnd(66, 'a'),
      flowNodePubkey: '02'.padEnd(66, 'b'),
      centralPubkey: '02'.padEnd(66, 'c'),
      consumeNodeSignature: 'aa',
      flowNodeSignature: 'bb',
      confirmTimestamp: 1_700_000_000_000_000,
      centralSignature: 'cc',
      rawBytes: '00',
      txid: 'mounttxid',
    },
  }
}

function flowNodeDetail(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 1,
      registerDifficultyTarget: '20ffffff',
      nonce: 7,
      flowNodePubkey: '02'.padEnd(66, '1'),
      flowNodeSignature: '1'.repeat(128),
      rawBytes: '00',
      txid: 'ab',
    },
  }
}
