import {
  ConsumeNodeOperatePanel,
  EdgeInspector,
  ErrorBoundary,
  FlowNodeOperatePanel,
  NodeInspector,
  TransactionMountForm,
  TransactionRecordForm,
} from '../../../components'
import { formatAmount, shortId } from '../../../lib/chainGraph'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { LocalTxRecord } from '../../../lib/txRecordStorage'
import type {
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTO,
  QueryMode,
} from '../../../lib/types'
import type { FlowRateView } from '../../../components/NodeInspector'
import type { RegistrationController } from '../../keyring/hooks/useRegistrationController'
import type { useNodeDetail } from '../../../hooks/useNodeDetail'

type NodeDetail = ReturnType<typeof useNodeDetail>

export function InspectorPanel({
  apiBase,
  centralLocked,
  effectiveSelection,
  extendFromNode,
  extendLoading,
  flowRateView,
  inspectorEmptyMessage,
  loading,
  localConsumeNodes,
  localNodeState,
  localTxRecords,
  nodeDetail,
  nodeActions,
  registration,
  selectedChain,
  selectedEdge,
  selectedLocalConsumeNode,
  selectedLocalNode,
  selectedNode,
}: {
  apiBase: string
  centralLocked: boolean
  effectiveSelection: { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null
  extendFromNode: (node: ChainGraphNode, mode: QueryMode) => Promise<void>
  extendLoading: QueryMode | null
  flowRateView: FlowRateView
  inspectorEmptyMessage: string
  loading: boolean
  localConsumeNodes: LocalConsumeNode[]
  localNodeState: NodeDetail['nodeState']
  localTxRecords: LocalTxRecord[]
  nodeDetail: NodeDetail
  nodeActions: {
    handleCopyText: (value: string, label: string) => Promise<void>
    handleDeleteConsumeNode: () => void
    handleDeleteLocalNode: () => void
    handleExportConsumeKey: () => Promise<void>
    handleExportPrivateKey: () => Promise<void>
    handleQuerySelectedFlowNode: () => void
    handleRenameConsumeNode: () => void
    handleRenameLocalNode: () => void
  }
  registration: RegistrationController
  selectedChain: ConsumeChainResponseDTO | null
  selectedEdge: ChainGraphEdge | null
  selectedLocalConsumeNode: LocalConsumeNode | null
  selectedLocalNode: LocalFlowNode | null
  selectedNode: ChainGraphNode | null
}) {
  return (
    <div className="inspector-panel-content" aria-label="选择详情">
      <div className="inspector-heading">
        <h2>
          {selectedLocalNode
            ? '流转节点'
            : selectedLocalConsumeNode
              ? '消费节点'
              : effectiveSelection?.kind === 'node'
                ? '已选节点'
                : effectiveSelection?.kind === 'edge'
                  ? '已选边'
                  : '选择详情'}
        </h2>
      </div>

      <ErrorBoundary label="详情面板加载失败">
        {selectedLocalNode ? (
          <>
            <FlowNodeOperatePanel
              busy={registration.busy}
              centralLocked={centralLocked}
              centralPubkey={registration.centralPubkey}
              error={registration.error}
              lastRawBytes={registration.lastRawBytes}
              miningAttempts={registration.miningAttempts}
              node={selectedLocalNode}
              nodeState={localNodeState}
              onAuthorize={() => void registration.authorizeCentralPubkey()}
              onCentralPubkeyChange={registration.setCentralPubkey}
              onCopy={(value, label) => void nodeActions.handleCopyText(value, label)}
              onCreateMount={registration.toggleMountForm}
              onCreateRecord={registration.toggleRecordForm}
              onDelete={nodeActions.handleDeleteLocalNode}
              onDifficultyChange={registration.setRegisterDifficultyTarget}
              onExportPrivateKey={() => void nodeActions.handleExportPrivateKey()}
              onFetchDifficulty={() => void registration.fetchRegisterDifficulty()}
              onQuery={nodeActions.handleQuerySelectedFlowNode}
              onRegister={() => void registration.registerFlowNode()}
              onRename={nodeActions.handleRenameLocalNode}
              registerDifficultyTarget={registration.registerDifficultyTarget}
              status={registration.status}
            />
            {registration.recordFormOpen ? (
              <TransactionRecordForm
                busy={registration.busy === 'record'}
                consumeNodes={localConsumeNodes}
                defaultCentralPubkey={registration.centralPubkey}
                defaultDifficulty={registration.txDifficulty}
                error={registration.error}
                miningAttempts={registration.miningAttempts}
                onCreate={(draft) => void registration.createTransactionRecord(draft)}
                status={registration.status}
              />
            ) : null}
            {registration.recordFormOpen && localTxRecords.length > 0 ? (
              <div className="record-list">
                <div className="section-title">已创建记录</div>
                {localTxRecords.map((record) => (
                  <div key={record.id} className="detail-row">
                    <span translate="no">{shortId(record.id)}</span>
                    <strong>{formatAmount(BigInt(record.amount), record.currencyType)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            {registration.mountFormOpen ? (
              <TransactionMountForm
                busy={registration.busy === 'mount'}
                canViewChain={registration.mountedPubkey !== null}
                defaultDifficulty={registration.txDifficulty}
                error={registration.error}
                miningAttempts={registration.miningAttempts}
                onMount={(recordId, difficultyHex) =>
                  void registration.createTransactionMount(recordId, difficultyHex)
                }
                onViewChain={registration.viewConsumeChain}
                records={localTxRecords}
                status={registration.status}
              />
            ) : null}
          </>
        ) : selectedLocalConsumeNode ? (
          <ConsumeNodeOperatePanel
            error={registration.error}
            node={selectedLocalConsumeNode}
            onCopy={(value, label) => void nodeActions.handleCopyText(value, label)}
            onDelete={nodeActions.handleDeleteConsumeNode}
            onExportPrivateKey={() => void nodeActions.handleExportConsumeKey()}
            onRename={nodeActions.handleRenameConsumeNode}
            status={registration.status}
          />
        ) : selectedEdge ? (
          <EdgeInspector
            apiBase={apiBase}
            edge={selectedEdge}
            chain={selectedChain}
            flowRate={flowRateView}
          />
        ) : selectedNode ? (
          <NodeInspector
            detailError={nodeDetail.nodeDetailError}
            detailStatus={nodeDetail.nodeDetailStatus}
            disabled={loading}
            extendLoading={extendLoading}
            flowRate={flowRateView}
            node={selectedNode}
            onExtendEnd={() => void extendFromNode(selectedNode, 'end')}
            onExtendNode={() => void extendFromNode(selectedNode, 'node')}
            onExtendStart={() => void extendFromNode(selectedNode, 'start')}
            state={nodeDetail.nodeState}
          />
        ) : (
          <div className="empty-state">{inspectorEmptyMessage}</div>
        )}
      </ErrorBoundary>
    </div>
  )
}
