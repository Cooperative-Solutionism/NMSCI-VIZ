import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { seedDashboardLayout } from './appDashboard'

export function installAppTestLifecycle() {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  beforeEach(() => {
    localStorage.clear()
    seedDashboardLayout()
  })
}

export function openQueryTab() {
  fireEvent.click(screen.getByRole('tab', { name: /^\u67e5\u8be2$/ }))
}

export function openBrowseTab() {
  fireEvent.click(screen.getByRole('tab', { name: /^\u6d4f\u89c8$/ }))
}

export function openKeysTab() {
  fireEvent.click(screen.getByRole('tab', { name: /^\u5bc6\u94a5$/ }))
}
