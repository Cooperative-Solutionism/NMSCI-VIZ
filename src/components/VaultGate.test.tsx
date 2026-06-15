import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VaultGate } from './VaultGate'

afterEach(cleanup)

describe('VaultGate', () => {
  it('setup state: creates a vault with the entered passphrase', () => {
    const onSetup = vi.fn()
    render(<VaultGate status="setup" error={null} onSetup={onSetup} onUnlock={vi.fn()} onLock={vi.fn()} />)

    expect(screen.getByText(/protect your private keys/i)).toBeTruthy()
    const input = screen.getByLabelText('New vault passphrase')
    const button = screen.getByRole('button', { name: /create vault/i })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: 'super-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /create vault/i }))
    expect(onSetup).toHaveBeenCalledWith('super-secret')
  })

  it('locked state: unlocks on Enter key', () => {
    const onUnlock = vi.fn()
    render(<VaultGate status="locked" error={null} onSetup={vi.fn()} onUnlock={onUnlock} onLock={vi.fn()} />)

    expect(screen.getByText(/unlock your key vault/i)).toBeTruthy()
    const input = screen.getByLabelText('Vault passphrase')
    fireEvent.change(input, { target: { value: 'open-sesame' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onUnlock).toHaveBeenCalledWith('open-sesame')
  })

  it('locked state: surfaces an error message', () => {
    render(
      <VaultGate
        status="locked"
        error="Incorrect passphrase."
        onSetup={vi.fn()}
        onUnlock={vi.fn()}
        onLock={vi.fn()}
      />,
    )
    expect(screen.getByText('Incorrect passphrase.')).toBeTruthy()
  })

  it('unlocked state: shows status and locks on click', () => {
    const onLock = vi.fn()
    render(<VaultGate status="unlocked" error={null} onSetup={vi.fn()} onUnlock={vi.fn()} onLock={onLock} />)

    expect(screen.getByText(/key vault unlocked/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^lock$/i }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})
