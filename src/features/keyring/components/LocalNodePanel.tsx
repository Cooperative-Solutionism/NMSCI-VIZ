import { Download, KeyRound, Lock, LockOpen, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'
import type { VaultStatus } from '../../../hooks/useKeyVault'

export interface LocalNodePanelProps {
  onAddConsumeNode: () => void
  onAddFlowNode: () => void
  onImportLocalNode: () => void
  onLockVault: () => void
  onOpenVault: () => void
  vaultStatus: VaultStatus
}

export function LocalNodePanel({
  onAddConsumeNode,
  onAddFlowNode,
  onImportLocalNode,
  onLockVault,
  onOpenVault,
  vaultStatus,
}: LocalNodePanelProps) {
  const VaultIcon =
    vaultStatus === 'unlocked' ? Lock : vaultStatus === 'setup' ? ShieldCheck : LockOpen
  const vaultLabel =
    vaultStatus === 'unlocked'
      ? '锁定密钥保险库'
      : vaultStatus === 'setup'
        ? '创建密钥保险库'
        : '解锁密钥保险库'
  const vaultAction = vaultStatus === 'unlocked' ? onLockVault : onOpenVault

  return (
    <div className="local-node-panel-content">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" />
            本地节点
          </CardTitle>
          <CardDescription>需要访问私钥的操作会按需打开密钥保险库弹窗。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" type="button" onClick={onAddFlowNode}>
              <Plus data-icon="inline-start" />
              新建流转节点
            </Button>
            <Button variant="secondary" type="button" onClick={onAddConsumeNode}>
              <Plus data-icon="inline-start" />
              新建消费节点
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" type="button" onClick={vaultAction}>
              <VaultIcon data-icon="inline-start" />
              {vaultLabel}
            </Button>
            <Button variant="outline" type="button" onClick={onImportLocalNode}>
              <Download data-icon="inline-start" />
              导入流转节点
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
