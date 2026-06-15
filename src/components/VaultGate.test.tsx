import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VaultGate } from './VaultGate'

afterEach(cleanup)

describe('VaultGate', () => {
  it('setup state: creates a vault with the entered passphrase', () => {
    const onSetup = vi.fn()
    render(
      <VaultGate
        status="setup"
        error={null}
        onSetup={onSetup}
        onUnlock={vi.fn()}
        onLock={vi.fn()}
      />,
    )

    expect(screen.getByText(/保护你的私钥/)).toBeTruthy()
    const input = screen.getByLabelText('新保险库口令')
    const button = screen.getByRole('button', { name: /创建保险库/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'super-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /创建保险库/ }))
    expect(onSetup).toHaveBeenCalledWith('super-secret')
  })

  it('locked state: unlocks on Enter key', () => {
    const onUnlock = vi.fn()
    render(
      <VaultGate
        status="locked"
        error={null}
        onSetup={vi.fn()}
        onUnlock={onUnlock}
        onLock={vi.fn()}
      />,
    )

    expect(screen.getByText(/解锁密钥保险库/)).toBeTruthy()
    const input = screen.getByLabelText('保险库口令')
    fireEvent.change(input, { target: { value: 'open-sesame' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onUnlock).toHaveBeenCalledWith('open-sesame')
  })

  it('locked state: surfaces an error message', () => {
    render(
      <VaultGate
        status="locked"
        error="口令不正确。"
        onSetup={vi.fn()}
        onUnlock={vi.fn()}
        onLock={vi.fn()}
      />,
    )
    expect(screen.getByText('口令不正确。')).toBeTruthy()
  })

  it('unlocked state: shows status and locks on click', () => {
    const onLock = vi.fn()
    render(
      <VaultGate
        status="unlocked"
        error={null}
        onSetup={vi.fn()}
        onUnlock={vi.fn()}
        onLock={onLock}
      />,
    )

    expect(screen.getByText(/密钥保险库已解锁/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^锁定$/ }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})
