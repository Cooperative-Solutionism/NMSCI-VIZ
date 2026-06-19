import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVaultActionGate } from './useVaultActionGate'

describe('useVaultActionGate', () => {
  it('runs immediately and opens no dialog when disabled and ready', () => {
    const run = vi.fn()
    const { result } = renderHook(() => useVaultActionGate('disabled', { ready: true }))

    act(() => result.current.requestVault('添加流转节点', run))

    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.vaultPromptOpen).toBe(false)
  })

  it('disabled-but-not-ready: defers the action, replays it once ready, never opens a dialog', () => {
    const run = vi.fn()
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useVaultActionGate('disabled', { ready }),
      { initialProps: { ready: false } },
    )

    // 加载未完成：动作排队、不执行、不弹窗（关闭态私钥已是明文，无需口令）。
    act(() => result.current.requestVault('添加流转节点', run))
    expect(run).not.toHaveBeenCalled()
    expect(result.current.vaultPromptOpen).toBe(false)

    // keyringReady 翻转后正好重放一次，仍不弹窗。
    rerender({ ready: true })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.vaultPromptOpen).toBe(false)
  })

  it('locked: queues the action and opens the unlock prompt, then replays on unlock', () => {
    const run = vi.fn()
    const { result, rerender } = renderHook(
      ({ status }: { status: 'locked' | 'unlocked' }) =>
        useVaultActionGate(status, { ready: status === 'unlocked' }),
      { initialProps: { status: 'locked' as 'locked' | 'unlocked' } },
    )

    act(() => result.current.requestVault('添加流转节点', run))
    expect(run).not.toHaveBeenCalled()
    expect(result.current.vaultPromptOpen).toBe(true)

    rerender({ status: 'unlocked' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.vaultPromptOpen).toBe(false)
  })

  it('closeVaultPrompt drops queued actions without running them', () => {
    const run = vi.fn()
    const { result, rerender } = renderHook(
      ({ status }: { status: 'locked' | 'unlocked' }) =>
        useVaultActionGate(status, { ready: status === 'unlocked' }),
      { initialProps: { status: 'locked' as 'locked' | 'unlocked' } },
    )

    act(() => result.current.requestVault('添加流转节点', run))
    act(() => result.current.closeVaultPrompt())
    expect(result.current.vaultPromptOpen).toBe(false)

    // 已清空待办：解锁后不应再重放。
    rerender({ status: 'unlocked' })
    expect(run).not.toHaveBeenCalled()
  })
})
