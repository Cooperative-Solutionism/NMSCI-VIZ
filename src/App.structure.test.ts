import { describe, expect, it } from 'vitest'
import App from './App'
import FeatureApp from './app/App'

describe('App module boundary', () => {
  it('keeps the root App export wired to the feature app entrypoint', () => {
    expect(App).toBe(FeatureApp)
  })
})
