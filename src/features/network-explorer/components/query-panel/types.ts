import type { CurrencyFilter } from '../../../../hooks/useConsumeChainQuery'
import type { VaultStatus } from '../../../../hooks/useKeyVault'
import type { LoopStatus, QueryMode } from '../../../../lib/types'

export type QueryPanelTab = 'query' | 'browse' | 'keys'

export interface QueryFormContentProps {
  apiBase: string
  currencyFilter: CurrencyFilter
  error: string | null
  extended: boolean
  loading: boolean
  loopStatus: LoopStatus
  mode: QueryMode
  nodeId: string
  onApiBaseChange: (value: string) => void
  onRunQuery: () => Promise<void>
  onSetCurrencyFilter: (filter: CurrencyFilter) => void
  onSetLoopStatus: (status: LoopStatus) => void
  onSetMode: (mode: QueryMode) => void
  onSetNodeId: (nodeId: string) => void
  requestUrl: string
  warning: string | null
}

export interface KeyringPanelContentProps {
  onAddConsumeNode: () => void
  onAddFlowNode: () => void
  onImportLocalNode: () => void
  onLockVault: () => void
  onSetupVault: (passphrase: string) => void
  onUnlockVault: (passphrase: string) => void
  registrationError: string | null
  showKeyringError: boolean
  vaultError: string | null
  vaultStatus: VaultStatus
}
