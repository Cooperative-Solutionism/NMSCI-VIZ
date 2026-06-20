import { Search } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import type { ChainGraphNode } from '../../lib/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface GraphSearchProps {
  nodes: ChainGraphNode[]
  onSelectNode: (node: ChainGraphNode) => void
}

export function findGraphSearchMatches(
  nodes: ChainGraphNode[],
  query: string,
): ChainGraphNode[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return nodes.filter((node) => {
    return (
      node.id.toLowerCase().includes(normalizedQuery) ||
      node.label.toLowerCase().includes(normalizedQuery)
    )
  })
}

export function GraphSearch({ nodes, onSelectNode }: GraphSearchProps) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => findGraphSearchMatches(nodes, query), [nodes, query])
  const disabled = nodes.length === 0
  const hasQuery = query.trim().length > 0
  const hasNoMatches = hasQuery && matches.length === 0

  const locateFirstMatch = () => {
    const firstMatch = matches[0]
    if (firstMatch) onSelectNode(firstMatch)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    locateFirstMatch()
  }

  return (
    <div className="graph-search" role="search" aria-label="图谱节点搜索">
      <div className="graph-search__row">
        <Input
          aria-label="搜索图谱节点"
          autoComplete="off"
          disabled={disabled}
          name="graphSearch"
          placeholder="搜索节点 ID / 公钥"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          aria-label="定位节点"
          disabled={disabled || matches.length === 0}
          size="icon"
          title="定位节点"
          type="button"
          variant="ghost"
          onClick={locateFirstMatch}
        >
          <Search aria-hidden="true" />
        </Button>
      </div>
      {hasNoMatches ? <div className="graph-search__hint">未找到匹配节点</div> : null}
      {matches.length > 0 ? (
        <div className="graph-search__hint">匹配 {matches.length} 个节点</div>
      ) : null}
    </div>
  )
}
