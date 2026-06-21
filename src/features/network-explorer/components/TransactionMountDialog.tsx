import { useEffect, useId, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '../../../components/ui/button'
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

      <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
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
      </div>
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
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="关闭挂载消费记录"
        className="fixed inset-0 isolate z-50 h-auto w-auto cursor-default rounded-none bg-black/10 p-0 hover:bg-black/10"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="font-heading text-base leading-none font-medium">
            挂载消费记录
          </h2>
          <p id={descriptionId} className="text-sm text-muted-foreground">
            将已创建的消费记录挂载到流转节点，形成消费链。难度目标自动取自最新区块。
          </p>
        </div>
        <MountDialogBody {...body} />
        <Button
          variant="ghost"
          className="absolute top-2 right-2"
          size="icon-sm"
          type="button"
          onClick={() => onOpenChange(false)}
        >
          <XIcon />
          <span className="sr-only">关闭</span>
        </Button>
      </div>
    </>
  )
}
