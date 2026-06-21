import type { ChainGraphNode } from '../../lib/types'

// 画布节点图标统一为内联 SVG（data-URI）：颜色精准、任意缩放锐利、无二进制资源。
// 设计语言（“循环价值币”）：
//   流转节点 = 价值币 + 环绕的流转箭头；本地状态只换币色并叠加中心标记（链/基础态无标记）。
//   消费节点 = 价值币 + 自上落入的箭头（价值被消费、不再流转）。
//   选中 / 循环端点 = 套在节点外的空心圆环（中心透明，叠加在节点之上）。
// 注意：作为 background-image / <img> 渲染时，SVG 必须带 xmlns 与显式尺寸。

// 环绕的流转箭头：与价值币同心的顺时针环（r=32, center 64,64）+ 底部缺口处一只醒目的大箭头，强调“价值在流转”。
const FLOW_ORBIT =
  "<path d='M53 94 A32 32 0 1 1 75 94' fill='none' stroke='#0f172a' stroke-width='9' stroke-linecap='round'/>" +
  "<polygon points='60,99 79,104 71,84' fill='#0f172a'/>"

const MUTED_ORBIT =
  "<path d='M53 94 A32 32 0 1 1 75 94' fill='none' stroke='#94a3b8' stroke-width='9' stroke-linecap='round'/>" +
  "<polygon points='60,99 79,104 71,84' fill='#94a3b8'/>"

function svg(body: string): string {
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>" +
    body +
    '</svg>'
  )
}

const iconSvgs = {
  chain: svg(FLOW_ORBIT + "<circle cx='64' cy='64' r='19' fill='#0f766e'/>"),
  flowUnregistered: svg(MUTED_ORBIT + "<circle cx='64' cy='64' r='19' fill='#64748b'/>"),
  // 已注册（未授权，还不能正常使用）：黄橙价值币，等待授权。
  flowRegistered: svg(FLOW_ORBIT + "<circle cx='64' cy='64' r='19' fill='#d97706'/>"),
  // 已授权（能正常使用的节点）：纯绿价值币（交通灯绿，保持简洁，不加对勾）。
  flowAuthorized: svg(FLOW_ORBIT + "<circle cx='64' cy='64' r='19' fill='#15803d'/>"),
  localConsume: svg(
    "<line x1='64' y1='16' x2='64' y2='34' stroke='#6d28d9' stroke-width='9' stroke-linecap='round'/>" +
      "<polygon points='54,30 74,30 64,44' fill='#6d28d9'/>" +
      "<circle cx='64' cy='64' r='19' fill='#6d28d9'/>",
  ),
  selected: svg(
    "<g fill='none' stroke='#08776c' stroke-linecap='round'>" +
      "<circle cx='64' cy='64' r='40' stroke-width='9'/>" +
      "<line x1='64' y1='12' x2='64' y2='26' stroke-width='9'/>" +
      "<line x1='64' y1='102' x2='64' y2='116' stroke-width='9'/>" +
      "<line x1='12' y1='64' x2='26' y2='64' stroke-width='9'/>" +
      "<line x1='102' y1='64' x2='116' y2='64' stroke-width='9'/></g>",
  ),
  cycleEndpoint: svg(
    "<g fill='none' stroke='#d97706' stroke-width='9' stroke-linecap='round'>" +
      "<path d='M26 64 A38 38 0 0 1 102 64'/><path d='M102 64 A38 38 0 0 1 26 64'/></g>" +
      "<polygon points='94,60 110,60 102,73' fill='#d97706'/>" +
      "<polygon points='34,68 18,68 26,55' fill='#d97706'/>",
  ),
} as const

function toDataUri(svgMarkup: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`
}

// 原始 data-URI：供 <img src> 直接使用（图例）。
export const graphNodeIconPaths = {
  chain: toDataUri(iconSvgs.chain),
  cycleEndpoint: toDataUri(iconSvgs.cycleEndpoint),
  flowAuthorized: toDataUri(iconSvgs.flowAuthorized),
  flowRegistered: toDataUri(iconSvgs.flowRegistered),
  flowUnregistered: toDataUri(iconSvgs.flowUnregistered),
  localConsume: toDataUri(iconSvgs.localConsume),
  selected: toDataUri(iconSvgs.selected),
} as const

// CSS url() 形式：供 Cytoscape background-image 使用。
export const graphNodeIconUrls = {
  chain: `url("${graphNodeIconPaths.chain}")`,
  cycleEndpoint: `url("${graphNodeIconPaths.cycleEndpoint}")`,
  flowAuthorized: `url("${graphNodeIconPaths.flowAuthorized}")`,
  flowRegistered: `url("${graphNodeIconPaths.flowRegistered}")`,
  flowUnregistered: `url("${graphNodeIconPaths.flowUnregistered}")`,
  localConsume: `url("${graphNodeIconPaths.localConsume}")`,
  selected: `url("${graphNodeIconPaths.selected}")`,
} as const

export function graphNodeIconFor(node: ChainGraphNode): string {
  if (node.kind === 'local-consume') return graphNodeIconUrls.localConsume

  if (node.kind === 'local-flow') {
    switch (node.flowStatus) {
      case 'authorized':
        return graphNodeIconUrls.flowAuthorized
      case 'registered':
        return graphNodeIconUrls.flowRegistered
      case 'unregistered':
      default:
        return graphNodeIconUrls.flowUnregistered
    }
  }

  return graphNodeIconUrls.chain
}
