import { buildConsumeChainUrl } from './chainGraph'
import type {
  ApiResponse,
  ConsumeChainQuery,
  ConsumeChainResponseDTORaw,
  FlowNodeRegisterMsgRaw,
  SliceResponseDTO,
} from './types'

export async function fetchConsumeChains(
  baseUrl: string,
  query: ConsumeChainQuery,
  signal?: AbortSignal,
): Promise<SliceResponseDTO<ConsumeChainResponseDTORaw>> {
  const response = await fetch(buildConsumeChainUrl(baseUrl, query), { signal })
  const parsed = await response.json() as ApiResponse<SliceResponseDTO<ConsumeChainResponseDTORaw>>

  if (!response.ok) {
    throw new Error(formatBackendError(parsed, `HTTP ${response.status}`))
  }
  if (parsed.code !== 200) {
    throw new Error(formatBackendError(parsed, `Backend code ${parsed.code}`))
  }

  return parsed.data
}

export function buildFlowNodeDetailUrl(baseUrl: string, nodeId: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  return `${normalizedBaseUrl}/flow-node-register-msg/id/${encodeURIComponent(nodeId)}`
}

export async function fetchFlowNodeDetail(
  baseUrl: string,
  nodeId: string,
  signal?: AbortSignal,
): Promise<FlowNodeRegisterMsgRaw> {
  const response = await fetch(buildFlowNodeDetailUrl(baseUrl, nodeId), { signal })
  const parsed = await response.json() as ApiResponse<FlowNodeRegisterMsgRaw>

  if (!response.ok) {
    throw new Error(formatBackendError(parsed, `HTTP ${response.status}`))
  }
  if (parsed.code !== 200) {
    throw new Error(formatBackendError(parsed, `Backend code ${parsed.code}`))
  }

  return parsed.data
}

function formatBackendError(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (typeof response.data === 'string' && response.data.length > 0) {
    return `${response.message || fallback}: ${response.data}`
  }
  return response.message || fallback
}
