import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadLocalFlowNodes,
  patchLocalFlowNode,
  saveLocalFlowNodes,
  type LocalFlowNode,
} from './flowNodeStorage'

const node: LocalFlowNode = {
  id: 'local-node-1',
  label: 'NODE01',
  publicKeyHex: '02'.padEnd(66, '1'),
  privateKeyHex: '0'.repeat(63) + '1',
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  authorizations: [],
}

describe('flow node local storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores generated flow nodes in a versioned localStorage document', () => {
    saveLocalFlowNodes([node])

    const raw = localStorage.getItem('nmsci.flowNodes.v1')
    expect(raw).toContain('"version":1')
    expect(loadLocalFlowNodes()).toEqual([node])
  })

  it('patches matching nodes without duplicating the same local id', () => {
    const patchedNodes = patchLocalFlowNode([node], node.id, {
      label: 'NODE02',
      updatedAt: '2026-06-13T00:01:00.000Z',
    })
    saveLocalFlowNodes(patchedNodes)

    expect(loadLocalFlowNodes()).toEqual([{
      ...node,
      label: 'NODE02',
      updatedAt: '2026-06-13T00:01:00.000Z',
    }])
  })

  it('treats malformed localStorage payloads as empty data', () => {
    localStorage.setItem('nmsci.flowNodes.v1', '{broken')

    expect(loadLocalFlowNodes()).toEqual([])
  })
})
