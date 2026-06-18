import { useRef, useState } from 'react'
import { flowNodeDisplayName, formatAmount, shortId } from '../lib/chainGraph'
import { formatInteger } from '../lib/format'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import { Field } from './Field'

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
  const recordRef = useRef<HTMLSelectElement | null>(null)
  const flowNodeRef = useRef<HTMLSelectElement | null>(null)
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
      <Field label="待挂载记录">
        <select
          ref={recordRef}
          name="mountedRecordId"
          autoComplete="off"
          value={selectedRecordId}
          onChange={(event) => setRecordId(event.currentTarget.value)}
        >
          {records.length === 0 ? <option value="">暂无记录，请先创建</option> : null}
          {records.map((record) => (
            <option key={record.id} value={record.id}>
              {shortId(record.id)} · {formatAmount(BigInt(record.amount), record.currencyType)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="挂载流转节点">
        <select
          ref={flowNodeRef}
          name="mountFlowNodePubkey"
          autoComplete="off"
          value={selectedFlowNodePubkey}
          onChange={(event) => setFlowNodePubkey(event.currentTarget.value)}
        >
          {flowNodes.length === 0 ? <option value="">暂无流转节点，请先添加</option> : null}
          {flowNodes.map((node, index) => (
            <option key={node.publicKeyHex} value={node.publicKeyHex}>
              {flowNodeDisplayName(node, index)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="挂载难度">
        <input
          ref={difficultyRef}
          name="mountDifficultyHex"
          autoComplete="off"
          inputMode="text"
          spellCheck={false}
          value={difficultyHex}
          onChange={(event) => setDifficultyHex(event.currentTarget.value)}
          placeholder="例如 1d00ffff…"
        />
      </Field>
      <button className="primary-button" type="button" disabled={busy} onClick={handleSubmit}>
        {busy
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '提交中…'
          : '提交挂载'}
      </button>
      {canViewChain ? (
        <button className="secondary-button" type="button" onClick={onViewChain}>
          查看消费链
        </button>
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
    : records[0]?.id ?? ''
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
