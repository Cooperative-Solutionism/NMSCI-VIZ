import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  installAppTestLifecycle,
  jsonResponse,
  sliceResponse,
  stubFetchByUrl,
} from './test/appTestHarness'
import type { ConsumeChainResponseDTORaw } from './lib/types'
import App from './App'

const localPubkey = '02'.padEnd(66, '1') // 本地流转节点的 pubkey（mock generateKeyPair 固定值）
const nodeA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const nodeB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function chain(
  id: string,
  start: string,
  end: string,
): ConsumeChainResponseDTORaw {
  return {
    consumeChain: {
      id,
      start,
      end,
      amount: 1000,
      currencyType: 1,
      isLoop: false,
      tailMountTimestamp: 1,
    },
    consumeChainEdges: [
      {
        id: `${id}-edge`,
        source: start,
        target: end,
        amount: 1000,
        currencyType: 1,
        chain: id,
        relatedTransactionRecord: 'r',
        relatedTransactionMount: 'm',
        relatedTransactionMountTimestamp: 1,
        isLoop: false,
      },
    ],
  }
}

describe('App consume-chain loading from the canvas', () => {
  installAppTestLifecycle()

  it('loads a following chain onto a local node and unifies it (no duplicate node)', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains' && url.searchParams.get('startPubkey') === localPubkey) {
        return jsonResponse(sliceResponse([chain('chain-1', localPubkey, nodeA)]))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    // 关闭态添加本地流转节点（落点 → 直接上画布）。
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await screen.findByRole('button', { name: `context register ${localPubkey}` })

    // 右键该节点 → 加载后消费链（节点为头，mode 'start'）。
    fireEvent.click(screen.getByRole('button', { name: `context load following ${localPubkey}` }))

    // 链已加载：尾节点出现在画布上。
    await screen.findByRole('button', { name: `Select node ${nodeA}` })

    // 统一身份：本地节点没有被另画一套——它仍是本地流转节点（仍带注册入口），且只出现一次。
    expect(screen.getByRole('button', { name: `context register ${localPubkey}` })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: `Select node ${localPubkey}` })).toHaveLength(1)
    // 链上的非本地节点只提供加载、不提供本地操作。
    expect(screen.queryByRole('button', { name: `context register ${nodeA}` })).toBeNull()
    expect(screen.getByRole('button', { name: `context load all ${nodeA}` })).toBeTruthy()
  })

  it('keeps previously loaded chains when loading from another node (cumulative extend)', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        if (url.searchParams.get('startPubkey') === localPubkey) {
          return jsonResponse(sliceResponse([chain('chain-1', localPubkey, nodeA)]))
        }
        if (url.searchParams.get('nodeId') === nodeA) {
          return jsonResponse(sliceResponse([chain('chain-2', nodeA, nodeB)]))
        }
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    await screen.findByRole('button', { name: `context register ${localPubkey}` })

    fireEvent.click(screen.getByRole('button', { name: `context load following ${localPubkey}` }))
    await screen.findByRole('button', { name: `Select node ${nodeA}` })

    // 从尾节点 A 加载全部消费链（mode 'node'）。
    fireEvent.click(screen.getByRole('button', { name: `context load all ${nodeA}` }))
    await screen.findByRole('button', { name: `Select node ${nodeB}` })

    // 累积：第一条链的节点仍在，新链节点也在（旧链未被覆盖）。
    await waitFor(() => {
      expect(screen.getByRole('button', { name: `Select node ${nodeA}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Select node ${nodeB}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `context register ${localPubkey}` })).toBeTruthy()
    })
  })

  it('keeps a panel-created local node off the canvas until it is explicitly added', async () => {
    render(<App />)

    // 通过面板“新建流转节点”创建（无落点）→ 不自动绘制到画布。
    const localPanel = screen.getByRole('dialog', { name: '本地节点' })
    fireEvent.click(within(localPanel).getByRole('button', { name: '新建流转节点' }))

    // 节点出现在本地节点表格，但不在画布图谱上。
    await within(localPanel).findByRole('button', { name: '添加到画布' })
    expect(screen.queryByRole('button', { name: `Select node ${localPubkey}` })).toBeNull()

    // 点击“添加到画布” → 节点绘制到画布。
    fireEvent.click(within(localPanel).getByRole('button', { name: '添加到画布' }))
    expect(await screen.findByRole('button', { name: `Select node ${localPubkey}` })).toBeTruthy()
  })
})
