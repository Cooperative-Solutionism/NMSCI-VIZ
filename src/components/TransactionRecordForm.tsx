import { useState } from 'react'
import { Field } from './Field'

export interface TransactionRecordDraft {
  consumeNodePubkey: string
  amount: string
  currencyType: number
  centralPubkey: string
  difficultyHex: string
}

// 消费记录创建表单（在流转节点操作面板中展开）：来源消费节点 + 金额 + 币种 + 交易难度 + 中心公钥。
export function TransactionRecordForm({
  busy,
  consumeNodes,
  defaultCentralPubkey,
  defaultDifficulty,
  error,
  miningAttempts,
  onCreate,
  status,
}: {
  busy: boolean
  consumeNodes: Array<{ publicKeyHex: string; label: string }>
  defaultCentralPubkey: string
  defaultDifficulty: string
  error: string | null
  miningAttempts: number | null
  onCreate: (draft: TransactionRecordDraft) => void
  status: string | null
}) {
  const [consumeNodePubkey, setConsumeNodePubkey] = useState(consumeNodes[0]?.publicKeyHex ?? '')
  const [amount, setAmount] = useState('')
  const [currencyType, setCurrencyType] = useState('1')
  const [centralPubkey, setCentralPubkey] = useState(defaultCentralPubkey)
  const [difficultyHex, setDifficultyHex] = useState(defaultDifficulty)

  const ready =
    consumeNodePubkey.length > 0
    && /^[0-9]+$/.test(amount.trim())
    && centralPubkey.trim().length > 0
    && difficultyHex.trim().length > 0
    && !busy

  return (
    <div className="record-form">
      <div className="section-title">New transaction record</div>
      <Field label="Consume node">
        <select value={consumeNodePubkey} onChange={(event) => setConsumeNodePubkey(event.currentTarget.value)}>
          {consumeNodes.length === 0 ? <option value="">No consume nodes — add one first</option> : null}
          {consumeNodes.map((node) => (
            <option key={node.publicKeyHex} value={node.publicKeyHex}>
              {node.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Amount">
          <input
            value={amount}
            inputMode="numeric"
            onChange={(event) => setAmount(event.currentTarget.value)}
            placeholder="smallest unit"
          />
        </Field>
        <Field label="Record currency">
          <select value={currencyType} onChange={(event) => setCurrencyType(event.currentTarget.value)}>
            <option value="1">CNY (cent)</option>
            <option value="0">Au (ug)</option>
          </select>
        </Field>
      </div>
      <Field label="Transaction difficulty">
        <input
          value={difficultyHex}
          onChange={(event) => setDifficultyHex(event.currentTarget.value)}
          placeholder="1d00ffff"
        />
      </Field>
      <Field label="Record central pubkey">
        <textarea
          rows={2}
          value={centralPubkey}
          spellCheck={false}
          onChange={(event) => setCentralPubkey(event.currentTarget.value)}
          placeholder="33-byte compressed public key hex"
        />
      </Field>
      <button
        className="primary-button"
        type="button"
        disabled={!ready}
        onClick={() =>
          onCreate({
            consumeNodePubkey,
            amount: amount.trim(),
            currencyType: Number(currencyType),
            centralPubkey: centralPubkey.trim(),
            difficultyHex: difficultyHex.trim(),
          })
        }
      >
        {busy ? (miningAttempts != null ? `Mining ${miningAttempts.toLocaleString()}` : 'Submitting') : 'Create record'}
      </button>
      {status ? <p className="operation-message">{status}</p> : null}
      {error ? <p className="operation-message error">{error}</p> : null}
    </div>
  )
}
