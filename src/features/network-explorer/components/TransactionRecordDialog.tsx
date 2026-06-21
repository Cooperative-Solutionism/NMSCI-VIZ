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
import { Field, FieldError, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { flowNodeDisplayName, shortId } from '../../../lib/chainGraph'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import { formatInteger } from '../../../lib/format'
import type { TransactionRecordDraft } from '../../../hooks/flow-node-registration/useFlowNodeTransactionActions'

const INT64_MAX = 9223372036854775807n

function amountIssue(raw: string): string | null {
  const value = raw.trim()
  if (!/^[0-9]+$/.test(value)) return '金额必须是非负整数（最小单位）。'
  const parsed = BigInt(value)
  if (parsed < 1n) return '金额至少为 1。'
  if (parsed > INT64_MAX) return '金额超出 int64 协议范围。'
  return null
}

type RecordDialogBodyProps = {
  busy: boolean
  consumeNodes: LocalConsumeNode[]
  createdRecordId?: string
  defaultConsumeNodePubkey?: string
  defaultFlowNodePubkey?: string
  error: string | null
  flowNodes: LocalFlowNode[]
  miningAttempts: number | null
  status: string | null
  onCreate: (draft: TransactionRecordDraft) => void | Promise<void>
  onMountToNode?: (recordId: string) => void
}

// 表单状态随弹窗内容挂载/卸载而重建：每次打开都按右键来源（默认值）重新预填，无需副作用同步。
function RecordDialogBody({
  busy,
  consumeNodes,
  createdRecordId,
  defaultConsumeNodePubkey,
  defaultFlowNodePubkey,
  error,
  flowNodes,
  miningAttempts,
  status,
  onCreate,
  onMountToNode,
}: RecordDialogBodyProps) {
  const [consumeNodePubkey, setConsumeNodePubkey] = useState(
    defaultConsumeNodePubkey ?? consumeNodes[0]?.publicKeyHex ?? '',
  )
  const [flowNodePubkey, setFlowNodePubkey] = useState(
    defaultFlowNodePubkey ?? flowNodes[0]?.publicKeyHex ?? '',
  )
  const [amount, setAmount] = useState('')
  const [currencyType, setCurrencyType] = useState('1')
  const [amountTouched, setAmountTouched] = useState(false)

  const amountError = amountIssue(amount)
  const missingNodes = consumeNodes.length === 0 || flowNodes.length === 0
  const handleSubmit = () => {
    if (busy || missingNodes) return
    setAmountTouched(true)
    if (!consumeNodePubkey || !flowNodePubkey || amountError) return
    void onCreate({
      consumeNodePubkey,
      flowNodePubkey,
      amount: amount.trim(),
      currencyType: Number(currencyType),
    })
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="record-consume-node">消费节点（付款方）</FieldLabel>
          <Select value={consumeNodePubkey} onValueChange={setConsumeNodePubkey}>
            <SelectTrigger id="record-consume-node" className="w-full">
              <SelectValue placeholder="暂无消费节点，请先添加" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {consumeNodes.map((node) => (
                  <SelectItem key={node.publicKeyHex} value={node.publicKeyHex}>
                    {shortId(node.id)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="record-flow-node">流转节点（收款方）</FieldLabel>
          <Select value={flowNodePubkey} onValueChange={setFlowNodePubkey}>
            <SelectTrigger id="record-flow-node" className="w-full">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field data-invalid={amountTouched && amountError ? true : undefined}>
            <FieldLabel htmlFor="record-amount">金额</FieldLabel>
            <Input
              id="record-amount"
              name="amount"
              autoComplete="off"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              onBlur={() => setAmountTouched(true)}
              aria-invalid={amountTouched && amountError ? true : undefined}
              placeholder="例如 5000…"
            />
            {amountTouched && amountError ? <FieldError>{amountError}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="record-currency-type">币种</FieldLabel>
            <Select value={currencyType} onValueChange={setCurrencyType}>
              <SelectTrigger id="record-currency-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="1">CNY（分）</SelectItem>
                  <SelectItem value="0">Au（微克）</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FieldGroup>

      {missingNodes ? (
        <p className="text-sm text-muted-foreground">
          需要至少一个消费节点和一个流转节点才能创建记录。
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
        {createdRecordId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onMountToNode?.(createdRecordId)}
          >
            挂载至节点
          </Button>
        ) : null}
        <Button type="button" disabled={busy || missingNodes} onClick={handleSubmit}>
          {busy
            ? miningAttempts != null
              ? `挖矿 ${formatInteger(miningAttempts)}…`
              : '提交中…'
            : '创建记录'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function TransactionRecordDialog({
  open,
  onOpenChange,
  ...body
}: RecordDialogBodyProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>生成消费记录</DialogTitle>
          <DialogDescription>
            由消费节点（付款方）支付给流转节点（收款方）。难度目标与中心公钥自动取自最新区块。
          </DialogDescription>
        </DialogHeader>
        <RecordDialogBody {...body} />
      </DialogContent>
    </Dialog>
  )
}
