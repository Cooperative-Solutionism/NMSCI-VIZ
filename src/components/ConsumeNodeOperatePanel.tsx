import { Wallet } from 'lucide-react'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalConsumeNode } from '../lib/consumeNodeStorage'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'
import { Button } from './ui/button'

export function ConsumeNodeOperatePanel({
  node,
  onCopy,
  onDelete,
  onExportPrivateKey,
  onRename,
}: {
  node: LocalConsumeNode
  onCopy: (value: string, label: string) => void
  onDelete: () => void
  onExportPrivateKey: () => void
  onRename: () => void
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<Wallet size={16} />} title="消费节点" />
      <div className="node-key-box">
        <DetailRow label="节点 ID" value={<code translate="no">{node.id}</code>} />
        <DetailRow
          label="公钥"
          value={
            <span className="copyable-value">
              <code translate="no">{node.publicKeyHex}</code>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => onCopy(node.publicKeyHex, '公钥')}
              >
                复制
              </Button>
            </span>
          }
        />
        <DetailRow
          label="私钥"
          value={<code translate="no">{maskSecret(node.privateKeyHex)}</code>}
        />
        <DetailRow label="保存时间" value={formatDateTime(node.createdAt)} />
        <Button variant="secondary" type="button" onClick={onExportPrivateKey}>
          导出私钥
        </Button>
        <Button variant="secondary" type="button" onClick={onRename}>
          重命名
        </Button>
        <Button variant="destructive" type="button" onClick={onDelete}>
          删除
        </Button>
      </div>
      <p className="field-hint">右键此消费节点即可作为付款方生成消费记录。</p>
    </div>
  )
}
