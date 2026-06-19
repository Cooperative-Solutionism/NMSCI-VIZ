import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { seedDashboardLayout } from './appDashboard'
import { resetMockVault } from './appMocks'

export function installAppTestLifecycle() {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  beforeEach(() => {
    localStorage.clear()
    resetMockVault()
    seedDashboardLayout()
  })
}

export function openBrowseTab() {
  openFlowNodesTab()
}

export function openBlocksTab() {
  openTab(/^\u533a\u5757$/)
}

export function openFlowNodesTab() {
  openTab(/^\u6d41\u8f6c\u8282\u70b9$/)
}

export function openKeysTab() {
  fireEvent.click(screen.getByRole('tab', { name: /^\u5bc6\u94a5$/ }))
}

function openTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name })
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })
  fireEvent.click(tab)
}
