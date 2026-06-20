import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { flowNodeDisplayName, formatAmount, shortId } from '../../../lib/chainGraph'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import { formatInteger } from '../../../lib/format'
import type { LocalTxRecord } from '../../../lib/txRecordStorage'

const choiceListClassName =
  'grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-border bg-background/50 p-1'
const choiceButtonClassName =
  'h-auto min-h-8 w-full justify-start whitespace-normal px-2 py-1.5 text-left'

type MountDialogBodyProps = {
  busy: boolean
  canViewChain: boolean
  defaultFlowNodePubkey?: string
  error: string | null
  flowNodes: LocalFlowNode[]
  miningAttempts: number | null
  records: LocalTxRecord[]
  status: string | null
  onMount: (recordId: string, flowNodePubkey: string) => void
  onViewChain: () => void
}

// 表单状态随弹窗内容挂载而重建：打开时按右键来源（默认值）重新预填。
function MountDialogBody({
  busy,
  canViewChain,
  defaultFlowNodePubkey,
  error,
  flowNodes,
  miningAttempts,
  records,
  status,
  onMount,
  onViewChain,
}: MountDialogBodyProps) {
  const [recordId, setRecordId] = useState(records[0]?.id ?? '')
  const [flowNodePubkey, setFlowNodePubkey] = useState(
    defaultFlowNodePubkey ?? flowNodes[0]?.publicKeyHex ?? '',
  )
  const missingInputs = records.length === 0 || flowNodes.length === 0

  const handleSubmit = () => {
    if (busy || missingInputs || !recordId || !flowNodePubkey) return
    onMount(recordId, flowNodePubkey)
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel id="mount-record-label">待挂载记录</FieldLabel>
          <div
            id="mount-record-id"
            className={choiceListClassName}
            role="group"
            aria-labelledby="mount-record-label"
          >
            {records.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">暂无记录，请先创建</p>
            ) : null}
            {records.map((record) => {
              const selected = record.id === recordId
              return (
                <Button
                  key={record.id}
                  type="button"
                  variant={selected ? 'secondary' : 'outline'}
                  className={choiceButtonClassName}
                  aria-pressed={selected}
                  aria-label={`选择消费记录 ${record.id}`}
                  onClick={() => setRecordId(record.id)}
                >
                  {shortId(record.id)} · {formatAmount(BigInt(record.amount), record.currencyType)}
                </Button>
              )
            })}
          </div>
        </Field>

        <Field>
          <FieldLabel id="mount-flow-node-label">挂载流转节点</FieldLabel>
          <div
            id="mount-flow-node"
            className={choiceListClassName}
            role="group"
            aria-labelledby="mount-flow-node-label"
          >
            {flowNodes.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">暂无流转节点，请先添加</p>
            ) : null}
            {flowNodes.map((node, index) => {
              const selected = node.publicKeyHex === flowNodePubkey
              return (
                <Button
                  key={node.publicKeyHex}
                  type="button"
                  variant={selected ? 'secondary' : 'outline'}
                  className={choiceButtonClassName}
                  aria-pressed={selected}
                  aria-label={`选择流转节点 ${node.publicKeyHex}`}
                  onClick={() => setFlowNodePubkey(node.publicKeyHex)}
                >
                  {flowNodeDisplayName(node, index)}
                </Button>
              )
            })}
          </div>
        </Field>
      </FieldGroup>

      {missingInputs ? (
        <p className="text-sm text-muted-foreground">
          需要至少一条消费记录和一个流转节点才能挂载。
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        {canViewChain ? (
          <Button variant="secondary" type="button" onClick={onViewChain}>
            查看消费链
          </Button>
        ) : null}
        <Button type="button" disabled={busy || missingInputs} onClick={handleSubmit}>
          {busy
            ? miningAttempts != null
              ? `挖矿 ${formatInteger(miningAttempts)}…`
              : '提交中…'
            : '提交挂载'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function TransactionMountDialog({
  open,
  onOpenChange,
  ...body
}: MountDialogBodyProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>挂载消费记录</DialogTitle>
          <DialogDescription>
            将已创建的消费记录挂载到流转节点，形成消费链。难度目标自动取自最新区块。
          </DialogDescription>
        </DialogHeader>
        <MountDialogBody {...body} />
      </DialogContent>
    </Dialog>
  )
}
