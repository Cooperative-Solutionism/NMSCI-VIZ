import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { flowNodeDisplayName, formatAmount, shortId } from '../../../lib/chainGraph'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import { formatInteger } from '../../../lib/format'
import type { LocalTxRecord } from '../../../lib/txRecordStorage'

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

  const handleSubmit = () => {
    if (busy || !recordId || !flowNodePubkey) return
    onMount(recordId, flowNodePubkey)
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="mount-record-id">待挂载记录</FieldLabel>
          <Select value={recordId} onValueChange={setRecordId}>
            <SelectTrigger id="mount-record-id" className="w-full">
              <SelectValue placeholder="暂无记录，请先创建" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {records.map((record) => (
                  <SelectItem key={record.id} value={record.id}>
                    {shortId(record.id)} ·{' '}
                    {formatAmount(BigInt(record.amount), record.currencyType)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="mount-flow-node">挂载流转节点</FieldLabel>
          <Select value={flowNodePubkey} onValueChange={setFlowNodePubkey}>
            <SelectTrigger id="mount-flow-node" className="w-full">
              <SelectValue placeholder="暂无流转节点，请先添加" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {flowNodes.map((node, index) => (
                  <SelectItem key={node.publicKeyHex} value={node.publicKeyHex}>
                    {flowNodeDisplayName(node, index)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

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
        <DialogClose asChild>
          <Button variant="outline" type="button">
            关闭
          </Button>
        </DialogClose>
        {canViewChain ? (
          <Button variant="secondary" type="button" onClick={onViewChain}>
            查看消费链
          </Button>
        ) : null}
        <Button type="button" disabled={busy} onClick={handleSubmit}>
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
