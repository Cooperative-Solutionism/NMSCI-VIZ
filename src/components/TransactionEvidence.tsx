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
      setError(errorMessage(evidenceError, '加载交易证据失败'))
    }
  }, [client, mountId, recordId])

  return (
    <div className="evidence-block">
      <div className="section-title">交易证据</div>
      {!record && status === 'idle' ? (
        <button className="secondary-button" type="button" onClick={() => void loadEvidence()}>
          打开交易
        </button>
      ) : null}
      {status === 'loading' ? <div className="detail-state">正在加载交易...</div> : null}
      {status === 'error' ? <div className="detail-state error">{error}</div> : null}
      {record ? (
        <>
          <DetailRow label="金额" value={formatAmount(record.amount, record.currencyType)} />
          <DetailRow label="消费节点" value={<code>{record.consumeNodePubkey}</code>} />
          <DetailRow label="流转节点" value={<code>{record.flowNodePubkey}</code>} />
          <DetailRow label="中心公钥" value={<code>{record.centralPubkey}</code>} />
          <DetailRow label="确认时间" value={formatMicros(record.confirmTimestamp)} />
          <DetailRow label="记录 txid" value={<code>{record.txid}</code>} />
        </>
      ) : null}
      {mount ? <DetailRow label="挂载 txid" value={<code>{mount.txid}</code>} /> : null}
    </div>
  )
}
