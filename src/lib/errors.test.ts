import { ApiClientError } from '@nmsci/sdk'
import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('includes useful ApiClientError details', () => {
    const error = new ApiClientError('Request failed', {
      status: 500,
      url: 'http://localhost:8080/consume-chains',
    })

    expect(errorMessage(error, 'Fallback')).toBe(
      'Request failed (status 500, http://localhost:8080/consume-chains)',
    )
  })

  it('falls back for non-Error values', () => {
    expect(errorMessage('broken', 'Fallback')).toBe('Fallback')
  })
})
