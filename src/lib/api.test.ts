import { describe, expect, it } from 'vitest'
import { buildFlowNodeDetailUrl } from './api'

describe('api helpers', () => {
  it('builds flow node detail urls through the configured api base', () => {
    expect(buildFlowNodeDetailUrl('/api', 'abcdef11-1111-4111-8111-111111111111'))
      .toBe('/api/flow-node-register-msg/id/abcdef11-1111-4111-8111-111111111111')

    expect(buildFlowNodeDetailUrl('http://localhost:8080/', 'node 1'))
      .toBe('http://localhost:8080/flow-node-register-msg/id/node%201')
  })
})
