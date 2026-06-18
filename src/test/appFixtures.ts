import type { ConsumeChainResponseDTORaw } from '../lib/types'

export const queryNodeId = '11111111-1111-4111-8111-111111111111'
export const graphNodeAId = '22222222-2222-4222-8222-222222222222'
export const graphNodeBId = '33333333-3333-4333-8333-333333333333'
export const graphNodeCId = '44444444-4444-4444-8444-444444444444'
export const evidenceRecordId = '55555555-5555-4555-8555-555555555555'
export const evidenceMountId = '66666666-6666-4666-8666-666666666666'

export function chainRow(
  id: string,
  currencyType: number,
  start = graphNodeAId,
  end = graphNodeBId,
): ConsumeChainResponseDTORaw {
  return {
    consumeChain: {
      id,
      start,
      end,
      amount: 1200,
      currencyType,
      isLoop: false,
      tailMountTimestamp: 1_700_000_000_000_000,
    },
    consumeChainEdges: [
      {
        id: `${id}-edge`,
        source: start,
        target: end,
        amount: 1200,
        currencyType,
        chain: id,
        relatedTransactionRecord: evidenceRecordId,
        relatedTransactionMount: evidenceMountId,
        relatedTransactionMountTimestamp: 1_700_000_000_000_000,
        isLoop: false,
      },
    ],
  }
}

export function loopedChainRow(id: string): ConsumeChainResponseDTORaw {
  const row = chainRow(id, 1, graphNodeAId, graphNodeBId)
  row.consumeChain.isLoop = true
  row.consumeChainEdges = row.consumeChainEdges.map((edge) => ({ ...edge, isLoop: true }))
  return row
}

export function transactionRecord(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 2,
      amount: 5000,
      currencyType: 1,
      transactionDifficultyTarget: '1d00ffff',
      nonce: 1,
      consumeNodePubkey: '03'.padEnd(66, 'a'),
      flowNodePubkey: '02'.padEnd(66, 'b'),
      centralPubkey: '02'.padEnd(66, 'c'),
      consumeNodeSignature: 'aa',
      flowNodeSignature: 'bb',
      confirmTimestamp: 1_700_000_000_000_000,
      centralSignature: 'cc',
      rawBytes: '00',
      txid: 'recordtxid',
    },
  }
}

export function transactionMount(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 3,
      mountedTransactionRecordId: evidenceRecordId,
      transactionDifficultyTarget: '1d00ffff',
      nonce: 1,
      consumeNodePubkey: '03'.padEnd(66, 'a'),
      flowNodePubkey: '02'.padEnd(66, 'b'),
      centralPubkey: '02'.padEnd(66, 'c'),
      consumeNodeSignature: 'aa',
      flowNodeSignature: 'bb',
      confirmTimestamp: 1_700_000_000_000_000,
      centralSignature: 'cc',
      rawBytes: '00',
      txid: 'mounttxid',
    },
  }
}

export function flowNodeDetail(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 1,
      registerDifficultyTarget: '20ffffff',
      nonce: 7,
      flowNodePubkey: '02'.padEnd(66, '1'),
      flowNodeSignature: '1'.repeat(128),
      rawBytes: '00',
      txid: 'ab',
    },
  }
}
