import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SystemPanelContent } from './SystemPanelContent'

function status(overrides: Partial<SystemStatusDTORaw> = {}): SystemStatusDTORaw {
  return {
    latestBlockHeight: 12345,
    latestBlockHash: 'abcdef0123456789'.padEnd(64, '0'),
    latestBlockTimestamp: 1700000000123456,
    pendingMessageCount: 1000,
    oldestPendingConfirmTimestamp: null,
    blockIntervalMs: 600000,
    currentCentralPubkeyLocked: false,
    ...overrides,
  }
}

function rowValue(label: string): string {
  const row = screen.getByText(label).closest('.detail-row')
  return row?.querySelector('strong')?.textContent ?? ''
}

afterEach(cleanup)

describe('SystemPanelContent', () => {
  it('renders the enriched detail rows with formatted values', () => {
    render(<SystemPanelContent status={status()} />)

    expect(rowValue('最新高度')).toBe('12,345')
    expect(rowValue('最新区块')).toContain('ABCDEF0123')
    expect(rowValue('出块时间')).toBe('2023-11-14 22:13:20 UTC')
    expect(rowValue('出块间隔')).toBe('10 分钟')
    expect(rowValue('待处理消息')).toBe('1,000 条')
    expect(rowValue('最早待确认')).toBe('-')
    expect(rowValue('中心公钥')).toBe('正常')
  })

  it('flags a frozen central public key', () => {
    render(<SystemPanelContent status={status({ currentCentralPubkeyLocked: true })} />)

    expect(rowValue('中心公钥')).toBe('已冻结')
  })

  it('shows zero height as 0 and a missing height as a placeholder', () => {
    const { rerender } = render(<SystemPanelContent status={status({ latestBlockHeight: 0 })} />)
    expect(rowValue('最新高度')).toBe('0')

    rerender(<SystemPanelContent status={status({ latestBlockHeight: null })} />)
    expect(rowValue('最新高度')).toBe('-')
  })

  it('formats non-integer minute intervals in seconds and rejects non-positive intervals', () => {
    const { rerender } = render(<SystemPanelContent status={status({ blockIntervalMs: 90000 })} />)
    expect(rowValue('出块间隔')).toBe('90 秒')

    rerender(<SystemPanelContent status={status({ blockIntervalMs: 0 })} />)
    expect(rowValue('出块间隔')).toBe('-')
  })

  it('invokes onRefresh from the refresh button when provided', () => {
    const onRefresh = vi.fn()
    render(<SystemPanelContent status={status()} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByRole('button', { name: '刷新' }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('omits the refresh button when no handler is provided', () => {
    render(<SystemPanelContent status={status()} />)

    expect(screen.queryByRole('button', { name: '刷新' })).toBeNull()
  })

  it('renders an error alert and suppresses the loading placeholder', () => {
    render(<SystemPanelContent status={null} error="连接失败" />)

    expect(screen.getByText('系统状态加载失败')).toBeTruthy()
    expect(screen.getByText('连接失败')).toBeTruthy()
    expect(screen.queryByText('正在加载系统状态…')).toBeNull()
  })

  it('shows a loading placeholder before any status arrives', () => {
    render(<SystemPanelContent status={null} />)

    expect(screen.getByText('正在加载系统状态…')).toBeTruthy()
  })
})
