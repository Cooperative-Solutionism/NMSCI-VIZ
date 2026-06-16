import type { CurrencyFilter } from '../../../../hooks/useConsumeChainQuery'
import type { VaultStatus } from '../../../../hooks/useKeyVault'
import type { LoopStatus, QueryMode } from '../../../../lib/types'

export type QueryPanelTab = 'query' | 'browse'

export interface QueryFormContentProps {
  apiBase: string
  currencyFilter: CurrencyFilter
  error: string | null
  extended: boolean
  loading: boolean
  loopStatus: LoopStatus
  mode: QueryMode
  nodeId: string
  onAddConsumeNode: () => void
  onAddFlowNode: () => void
  onApiBaseChange: (value: string) => void
  onImportLocalNode: () => void
  onLockVault: () => void
  onOpenVault: () => void
  onRunQuery: () => Promise<void>
  onSetCurrencyFilter: (filter: CurrencyFilter) => void
  onSetLoopStatus: (status: LoopStatus) => void
  onSetMode: (mode: QueryMode) => void
  onSetNodeId: (nodeId: string) => void
  requestUrl: string
  vaultStatus: VaultStatus
  warning: string | null
}
