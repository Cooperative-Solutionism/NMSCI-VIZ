import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChainGraphNode } from '../../lib/types'
import { findGraphSearchMatches, GraphSearch } from './GraphSearch'

const nodes: ChainGraphNode[] = [
  node('node-alpha', 'Alpha flow'),
  node('03ABCDEF001122', 'Local flow'),
  node('node-beta', 'Beta consume'),
]

afterEach(cleanup)

describe('findGraphSearchMatches', () => {
  it('matches id and label fragments case-insensitively', () => {
    expect(findGraphSearchMatches(nodes, 'ALPHA').map((match) => match.id)).toEqual(['node-alpha'])
    expect(findGraphSearchMatches(nodes, 'abcdef').map((match) => match.id)).toEqual([
      '03ABCDEF001122',
    ])
    expect(findGraphSearchMatches(nodes, 'consume').map((match) => match.id)).toEqual([
      'node-beta',
    ])
  })

  it('returns no matches for blank queries', () => {
    expect(findGraphSearchMatches(nodes, '   ')).toEqual([])
  })
})

describe('GraphSearch', () => {
  it('selects the first matching node from the locate button', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'flow' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))

    expect(screen.getByRole('status')).toHaveTextContent('匹配 2 个节点')
    expect(onSelectNode).toHaveBeenCalledWith(nodes[0])
  })

  it('selects the first matching node from Enter', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'beta' },
    })
    fireEvent.keyDown(screen.getByLabelText('搜索图谱节点'), { key: 'Enter' })

    expect(onSelectNode).toHaveBeenCalledWith(nodes[2])
  })

  it('shows an inline no-result message without calling select', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    const searchInput = screen.getByLabelText('搜索图谱节点')
    fireEvent.change(searchInput, {
      target: { value: 'missing' },
    })

    expect(screen.getByRole('button', { name: '定位节点' })).toBeDisabled()
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    expect(screen.getByRole('status')).toHaveTextContent('未找到匹配节点')
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it('disables search controls for an empty graph', () => {
    render(<GraphSearch nodes={[]} onSelectNode={vi.fn()} />)

    expect(screen.getByLabelText('搜索图谱节点')).toBeDisabled()
    expect(screen.getByRole('button', { name: '定位节点' })).toBeDisabled()
  })
})

function node(id: string, label: string): ChainGraphNode {
  return {
    id,
    label,
    chainCount: 1,
    kind: 'chain',
    volumeByCurrency: new Map([[1, 100n]]),
  }
}
