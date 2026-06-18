import { VaultGate } from '../../../components'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import type { VaultStatus } from '../../../hooks/useKeyVault'

interface VaultPromptDialogProps {
  error: string | null
  open: boolean
  reason: string | null
  status: VaultStatus
  onLock: () => void
  onOpenChange: (open: boolean) => void
  onSetup: (passphrase: string) => void
  onUnlock: (passphrase: string) => void
}

export function VaultPromptDialog({
  error,
  open,
  reason,
  status,
  onLock,
  onOpenChange,
  onSetup,
  onUnlock,
}: VaultPromptDialogProps) {
  const isSetup = status === 'setup'
  const title = isSetup ? '创建密钥保险库' : '解锁密钥保险库'
  const description = reason
    ? `${reason} 需要访问本地私钥。`
    : '输入保险库口令后，本次会话将加载本地密钥环。'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <VaultGate
          status={status}
          error={error}
          onSetup={onSetup}
          onUnlock={onUnlock}
          onLock={onLock}
        />
      </DialogContent>
    </Dialog>
  )
}
