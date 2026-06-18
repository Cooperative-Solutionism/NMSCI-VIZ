import type { GraphTokens } from '../../lib/tokens'

type GraphStyle = NonNullable<cytoscape.CytoscapeOptions['style']>

export function createGraphStyle(tokens: GraphTokens): GraphStyle {
  return [
    {
      selector: 'node',
      style: {
        'background-color': tokens.nodeBackground,
        'border-color': tokens.nodeBorder,
        'border-width': 1.4,
        color: tokens.nodeText,
        content: 'data(label)',
        'font-family': 'Inter, ui-sans-serif, system-ui',
        'font-size': 11,
        height: 48,
        'overlay-opacity': 0,
        'text-halign': 'center',
        'text-valign': 'center',
        width: 48,
      },
    },
    {
      selector: 'node[kind = "local-flow"]',
      style: {
        'background-color': tokens.localFlowBackground,
        'border-color': tokens.localFlowBorder,
        'border-width': 3,
      },
    },
    {
      selector: 'node[kind = "local-consume"]',
      style: {
        'background-color': tokens.localConsumeBackground,
        'border-color': tokens.localConsumeBorder,
        'border-width': 3,
        shape: 'round-rectangle',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': tokens.nodeSelectedBackground,
        'border-color': tokens.nodeSelectedBorder,
        'border-width': 3,
      },
    },
    {
      selector: 'edge',
      style: {
        color: tokens.edgeText,
        'curve-style': 'bezier',
        'font-family': 'Inter, ui-sans-serif, system-ui',
        'font-size': 10,
        label: 'data(label)',
        'line-color': 'data(color)',
        opacity: 0.84,
        'overlay-opacity': 0,
        'target-arrow-color': 'data(color)',
        'target-arrow-shape': 'triangle',
        'target-distance-from-node': 2,
        'text-background-color': tokens.edgeLabelBackground,
        'text-background-opacity': 0.92,
        'text-background-padding': '3px',
        'text-rotation': 'autorotate',
        width: 2.5,
      },
    },
    {
      selector: 'edge.chain-dimmed',
      style: {
        opacity: 0.16,
        'text-background-opacity': 0,
        'text-opacity': 0.2,
      },
    },
    {
      selector: 'edge[status = "open"]',
      style: {
        'line-style': 'dashed',
      },
    },
    {
      selector: 'edge[status = "looped"]',
      style: {
        'line-style': 'solid',
      },
    },
    {
      selector: 'edge.chain-highlight',
      style: {
        opacity: 1,
        'line-color': 'data(color)',
        'target-arrow-color': 'data(color)',
        width: 5,
        'z-index': 20,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 6,
      },
    },
  ]
}
