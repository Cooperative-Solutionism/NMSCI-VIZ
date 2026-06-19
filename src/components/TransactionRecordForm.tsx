import { useRef, useState } from 'react'
import { shortId } from '../lib/chainGraph'
import { formatInteger } from '../lib/format'
import { Button } from './ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from './ui/field'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'

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
  consumeNodes: Array<{ id: string; publicKeyHex: string; label: string }>
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
  const consumeNodeRef = useRef<HTMLButtonElement | null>(null)
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="record-consume-node">消费节点</FieldLabel>
          <Select
            name="consumeNodePubkey"
            value={consumeNodePubkey}
            onValueChange={setConsumeNodePubkey}
          >
            <SelectTrigger ref={consumeNodeRef} id="record-consume-node" className="w-full">
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

        <div className="form-grid">
          <Field data-invalid={amountTouched && amountError ? true : undefined}>
            <FieldLabel htmlFor="record-amount">金额</FieldLabel>
            <Input
              ref={amountRef}
              id="record-amount"
              name="amount"
              autoComplete="off"
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(event.currentTarget.value)}
              onBlur={() => setAmountTouched(true)}
              aria-invalid={amountTouched && amountError ? true : undefined}
              placeholder="例如 5000…"
            />
            {amountTouched && amountError ? <FieldError>{amountError}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="record-currency-type">记录币种</FieldLabel>
            <Select name="currencyType" value={currencyType} onValueChange={setCurrencyType}>
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

        <Field>
          <FieldLabel htmlFor="record-difficulty">交易难度</FieldLabel>
          <Input
            ref={difficultyRef}
            id="record-difficulty"
            name="difficultyHex"
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
            value={difficultyHex}
            onChange={(event) => setDifficultyHex(event.currentTarget.value)}
            placeholder="例如 1d00ffff…"
          />
        </Field>

        <Field data-invalid={centralTouched && centralError ? true : undefined}>
          <FieldLabel htmlFor="record-central-pubkey">记录中心公钥</FieldLabel>
          <Textarea
            ref={centralRef}
            id="record-central-pubkey"
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
          {centralTouched && centralError ? <FieldError>{centralError}</FieldError> : null}
        </Field>
      </FieldGroup>

      <Button type="button" disabled={busy} onClick={handleSubmit}>
        {busy
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '提交中…'
          : '创建记录'}
      </Button>
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
