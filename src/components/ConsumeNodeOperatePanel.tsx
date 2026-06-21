import { Wallet } from 'lucide-react'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalConsumeNode } from '../lib/consumeNodeStorage'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'
import { Button } from './ui/button'

// 导出私钥 / 重命名 / 删除等管理操作已迁移到画布右键菜单；此面板仅展示密钥详情。
export function ConsumeNodeOperatePanel({
  node,
  onCopy,
}: {
  node: LocalConsumeNode
  onCopy: (value: string, label: string) => void
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
      </div>
      <p className="field-hint">
        右键此消费节点可作为付款方生成消费记录，并进行导出私钥、重命名、删除等操作。
      </p>
    </div>
  )
}
