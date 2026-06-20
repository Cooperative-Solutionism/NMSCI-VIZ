import { graphNodeIconPaths } from './graphIcons'

const legendItems = [
  { icon: graphNodeIconPaths.chain, label: '链路节点' },
  { icon: graphNodeIconPaths.localConsume, label: '消费节点' },
  { icon: graphNodeIconPaths.flowUnregistered, label: '流转未注册' },
  { icon: graphNodeIconPaths.flowRegistered, label: '流转已注册' },
  { icon: graphNodeIconPaths.flowAuthorized, label: '流转已授权' },
  { icon: graphNodeIconPaths.flowFailed, label: '流转失败' },
  { icon: graphNodeIconPaths.selected, label: '准星 = 选中' },
  { icon: graphNodeIconPaths.cycleEndpoint, label: '循环端点' },
] as const

export function GraphLegend() {
  return (
    <div className="legend" aria-label="图例">
      {legendItems.map((item) => (
        <span key={item.label}>
          <img className="legend-icon" src={item.icon} alt="" aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  )
}
