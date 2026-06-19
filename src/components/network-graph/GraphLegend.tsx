export function GraphLegend() {
  return (
    <div className="legend" aria-label="图例">
      <span>
        <i className="legend-line chain" />
        颜色 = 消费链
      </span>
      <span>
        <i className="legend-line selected" />
        已选链路
      </span>
      <span>边标签 = 金额</span>
    </div>
  )
}
