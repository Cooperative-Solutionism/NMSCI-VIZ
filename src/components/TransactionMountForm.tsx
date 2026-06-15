import { useState } from 'react'
import { formatAmount, shortId } from '../lib/chainGraph'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import { Field } from './Field'

// 消费记录挂载表单：从已创建记录中选一条挂上链；成功后可一键查看生成的消费链（构建↔可视化闭环）。
export function TransactionMountForm({
  busy,
  canViewChain,
  defaultDifficulty,
  error,
  miningAttempts,
  onMount,
  onViewChain,
  records,
  status,
}: {
  busy: boolean
  canViewChain: boolean
  defaultDifficulty: string
  error: string | null
  miningAttempts: number | null
  onMount: (recordId: string, difficultyHex: string) => void
  onViewChain: () => void
  records: LocalTxRecord[]
  status: string | null
}) {
  const [recordId, setRecordId] = useState(records[0]?.id ?? '')
  const [difficultyHex, setDifficultyHex] = useState(defaultDifficulty)

  const ready = recordId.length > 0 && difficultyHex.trim().length > 0 && !busy

  return (
    <div className="record-form">
      <div className="section-title">Mount a record</div>
      <Field label="Record to mount">
        <select value={recordId} onChange={(event) => setRecordId(event.currentTarget.value)}>
          {records.length === 0 ? <option value="">No records — create one first</option> : null}
          {records.map((record) => (
            <option key={record.id} value={record.id}>
              {shortId(record.id)} · {formatAmount(BigInt(record.amount), record.currencyType)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mount difficulty">
        <input
          value={difficultyHex}
          onChange={(event) => setDifficultyHex(event.currentTarget.value)}
          placeholder="1d00ffff"
        />
      </Field>
      <button
        className="primary-button"
        type="button"
        disabled={!ready}
        onClick={() => onMount(recordId, difficultyHex.trim())}
      >
        {busy ? (miningAttempts != null ? `Mining ${miningAttempts.toLocaleString()}` : 'Submitting') : 'Mount record'}
      </button>
      {canViewChain ? (
        <button className="secondary-button" type="button" onClick={onViewChain}>
          View consume chain
        </button>
      ) : null}
      {status ? <p className="operation-message">{status}</p> : null}
      {error ? <p className="operation-message error">{error}</p> : null}
    </div>
  )
}
