import { buildConsumeChainUrl } from './chainGraph'
import type {
  ApiResponse,
  ConsumeChainQuery,
  ConsumeChainResponseDTORaw,
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
    throw new Error(parsed.message || `HTTP ${response.status}`)
  }
  if (parsed.code !== 200) {
    throw new Error(parsed.message || `Backend code ${parsed.code}`)
  }

  return parsed.data
}
