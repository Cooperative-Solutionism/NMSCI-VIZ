import type { GraphTokens } from '../../lib/tokens'
import { graphNodeIconUrls } from './graphIcons'

type GraphStyle = NonNullable<cytoscape.CytoscapeOptions['style']>

const graphFontFamily =
  'Geist Variable, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'

export function createGraphStyle(tokens: GraphTokens): GraphStyle {
  return [
    {
      selector: 'node',
      style: {
        'background-clip': 'none',
        'background-color': tokens.nodeBackground,
        'background-fit': 'contain',
        'background-height': '74%',
        'background-image': 'data(icon)',
        'background-image-containment': 'over',
        'background-image-smoothing': 'yes',
        'background-width': '74%',
        'border-color': tokens.nodeBorder,
        'border-width': 1.4,
        'bounds-expansion': 16,
        color: tokens.nodeText,
        content: 'data(label)',
        'font-family': graphFontFamily,
        'font-size': 11,
        height: 58,
        'overlay-opacity': 0,
        'outline-opacity': 0,
        'outline-width': 0,
        'text-halign': 'center',
        'text-margin-y': 8,
        'text-max-width': '76px',
        'text-valign': 'bottom',
        'text-wrap': 'wrap',
        width: 58,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'background-height': ['74%', '118%'],
        'background-image': ['data(icon)', graphNodeIconUrls.selected],
        'background-position-x': ['50%', '50%'],
        'background-position-y': ['50%', '50%'],
        'background-width': ['74%', '118%'],
        'font-weight': 700,
        'text-background-color': tokens.nodeSelectedBackground,
        'text-background-opacity': 0.86,
        'z-index': 32,
      },
    },
    {
      selector: 'edge',
      style: {
        color: tokens.edgeText,
        'curve-style': 'bezier',
        'font-family': graphFontFamily,
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
      selector: 'edge.cycle-highlight',
      style: {
        opacity: 1,
        'line-color': '#b45309',
        'target-arrow-color': '#b45309',
        width: 5.5,
        'z-index': 24,
      },
    },
    {
      selector: 'node.cycle-endpoint',
      style: {
        'background-height': ['74%', '112%'],
        'background-image': ['data(icon)', graphNodeIconUrls.cycleEndpoint],
        'background-position-x': ['50%', '50%'],
        'background-position-y': ['50%', '50%'],
        'background-width': ['74%', '112%'],
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
