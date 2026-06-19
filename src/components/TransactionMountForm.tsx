import { useRef, useState } from 'react'
import { flowNodeDisplayName, formatAmount, shortId } from '../lib/chainGraph'
import { formatInteger } from '../lib/format'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import { Button } from './ui/button'
import { Field, FieldGroup, FieldLabel } from './ui/field'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

export function TransactionMountForm({
  busy,
  canViewChain,
  defaultDifficulty,
  defaultFlowNodePubkey,
  error,
  flowNodes,
  miningAttempts,
  onMount,
  onViewChain,
  records,
  status,
}: {
  busy: boolean
  canViewChain: boolean
  defaultDifficulty: string
  defaultFlowNodePubkey: string
  error: string | null
  flowNodes: LocalFlowNode[]
  miningAttempts: number | null
  onMount: (recordId: string, flowNodePubkey: string, difficultyHex: string) => void
  onViewChain: () => void
  records: LocalTxRecord[]
  status: string | null
}) {
  const [recordId, setRecordId] = useState(records[0]?.id ?? '')
  const [flowNodePubkey, setFlowNodePubkey] = useState(defaultFlowNodePubkey)
  const [difficultyHex, setDifficultyHex] = useState(defaultDifficulty)
  const recordRef = useRef<HTMLButtonElement | null>(null)
  const flowNodeRef = useRef<HTMLButtonElement | null>(null)
  const difficultyRef = useRef<HTMLInputElement | null>(null)
  const selectedRecordId = resolveSelectedRecord(records, recordId)
  const selectedFlowNodePubkey = resolveSelectedFlowNode(
    flowNodes,
    flowNodePubkey,
    defaultFlowNodePubkey,
  )

  const handleSubmit = () => {
    if (busy) return
    if (selectedRecordId.length === 0) {
      recordRef.current?.focus()
      return
    }
    if (selectedFlowNodePubkey.length === 0) {
      flowNodeRef.current?.focus()
      return
    }
    if (difficultyHex.trim().length === 0) {
      difficultyRef.current?.focus()
      return
    }
    onMount(selectedRecordId, selectedFlowNodePubkey, difficultyHex.trim())
  }

  return (
    <div className="record-form">
      <div className="section-title">挂载记录</div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="mount-record-id">待挂载记录</FieldLabel>
          <Select name="mountedRecordId" value={selectedRecordId} onValueChange={setRecordId}>
            <SelectTrigger ref={recordRef} id="mount-record-id" className="w-full">
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
          <Select
            name="mountFlowNodePubkey"
            value={selectedFlowNodePubkey}
            onValueChange={setFlowNodePubkey}
          >
            <SelectTrigger ref={flowNodeRef} id="mount-flow-node" className="w-full">
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

        <Field>
          <FieldLabel htmlFor="mount-difficulty">挂载难度</FieldLabel>
          <Input
            ref={difficultyRef}
            id="mount-difficulty"
            name="mountDifficultyHex"
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
            value={difficultyHex}
            onChange={(event) => setDifficultyHex(event.currentTarget.value)}
            placeholder="例如 1d00ffff…"
          />
        </Field>
      </FieldGroup>

      <Button type="button" disabled={busy} onClick={handleSubmit}>
        {busy
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '提交中…'
          : '提交挂载'}
      </Button>
      {canViewChain ? (
        <Button variant="secondary" type="button" onClick={onViewChain}>
          查看消费链
        </Button>
      ) : null}
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

function resolveSelectedRecord(records: LocalTxRecord[], currentRecordId: string): string {
  return records.some((record) => record.id === currentRecordId)
    ? currentRecordId
    : (records[0]?.id ?? '')
}

function resolveSelectedFlowNode(
  flowNodes: LocalFlowNode[],
  currentFlowNodePubkey: string,
  defaultFlowNodePubkey: string,
): string {
  if (flowNodes.some((node) => node.publicKeyHex === currentFlowNodePubkey)) {
    return currentFlowNodePubkey
  }
  if (flowNodes.some((node) => node.publicKeyHex === defaultFlowNodePubkey)) {
    return defaultFlowNodePubkey
  }
  return flowNodes[0]?.publicKeyHex ?? ''
}
