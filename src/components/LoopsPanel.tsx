import { Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatAmount, shortId } from '../lib/chainGraph'
import { sortLoops, type LoopSort, type LoopSummary } from '../lib/loops'
import { PanelHeader } from './PanelHeader'

// 循环交易（成环消费链）面板：把"成环"从一个计数变成可排序、可点选、可在图上高亮的清单。
export function LoopsPanel({
  loops,
  onSelectLoop,
  selectedChainId,
}: {
  loops: LoopSummary[]
  onSelectLoop: (chainId: string) => void
  selectedChainId: string | null
}) {
  const [sort, setSort] = useState<LoopSort>('amount')
  const sorted = useMemo(() => sortLoops(loops, sort), [loops, sort])

  return (
    <section className="loops-panel" aria-label="Circular trade loops">
      <div className="loops-head">
        <PanelHeader icon={<Repeat size={16} />} title={`Loops (${loops.length})`} />
        <div className="segmented compact" role="group" aria-label="Loop sort">
          {(['amount', 'length', 'recency'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={sort === option ? 'active' : ''}
              onClick={() => setSort(option)}
            >
              {sortLabel(option)}
            </button>
          ))}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty-state small">No looped chains in the current filter.</p>
      ) : (
        <ul className="loops-list">
          {sorted.map((loop) => (
            <li key={loop.chainId}>
              <button
                type="button"
                className={`loop-row ${loop.chainId === selectedChainId ? 'active' : ''}`}
                aria-pressed={loop.chainId === selectedChainId}
                onClick={() => onSelectLoop(loop.chainId)}
              >
                <span className="loop-id">{shortId(loop.chainId)}</span>
                <span className="loop-amount">{formatAmount(loop.amount, loop.currencyType)}</span>
                <span className="loop-len">{loop.length} hops</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function sortLabel(sort: LoopSort): string {
  if (sort === 'length') return 'Length'
  if (sort === 'recency') return 'Recent'
  return 'Value'
}
