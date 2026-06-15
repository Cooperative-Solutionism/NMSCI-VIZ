import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { SystemStatusStrip } from '../../../components'
import type { DataOrigin } from '../../../hooks/useConsumeChainQuery'

export function TopBar({
  edgeCount,
  nodeCount,
  origin,
  systemStatus,
}: {
  edgeCount: number
  nodeCount: number
  origin: DataOrigin
  systemStatus: SystemStatusDTORaw | null
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">NMSCI Consumption Network</p>
        <h1>Network Explorer</h1>
      </div>
      <div className="topbar-status" aria-label="Data status">
        <span className={`status-dot ${origin}`} />
        <span>{origin === 'backend' ? 'Backend data' : 'No data'}</span>
        <span className="status-divider" />
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
      </div>
      <SystemStatusStrip status={systemStatus} />
    </header>
  )
}
