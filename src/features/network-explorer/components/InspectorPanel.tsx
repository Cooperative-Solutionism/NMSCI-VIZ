import {
  ConsumeNodeOperatePanel,
  EdgeInspector,
  ErrorBoundary,
  FlowNodeOperatePanel,
  NodeInspector,
} from '../../../components'
import { flowNodeDisplayName } from '../../../lib/chainGraph'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type {
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTO,
  QueryMode,
} from '../../../lib/types'
import type { FlowRateView } from '../../../components/NodeInspector'
import type { useNodeDetail } from '../../../hooks/useNodeDetail'

type NodeDetail = ReturnType<typeof useNodeDetail>

export function InspectorPanel({
  apiBase,
  effectiveSelection,
  extendFromNode,
  extendLoading,
  flowRateView,
  inspectorEmptyMessage,
  loading,
  localFlowNodes,
  localNodeState,
  nodeDetail,
  nodeActions,
  selectedChain,
  selectedEdge,
  selectedLocalConsumeNode,
  selectedLocalNode,
  selectedNode,
}: {
  apiBase: string
  effectiveSelection: { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null
  extendFromNode: (node: ChainGraphNode, mode: QueryMode) => Promise<void>
  extendLoading: QueryMode | null
  flowRateView: FlowRateView
  inspectorEmptyMessage: string
  loading: boolean
  localFlowNodes: LocalFlowNode[]
  localNodeState: NodeDetail['nodeState']
  nodeDetail: NodeDetail
  nodeActions: {
    handleCopyText: (value: string, label: string) => Promise<void>
    handleDeleteConsumeNode: () => void
    handleDeleteLocalNode: () => void
    handleExportConsumeKey: () => Promise<void>
    handleExportPrivateKey: () => Promise<void>
    handleRenameConsumeNode: () => void
    handleRenameLocalNode: () => void
  }
  selectedChain: ConsumeChainResponseDTO | null
  selectedEdge: ChainGraphEdge | null
  selectedLocalConsumeNode: LocalConsumeNode | null
  selectedLocalNode: LocalFlowNode | null
  selectedNode: ChainGraphNode | null
}) {
  const selectedFlowNodeIndex = selectedLocalNode
    ? localFlowNodes.findIndex((node) => node.publicKeyHex === selectedLocalNode.publicKeyHex)
    : -1
  const selectedFlowNodeDisplayName = selectedLocalNode
    ? flowNodeDisplayName(selectedLocalNode, Math.max(0, selectedFlowNodeIndex))
    : ''

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
          <FlowNodeOperatePanel
            displayName={selectedFlowNodeDisplayName}
            node={selectedLocalNode}
            nodeState={localNodeState}
            onCopy={(value, label) => void nodeActions.handleCopyText(value, label)}
            onDelete={nodeActions.handleDeleteLocalNode}
            onExportPrivateKey={() => void nodeActions.handleExportPrivateKey()}
            onRename={nodeActions.handleRenameLocalNode}
          />
        ) : selectedLocalConsumeNode ? (
          <ConsumeNodeOperatePanel
            node={selectedLocalConsumeNode}
            onCopy={(value, label) => void nodeActions.handleCopyText(value, label)}
            onDelete={nodeActions.handleDeleteConsumeNode}
            onExportPrivateKey={() => void nodeActions.handleExportConsumeKey()}
            onRename={nodeActions.handleRenameConsumeNode}
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
