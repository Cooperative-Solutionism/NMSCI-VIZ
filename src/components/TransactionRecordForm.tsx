import { useRef, useState } from 'react'
import { formatInteger } from '../lib/format'
import { Field } from './Field'

export interface TransactionRecordDraft {
  consumeNodePubkey: string
  amount: string
  currencyType: number
  centralPubkey: string
  difficultyHex: string
}

const INT64_MAX = 9223372036854775807n

function amountIssue(raw: string): string | null {
  const value = raw.trim()
  if (!/^[0-9]+$/.test(value)) return '金额必须是非负整数（最小单位）。'
  const parsed = BigInt(value)
  if (parsed < 1n) return '金额至少为 1。'
  if (parsed > INT64_MAX) return '金额超出 int64 协议范围。'
  return null
}

function centralPubkeyIssue(raw: string): string | null {
  return /^0[23][0-9a-fA-F]{64}$/.test(raw.trim())
    ? null
    : '中心公钥必须是 33 字节压缩公钥：02/03 + 64 位 hex。'
}

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
  const consumeNodeRef = useRef<HTMLSelectElement | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const difficultyRef = useRef<HTMLInputElement | null>(null)
  const centralRef = useRef<HTMLTextAreaElement | null>(null)

  const amountError = amountIssue(amount)
  const centralError = centralPubkeyIssue(centralPubkey)
  const handleSubmit = () => {
    if (busy) return
    setAmountTouched(true)
    setCentralTouched(true)
    if (consumeNodePubkey.length === 0) {
      consumeNodeRef.current?.focus()
      return
    }
    if (amountError) {
      amountRef.current?.focus()
      return
    }
    if (difficultyHex.trim().length === 0) {
      difficultyRef.current?.focus()
      return
    }
    if (centralError) {
      centralRef.current?.focus()
      return
    }
    onCreate({
      consumeNodePubkey,
      amount: amount.trim(),
      currencyType: Number(currencyType),
      centralPubkey: centralPubkey.trim(),
      difficultyHex: difficultyHex.trim(),
    })
  }

  return (
    <div className="record-form">
      <div className="section-title">新建交易记录</div>
      <Field label="消费节点">
        <select
          ref={consumeNodeRef}
          name="consumeNodePubkey"
          autoComplete="off"
          value={consumeNodePubkey}
          onChange={(event) => setConsumeNodePubkey(event.currentTarget.value)}
        >
          {consumeNodes.length === 0 ? <option value="">暂无消费节点，请先添加</option> : null}
          {consumeNodes.map((node) => (
            <option key={node.publicKeyHex} value={node.publicKeyHex}>
              {node.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="金额">
          <input
            ref={amountRef}
            name="amount"
            autoComplete="off"
            value={amount}
            inputMode="numeric"
            onChange={(event) => setAmount(event.currentTarget.value)}
            onBlur={() => setAmountTouched(true)}
            aria-invalid={amountTouched && amountError ? true : undefined}
            placeholder="例如 5000…"
          />
          {amountTouched && amountError ? (
            <span className="field-error" role="alert">
              {amountError}
            </span>
          ) : null}
        </Field>
        <Field label="记录币种">
          <select
            name="currencyType"
            autoComplete="off"
            value={currencyType}
            onChange={(event) => setCurrencyType(event.currentTarget.value)}
          >
            <option value="1">CNY（分）</option>
            <option value="0">Au（微克）</option>
          </select>
        </Field>
      </div>
      <Field label="交易难度">
        <input
          ref={difficultyRef}
          name="difficultyHex"
          autoComplete="off"
          inputMode="text"
          spellCheck={false}
          value={difficultyHex}
          onChange={(event) => setDifficultyHex(event.currentTarget.value)}
          placeholder="例如 1d00ffff…"
        />
      </Field>
      <Field label="记录中心公钥">
        <textarea
          ref={centralRef}
          name="centralPubkey"
          autoComplete="off"
          rows={2}
          value={centralPubkey}
          spellCheck={false}
          onChange={(event) => setCentralPubkey(event.currentTarget.value)}
          onBlur={() => setCentralTouched(true)}
          aria-invalid={centralTouched && centralError ? true : undefined}
          placeholder="例如 02 后接 64 位 hex…"
        />
        {centralTouched && centralError ? (
          <span className="field-error" role="alert">
            {centralError}
          </span>
        ) : null}
      </Field>
      <button className="primary-button" type="button" disabled={busy} onClick={handleSubmit}>
        {busy
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '提交中…'
          : '创建记录'}
      </button>
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
