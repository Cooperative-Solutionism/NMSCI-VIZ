import { describe, expect, test } from 'vitest'
import type { UserConfig } from 'vite'
import configFactory from '../vite.config'

function resolveConfig(): UserConfig {
  if (typeof configFactory === 'function') {
    return configFactory({ command: 'serve', mode: 'development', isSsrBuild: false, isPreview: false }) as UserConfig
  }

  return configFactory as UserConfig
}

describe('Vite React dependency config', () => {
  test('keeps React and the renderer resolved as a singleton', () => {
    const config = resolveConfig()

    expect(config.resolve?.dedupe).toEqual(expect.arrayContaining(['react', 'react-dom']))
  })

  test('prebundles React entrypoints in the same optimized dependency graph', () => {
    const config = resolveConfig()

    expect(config.optimizeDeps?.include).toEqual(
      expect.arrayContaining(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime']),
    )
  })
})
