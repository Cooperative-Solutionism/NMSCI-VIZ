import type { ReactNode } from 'react'

export function MetricCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone?: 'looped' | 'open'
  value: string
}) {
  return (
    <div className={`metric-card ${tone ?? ''}`}>
      <span className="metric-icon">{icon}</span>
      <span className="metric-body">
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
      </span>
    </div>
  )
}
