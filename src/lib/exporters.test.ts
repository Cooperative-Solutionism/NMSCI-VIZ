import { describe, expect, it } from 'vitest'
import { edgesToCsv, parseExportedConsumeChainsJson, rowsToJson, toCurl } from './exporters'
import type { ChainGraphEdge, ConsumeChainResponseDTO } from './types'

const edge: ChainGraphEdge = {
  id: 'e1',
  source: 'a',
  target: 'b',
  label: '50.00 CNY',
  amount: 5000n,
  currencyType: 1,
  chainId: 'chain, x',
  status: 'looped',
  color: '#000',
  relatedTransactionRecord: 'rec',
  relatedTransactionMount: 'mnt',
  relatedTransactionMountTimestamp: 1_700_000_000_000_000n,
}

describe('exporters', () => {
  it('emits a CSV header and quotes cells with commas', () => {
    const csv = edgesToCsv([edge])
    const [header, row] = csv.split('\n')
    expect(header).toBe('chainId,edgeId,source,target,amount,currencyType,status,record,mount,mountTimestamp')
    expect(row).toContain('"chain, x"')
    expect(row).toContain('5000')
    expect(row).toContain('1700000000000000')
  })

  it('serializes bigint fields as strings in JSON', () => {
    const rows: ConsumeChainResponseDTO[] = [
      {
        consumeChain: {
          id: 'c1',
          start: 'a',
          end: 'b',
          amount: 12500n,
          currencyType: 1,
          isLoop: true,
          tailMountTimestamp: 1_700_000_000_000_000n,
        },
        consumeChainEdges: [],
      },
    ]
    const json = JSON.parse(rowsToJson(rows)) as Array<{ consumeChain: { amount: string } }>
    expect(json[0]!.consumeChain.amount).toBe('12500')
  })

  it('builds a curl command escaping single quotes', () => {
    expect(toCurl('/api/consume-chains?nodeId=x')).toBe("curl '/api/consume-chains?nodeId=x'")
    expect(toCurl("a'b")).toBe("curl 'a'\\''b'")
  })
})

describe('parseExportedConsumeChainsJson', () => {
  const rows: ConsumeChainResponseDTO[] = [
    {
      consumeChain: {
        id: 'c1',
        start: 'a',
        end: 'b',
        amount: 12500n,
        currencyType: 1,
        isLoop: true,
        tailMountTimestamp: 1_700_000_000_000_000n,
      },
      consumeChainEdges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          amount: 12500n,
          currencyType: 1,
          chain: 'c1',
          relatedTransactionRecord: 'r',
          relatedTransactionMount: 'm',
          relatedTransactionMountTimestamp: 1_700_000_000_000_001n,
          isLoop: true,
        },
      ],
    },
  ]

  it('round-trips rowsToJson output back to equivalent bigint rows', () => {
    const { content, skipped } = parseExportedConsumeChainsJson(rowsToJson(rows))
    expect(skipped).toBe(0)
    expect(content).toEqual(rows)
  })

  it('throws when the top-level JSON is not an array', () => {
    expect(() => parseExportedConsumeChainsJson('{"consumeChain":{}}')).toThrow()
  })

  it('skips malformed rows and counts them while keeping valid ones', () => {
    const serialized = JSON.parse(rowsToJson(rows)) as unknown[]
    const mixed = JSON.stringify([{ nope: true }, ...serialized])
    const { content, skipped } = parseExportedConsumeChainsJson(mixed)
    expect(skipped).toBe(1)
    expect(content).toEqual(rows)
  })
})
