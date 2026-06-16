import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { KeyRound } from 'lucide-react'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import { PanelHeader } from './PanelHeader'
import { FlowNodeAuthorizationControls } from './flow-node-operate/FlowNodeAuthorizationControls'
import { FlowNodeKeyDetails } from './flow-node-operate/FlowNodeKeyDetails'
import { FlowNodeRegistrationControls } from './flow-node-operate/FlowNodeRegistrationControls'
import { FlowNodeTransactionControls } from './flow-node-operate/FlowNodeTransactionControls'
import { OperationFeedback } from './flow-node-operate/OperationFeedback'

export type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | 'record' | 'mount' | null

export function FlowNodeOperatePanel({
  busy,
  centralLocked,
  centralPubkey,
  error,
  lastRawBytes,
  miningAttempts,
  node,
  nodeState,
  onAuthorize,
  onCentralPubkeyChange,
  onCopy,
  onCreateMount,
  onCreateRecord,
  onDelete,
  onDifficultyChange,
  onExportPrivateKey,
  onFetchDifficulty,
  onQuery,
  onRegister,
  onRename,
  registerDifficultyTarget,
  status,
}: {
  busy: FlowNodeBusyState
  centralLocked: boolean
  centralPubkey: string
  error: string | null
  lastRawBytes: string
  miningAttempts: number | null
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onAuthorize: () => void
  onCentralPubkeyChange: (value: string) => void
  onCopy: (value: string, label: string) => void
  onCreateRecord?: () => void
  onCreateMount?: () => void
  onDelete: () => void
  onDifficultyChange: (value: string) => void
  onExportPrivateKey: () => void
  onFetchDifficulty: () => void
  onQuery: () => void
  onRegister: () => void
  onRename: () => void
  registerDifficultyTarget: string
  status: string | null
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<KeyRound size={16} />} title="流转节点" />
      <FlowNodeKeyDetails
        node={node}
        nodeState={nodeState}
        onCopy={onCopy}
        onDelete={onDelete}
        onExportPrivateKey={onExportPrivateKey}
        onQuery={onQuery}
        onRename={onRename}
      />
      <FlowNodeRegistrationControls
        busy={busy}
        centralLocked={centralLocked}
        miningAttempts={miningAttempts}
        onDifficultyChange={onDifficultyChange}
        onFetchDifficulty={onFetchDifficulty}
        onRegister={onRegister}
        registerDifficultyTarget={registerDifficultyTarget}
      />
      <FlowNodeAuthorizationControls
        busy={busy}
        centralLocked={centralLocked}
        centralPubkey={centralPubkey}
        onAuthorize={onAuthorize}
        onCentralPubkeyChange={onCentralPubkeyChange}
      />
      <FlowNodeTransactionControls onCreateMount={onCreateMount} onCreateRecord={onCreateRecord} />
      <OperationFeedback error={error} lastRawBytes={lastRawBytes} status={status} />
    </div>
  )
}
