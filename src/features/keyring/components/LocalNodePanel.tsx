import { Download, KeyRound, Lock, LockOpen, Plus, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import { cn } from '@/lib/utils'
import { flowNodeDisplayName, shortId } from '../../../lib/chainGraph'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'

export interface LocalNodePanelProps {
  localFlowNodes: LocalFlowNode[]
  localConsumeNodes: LocalConsumeNode[]
  selectedLocalId?: string | null
  canvasNodeIds?: ReadonlySet<string>
  onSelectLocalNode?: (publicKeyHex: string) => void
  onToggleCanvas?: (publicKeyHex: string) => void
  onAddConsumeNode: () => void
  onAddFlowNode: () => void
  onImportLocalNode: () => void
  onDisableVault: () => void
  onEnableVault: () => void
  onLockVault: () => void
  onOpenVault: () => void
  vaultStatus: VaultStatus
}

type LocalNodeRow = {
  publicKeyHex: string
  name: string
  kind: '流转' | '消费'
  status: ReactNode
}

function flowNodeStatus(node: LocalFlowNode): ReactNode {
  if (node.registration?.status === 'failed') {
    return <Badge variant="destructive">注册失败</Badge>
  }
  if (node.registration?.status === 'sent') {
    return node.authorizations.some((authorization) => authorization.status === 'sent') ? (
      <Badge variant="outline">已授权</Badge>
    ) : (
      <Badge variant="outline">已注册</Badge>
    )
  }
  return <Badge variant="secondary">未注册</Badge>
}

function buildRows(
  localFlowNodes: LocalFlowNode[],
  localConsumeNodes: LocalConsumeNode[],
): LocalNodeRow[] {
  const flowRows = localFlowNodes.map((node, index) => ({
    publicKeyHex: node.publicKeyHex,
    name: flowNodeDisplayName(node, index),
    kind: '流转' as const,
    status: flowNodeStatus(node),
  }))
  const consumeRows = localConsumeNodes.map((node) => ({
    publicKeyHex: node.publicKeyHex,
    name: shortId(node.id),
    kind: '消费' as const,
    status: <Badge variant="secondary">消费节点</Badge>,
  }))
  return [...flowRows, ...consumeRows]
}

export function LocalNodePanel({
  localFlowNodes,
  localConsumeNodes,
  selectedLocalId,
  canvasNodeIds,
  onSelectLocalNode,
  onToggleCanvas,
  onAddConsumeNode,
  onAddFlowNode,
  onImportLocalNode,
  onDisableVault,
  onEnableVault,
  onLockVault,
  onOpenVault,
  vaultStatus,
}: LocalNodePanelProps) {
  const showCanvasColumn = Boolean(onToggleCanvas)
  const keysAvailable = vaultStatus === 'unlocked' || vaultStatus === 'disabled'
  const description =
    vaultStatus === 'disabled'
      ? '保险库已关闭：私钥以明文存储于本地，无需口令。可随时启用以加密保护。'
      : '需要访问私钥的操作会按需打开密钥保险库弹窗。'
  const rows = buildRows(localFlowNodes, localConsumeNodes)

  return (
    <div className="local-node-panel-content">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" />
            本地节点
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* 不直接把 onClick 事件透传为落点参数，面板新建的节点无落点、不自动上画布。 */}
            <Button variant="secondary" type="button" onClick={() => onAddFlowNode()}>
              <Plus data-icon="inline-start" />
              新建流转节点
            </Button>
            <Button variant="secondary" type="button" onClick={() => onAddConsumeNode()}>
              <Plus data-icon="inline-start" />
              新建消费节点
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {vaultStatus === 'disabled' ? (
              <Button variant="outline" type="button" onClick={onEnableVault}>
                <ShieldCheck data-icon="inline-start" />
                启用密钥保险库
              </Button>
            ) : vaultStatus === 'unlocked' ? (
              <>
                <Button variant="outline" type="button" onClick={onLockVault}>
                  <Lock data-icon="inline-start" />
                  锁定保险库
                </Button>
                <Button variant="ghost" type="button" onClick={onDisableVault}>
                  <LockOpen data-icon="inline-start" />
                  关闭保险库
                </Button>
              </>
            ) : (
              <Button variant="outline" type="button" onClick={onOpenVault}>
                <LockOpen data-icon="inline-start" />
                解锁密钥保险库
              </Button>
            )}
            <Button variant="outline" type="button" onClick={onImportLocalNode}>
              <Download data-icon="inline-start" />
              导入流转节点
            </Button>
          </div>

          <Separator />

          {rows.length > 0 ? (
            <div className="local-node-table">
              <Table aria-label="本地节点列表">
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>公钥</TableHead>
                    <TableHead>状态</TableHead>
                    {showCanvasColumn ? <TableHead>画布</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const selected = row.publicKeyHex === selectedLocalId
                    const onCanvas = canvasNodeIds?.has(row.publicKeyHex) ?? false

                    return (
                      <TableRow
                        key={row.publicKeyHex}
                        data-state={selected ? 'selected' : undefined}
                      >
                        <TableCell>
                          {onSelectLocalNode ? (
                            <Button
                              variant="link"
                              size="sm"
                              type="button"
                              className={cn(
                                'h-auto justify-start px-0',
                                selected && 'text-foreground',
                              )}
                              aria-current={selected ? 'true' : undefined}
                              aria-label={`选择本地节点 ${row.name}`}
                              onClick={() => onSelectLocalNode(row.publicKeyHex)}
                            >
                              {row.name}
                            </Button>
                          ) : (
                            row.name
                          )}
                        </TableCell>
                        <TableCell>{row.kind}</TableCell>
                        <TableCell>
                          <code translate="no">{shortId(row.publicKeyHex)}</code>
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                        {showCanvasColumn ? (
                          <TableCell>
                            <Button
                              variant={onCanvas ? 'secondary' : 'outline'}
                              size="sm"
                              type="button"
                              aria-pressed={onCanvas}
                              onClick={() => onToggleCanvas?.(row.publicKeyHex)}
                            >
                              {onCanvas ? '移出画布' : '添加到画布'}
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {keysAvailable
                ? '尚无本地节点，点击上方按钮创建。'
                : '解锁密钥保险库后可查看本地节点。'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
