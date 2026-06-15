import { Wallet } from 'lucide-react'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalConsumeNode } from '../lib/consumeNodeStorage'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'

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
      <PanelHeader icon={<Wallet size={16} />} title="消费节点" />
      <div className="node-key-box">
        <DetailRow
          label="公钥"
          value={
            <span className="copyable-value">
              <code translate="no">{node.publicKeyHex}</code>
              <button type="button" onClick={() => onCopy(node.publicKeyHex, '公钥')}>
                复制
              </button>
            </span>
          }
        />
        <DetailRow
          label="私钥"
          value={<code translate="no">{maskSecret(node.privateKeyHex)}</code>}
        />
        <DetailRow label="保存时间" value={formatDateTime(node.createdAt)} />
        <button className="secondary-button" type="button" onClick={onExportPrivateKey}>
          导出私钥
        </button>
        <button className="secondary-button" type="button" onClick={onRename}>
          重命名
        </button>
        <button className="secondary-button danger" type="button" onClick={onDelete}>
          删除
        </button>
      </div>
      <p className="field-hint">创建交易记录时可将此消费节点作为来源。</p>
      {status ? (
        <p className="operation-message" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="operation-message error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
