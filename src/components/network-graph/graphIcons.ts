import type { ChainGraphNode } from '../../lib/types'

export const graphNodeIconUrls = {
  chain: 'url("/graph-icons/node-chain.png")',
  cycleEndpoint: 'url("/graph-icons/node-cycle-endpoint.png")',
  flowAuthorized: 'url("/graph-icons/node-flow-authorized.png")',
  flowFailed: 'url("/graph-icons/node-flow-failed.png")',
  flowRegistered: 'url("/graph-icons/node-flow-registered.png")',
  flowUnregistered: 'url("/graph-icons/node-flow-unregistered.png")',
  localConsume: 'url("/graph-icons/node-local-consume.png")',
  selected: 'url("/graph-icons/node-selected.png")',
} as const

export const graphNodeIconPaths = {
  chain: '/graph-icons/node-chain.png',
  cycleEndpoint: '/graph-icons/node-cycle-endpoint.png',
  flowAuthorized: '/graph-icons/node-flow-authorized.png',
  flowFailed: '/graph-icons/node-flow-failed.png',
  flowRegistered: '/graph-icons/node-flow-registered.png',
  flowUnregistered: '/graph-icons/node-flow-unregistered.png',
  localConsume: '/graph-icons/node-local-consume.png',
  selected: '/graph-icons/node-selected.png',
} as const

export function graphNodeIconFor(node: ChainGraphNode): string {
  if (node.kind === 'local-consume') return graphNodeIconUrls.localConsume

  if (node.kind === 'local-flow') {
    switch (node.flowStatus) {
      case 'authorized':
        return graphNodeIconUrls.flowAuthorized
      case 'failed':
        return graphNodeIconUrls.flowFailed
      case 'registered':
        return graphNodeIconUrls.flowRegistered
      case 'unregistered':
      default:
        return graphNodeIconUrls.flowUnregistered
    }
  }

  return graphNodeIconUrls.chain
}
