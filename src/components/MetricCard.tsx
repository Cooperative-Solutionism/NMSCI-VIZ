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
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
