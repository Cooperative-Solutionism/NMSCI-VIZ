import { KeyRound, Plus } from 'lucide-react'
import { PanelHeader, VaultGate } from '../../../../components'
import type { KeyringPanelContentProps } from './types'

export function KeyringPanelContent({
  onAddConsumeNode,
  onAddFlowNode,
  onImportLocalNode,
  onLockVault,
  onSetupVault,
  onUnlockVault,
  registrationError,
  showKeyringError,
  vaultError,
  vaultStatus,
}: KeyringPanelContentProps) {
  return (
    <div className="flow-node-block">
      <PanelHeader icon={<KeyRound size={16} />} title="密钥" />
      <VaultGate
        status={vaultStatus}
        error={vaultError}
        onSetup={onSetupVault}
        onUnlock={onUnlockVault}
        onLock={onLockVault}
      />
      <div className="action-row two">
        <button
          className="secondary-button"
          type="button"
          disabled={vaultStatus !== 'unlocked'}
          onClick={() => onAddFlowNode()}
        >
          <Plus size={15} />
          流转节点
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={vaultStatus !== 'unlocked'}
          onClick={() => onAddConsumeNode()}
        >
          <Plus size={15} />
          消费节点
        </button>
      </div>
      <div className="action-row">
        <button
          className="secondary-button"
          type="button"
          disabled={vaultStatus !== 'unlocked'}
          onClick={onImportLocalNode}
        >
          <Plus size={15} />
          导入流转节点
        </button>
      </div>
      <p className="field-hint">
        {vaultStatus === 'unlocked'
          ? '可在画布右键添加节点，点击节点后可注册、授权或构建交易。'
          : '解锁密钥保险库后可添加或导入节点；私钥会加密存储。'}
      </p>
      {registrationError && showKeyringError ? (
        <p className="operation-message error" role="alert">
          {registrationError}
        </p>
      ) : null}
    </div>
  )
}
