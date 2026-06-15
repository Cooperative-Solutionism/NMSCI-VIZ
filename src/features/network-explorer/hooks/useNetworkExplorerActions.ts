import { useCallback } from 'react'
import { downloadText } from '../../../shared/utils/downloadText'
import { edgesToCsv, rowsToJson, toCurl } from '../../../lib/exporters'
import { errorMessage } from '../../../lib/errors'
import type { ChainGraphEdge, ConsumeChainResponseDTO, QueryMode } from '../../../lib/types'

export function useNetworkExplorerActions({
  filteredRows,
  graphEdges,
  notifyError,
  notifyStatus,
  requestUrl,
  setMode,
  setNodeId,
}: {
  filteredRows: ConsumeChainResponseDTO[]
  graphEdges: ChainGraphEdge[]
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  requestUrl: string
  setMode: (mode: QueryMode) => void
  setNodeId: (nodeId: string) => void
}) {
  const handleExportCsv = useCallback(() => {
    downloadText('consume-chain-edges.csv', 'text/csv;charset=utf-8', edgesToCsv(graphEdges))
  }, [graphEdges])

  const handleExportJson = useCallback(() => {
    downloadText('consume-chains.json', 'application/json', rowsToJson(filteredRows))
  }, [filteredRows])

  const handleCopyCurl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toCurl(requestUrl))
      notifyStatus('Request curl copied.')
    } catch (clipboardError) {
      notifyError(errorMessage(clipboardError, 'Clipboard unavailable'))
    }
  }, [notifyError, notifyStatus, requestUrl])

  const handlePickNode = useCallback(
    (pubkey: string) => {
      setMode('node')
      setNodeId(pubkey)
      notifyStatus('Picked node public key filled into query - click Load.')
    },
    [notifyStatus, setMode, setNodeId],
  )

  return {
    handleCopyCurl,
    handleExportCsv,
    handleExportJson,
    handlePickNode,
  }
}
