import { ApiClientError } from '@nmsci/sdk'

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    const details = [
      error.status === undefined ? null : `status ${error.status}`,
      error.url,
    ].filter((detail): detail is string => Boolean(detail))
    return details.length > 0 ? `${error.message} (${details.join(', ')})` : error.message
  }
  if (error instanceof Error) return error.message
  return fallback
}
