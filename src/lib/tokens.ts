export interface GraphTokens {
  nodeBackground: string
  nodeBorder: string
  nodeText: string
  nodeSelectedBackground: string
  nodeSelectedBorder: string
  edgeText: string
  edgeLabelBackground: string
  localFlowBackground: string
  localFlowBorder: string
  localConsumeBackground: string
  localConsumeBorder: string
  chainPalette: string[]
}

export const graphTokenDefaults: GraphTokens = {
  nodeBackground: '#f8fafc',
  nodeBorder: '#b9c6d3',
  nodeText: '#16202a',
  nodeSelectedBackground: '#effdfa',
  nodeSelectedBorder: '#08776c',
  edgeText: '#334155',
  edgeLabelBackground: '#ffffff',
  localFlowBackground: '#e3f4ef',
  localFlowBorder: '#08776c',
  localConsumeBackground: '#ede9fe',
  localConsumeBorder: '#6d28d9',
  chainPalette: [
    '#0f766e',
    '#b45309',
    '#2563eb',
    '#be123c',
    '#6d28d9',
    '#15803d',
    '#c2410c',
    '#0369a1',
    '#a21caf',
    '#4d7c0f',
    '#b91c1c',
    '#0e7490',
  ],
}

export function readGraphTokens(root: Element | null = defaultRoot()): GraphTokens {
  const styles = root ? getComputedStyle(root) : null
  return {
    nodeBackground: cssVar(styles, '--graph-node-bg', graphTokenDefaults.nodeBackground),
    nodeBorder: cssVar(styles, '--graph-node-border', graphTokenDefaults.nodeBorder),
    nodeText: cssVar(styles, '--graph-node-text', graphTokenDefaults.nodeText),
    nodeSelectedBackground: cssVar(
      styles,
      '--graph-node-selected-bg',
      graphTokenDefaults.nodeSelectedBackground,
    ),
    nodeSelectedBorder: cssVar(
      styles,
      '--graph-node-selected-border',
      graphTokenDefaults.nodeSelectedBorder,
    ),
    edgeText: cssVar(styles, '--graph-edge-text', graphTokenDefaults.edgeText),
    edgeLabelBackground: cssVar(
      styles,
      '--graph-edge-label-bg',
      graphTokenDefaults.edgeLabelBackground,
    ),
    localFlowBackground: cssVar(styles, '--node-local-flow-bg', graphTokenDefaults.localFlowBackground),
    localFlowBorder: cssVar(styles, '--node-local-flow-border', graphTokenDefaults.localFlowBorder),
    localConsumeBackground: cssVar(
      styles,
      '--node-local-consume-bg',
      graphTokenDefaults.localConsumeBackground,
    ),
    localConsumeBorder: cssVar(
      styles,
      '--node-local-consume-border',
      graphTokenDefaults.localConsumeBorder,
    ),
    chainPalette: graphTokenDefaults.chainPalette.map((fallback, index) =>
      cssVar(styles, `--chain-${index + 1}`, fallback),
    ),
  }
}

function cssVar(styles: CSSStyleDeclaration | null, name: string, fallback: string): string {
  const value = styles?.getPropertyValue(name).trim()
  return value || fallback
}

function defaultRoot(): Element | null {
  return typeof document === 'undefined' ? null : document.documentElement
}
