import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { SystemStatusStrip } from '../../../components'

export function SystemPanelContent({ status }: { status: SystemStatusDTORaw | null }) {
  return <SystemStatusStrip status={status} />
}
