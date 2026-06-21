import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OperationStatusToast } from './OperationStatusToast'

afterEach(cleanup)

describe('OperationStatusToast', () => {
  it('renders nothing when idle', () => {
    const { container } = render(
      <OperationStatusToast busy={null} status={null} error={null} miningAttempts={null} />,
    )
    expect(container.querySelector('.operation-status-toast')).toBeNull()
  })

  it('shows register mining progress while busy', () => {
    render(
      <OperationStatusToast busy="register" status={null} error={null} miningAttempts={1234} />,
    )
    const toast = screen.getByText(/注册中 · 挖矿 1,234…/)
    expect(toast.closest('.operation-status-toast')).toHaveAttribute('data-tone', 'busy')
  })

  it('shows a success status when idle with a message', () => {
    render(
      <OperationStatusToast
        busy={null}
        status="已注册 ABC123。"
        error={null}
        miningAttempts={null}
      />,
    )
    expect(screen.getByText('已注册 ABC123。').closest('.operation-status-toast')).toHaveAttribute(
      'data-tone',
      'ok',
    )
  })

  it('prefers the error tone and message over status', () => {
    render(
      <OperationStatusToast
        busy={null}
        status="已注册 ABC123。"
        error="注册失败：网络错误"
        miningAttempts={null}
      />,
    )
    const toast = screen.getByText('注册失败：网络错误').closest('.operation-status-toast')
    expect(toast).toHaveAttribute('data-tone', 'error')
    expect(screen.queryByText('已注册 ABC123。')).toBeNull()
  })
})
