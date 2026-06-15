import { Wallet } from 'lucide-react'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalConsumeNode } from '../lib/consumeNodeStorage'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'

// 消费节点操作面板：消费节点仅是一对密钥（无注册/授权），故只提供密钥信息与管理。
export function ConsumeNodeOperatePanel({
  error,
  node,
  onCopy,
  onDelete,
  onExportPrivateKey,
  onRename,
  status,
}: {
  error: string | null
  node: LocalConsumeNode
  onCopy: (value: string, label: string) => void
  onDelete: () => void
  onExportPrivateKey: () => void
  onRename: () => void
  status: string | null
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<Wallet size={16} />} title="Consume node" />
      <div className="node-key-box">
        <DetailRow
          label="Pubkey"
          value={(
            <span className="copyable-value">
              <code>{node.publicKeyHex}</code>
              <button type="button" onClick={() => onCopy(node.publicKeyHex, 'Pubkey')}>
                Copy
              </button>
            </span>
          )}
        />
        <DetailRow label="Secret" value={<code>{maskSecret(node.privateKeyHex)}</code>} />
        <DetailRow label="Saved" value={formatDateTime(node.createdAt)} />
        <button className="secondary-button" type="button" onClick={onExportPrivateKey}>
          Export private key
        </button>
        <button className="secondary-button" type="button" onClick={onRename}>
          Rename
        </button>
        <button className="secondary-button danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
      <p className="field-hint">Use this consume node as the source when creating a transaction record.</p>
      {status ? <p className="operation-message">{status}</p> : null}
      {error ? <p className="operation-message error">{error}</p> : null}
    </div>
  )
}
