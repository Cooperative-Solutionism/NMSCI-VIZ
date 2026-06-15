import { useState } from 'react'
import { Field } from './Field'

export interface TransactionRecordDraft {
  consumeNodePubkey: string
  amount: string
  currencyType: number
  centralPubkey: string
  difficultyHex: string
}

// 协议金额按 int64 序列化；客户端先做结构上界校验，避免非法值挖矿后才被后端拒绝。
const INT64_MAX = 9223372036854775807n

function amountIssue(raw: string): string | null {
  const value = raw.trim()
  if (!/^[0-9]+$/.test(value)) return 'Amount must be a non-negative integer (smallest unit).'
  const parsed = BigInt(value)
  if (parsed < 1n) return 'Amount must be at least 1.'
  if (parsed > INT64_MAX) return 'Amount exceeds the int64 protocol range.'
  return null
}

// 轻量格式校验（压缩公钥：02/03 前缀 + 64 hex）；曲线点合法性由构建消息时的 pubkeyToBytes 兜底。
function centralPubkeyIssue(raw: string): string | null {
  return /^0[23][0-9a-fA-F]{64}$/.test(raw.trim())
    ? null
    : 'Central pubkey must be a 33-byte compressed key: 02/03 + 64 hex.'
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
  const [amountTouched, setAmountTouched] = useState(false)
  const [centralTouched, setCentralTouched] = useState(false)

  const amountError = amountIssue(amount)
  const centralError = centralPubkeyIssue(centralPubkey)
  const ready =
    consumeNodePubkey.length > 0
    && !amountError
    && !centralError
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
            onBlur={() => setAmountTouched(true)}
            aria-invalid={amountTouched && amountError ? true : undefined}
            placeholder="smallest unit"
          />
          {amountTouched && amountError ? (
            <span className="field-error" role="alert">{amountError}</span>
          ) : null}
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
          onBlur={() => setCentralTouched(true)}
          aria-invalid={centralTouched && centralError ? true : undefined}
          placeholder="33-byte compressed public key hex"
        />
        {centralTouched && centralError ? (
          <span className="field-error" role="alert">{centralError}</span>
        ) : null}
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
