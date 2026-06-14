import {
  ApiClient,
  getTransactionMountMsgById,
  getTransactionRecordMsgById,
  type TransactionMountMsgRaw,
  type TransactionRecordMsgRaw,
} from '@nmsci/sdk'
import { useCallback, useMemo, useState } from 'react'
import { formatAmount } from '../lib/chainGraph'
import { errorMessage } from '../lib/errors'
import { formatMicros } from '../lib/format'
import { DetailRow } from './DetailRow'

// 把边上的交易记录/挂载 UUID 变成可下钻的链上证据（API.md §8），不再是死胡同。
export function TransactionEvidence({
  apiBase,
  mountId,
  recordId,
}: {
  apiBase: string
  mountId: string
  recordId: string
}) {
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const [record, setRecord] = useState<TransactionRecordMsgRaw | null>(null)
  const [mount, setMount] = useState<TransactionMountMsgRaw | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const loadEvidence = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const [recordRes, mountRes] = await Promise.all([
        getTransactionRecordMsgById(client, recordId),
        getTransactionMountMsgById(client, mountId),
      ])
      setRecord(recordRes.data)
      setMount(mountRes.data)
      setStatus('idle')
    } catch (evidenceError) {
      setStatus('error')
      setError(errorMessage(evidenceError, 'Failed to load transaction evidence'))
    }
  }, [client, mountId, recordId])

  return (
    <div className="evidence-block">
      <div className="section-title">Transaction evidence</div>
      {!record && status === 'idle' ? (
        <button className="secondary-button" type="button" onClick={() => void loadEvidence()}>
          Open transaction
        </button>
      ) : null}
      {status === 'loading' ? <div className="detail-state">Loading transaction...</div> : null}
      {status === 'error' ? <div className="detail-state error">{error}</div> : null}
      {record ? (
        <>
          <DetailRow label="Amount" value={formatAmount(record.amount, record.currencyType)} />
          <DetailRow label="Consume node" value={<code>{record.consumeNodePubkey}</code>} />
          <DetailRow label="Flow node" value={<code>{record.flowNodePubkey}</code>} />
          <DetailRow label="Central" value={<code>{record.centralPubkey}</code>} />
          <DetailRow label="Confirmed" value={formatMicros(record.confirmTimestamp)} />
          <DetailRow label="Record txid" value={<code>{record.txid}</code>} />
        </>
      ) : null}
      {mount ? <DetailRow label="Mount txid" value={<code>{mount.txid}</code>} /> : null}
    </div>
  )
}
