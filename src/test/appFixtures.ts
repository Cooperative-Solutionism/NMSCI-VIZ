import type { ConsumeChainResponseDTORaw } from '../lib/types'

export function chainRow(
  id: string,
  currencyType: number,
  start = 'node-a',
  end = 'node-b',
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
        relatedTransactionRecord: `${id}-record`,
        relatedTransactionMount: `${id}-mount`,
        relatedTransactionMountTimestamp: 1_700_000_000_000_000,
        isLoop: false,
      },
    ],
  }
}

export function loopedChainRow(id: string): ConsumeChainResponseDTORaw {
  const row = chainRow(id, 1, 'node-a', 'node-b')
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
      mountedTransactionRecordId: 'chain-1-record',
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
