import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'

interface GraphAccessListProps {
  graph: ChainGraph
  onSelectEdge: (edge: ChainGraphEdge) => void
  onSelectNode: (node: ChainGraphNode) => void
}

export function GraphAccessList({ graph, onSelectEdge, onSelectNode }: GraphAccessListProps) {
  return (
    <div className="sr-only graph-access-list" aria-label="键盘图谱选择">
      <h3>图谱节点</h3>
      {graph.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node)}>
          选择节点 <span translate="no">{node.id}</span>
        </button>
      ))}
      <h3>图谱边</h3>
      {graph.edges.map((edge) => (
        <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)}>
          选择{edge.status === 'looped' ? '成环' : '开放'}边 <span translate="no">{edge.id}</span>
        </button>
      ))}
    </div>
  )
}
