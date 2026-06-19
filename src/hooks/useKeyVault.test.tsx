import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useKeyVault } from './useKeyVault'

const VAULT_KEY = 'nmsci.vault.v1'

// 模拟一份已建库的盐/校验串文档（值无需真实，只用于触发 loadVaultBlob 命中）。
function seedVaultBlob() {
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({ version: 1, salt: 'AAAAAAAAAAAAAAAAAAAAAA==', check: { iv: 'iv', ct: 'ct' } }),
  )
}

afterEach(() => localStorage.clear())

describe('useKeyVault startup decision', () => {
  it("defaults to 'disabled' with a null codec when no vault blob exists", () => {
    const { result } = renderHook(() => useKeyVault(localStorage))

    expect(result.current.status).toBe('disabled')
    expect(result.current.codec).toBeNull()
  })

  it("starts 'locked' with a codec when a vault blob already exists (returning user unchanged)", () => {
    seedVaultBlob()

    const { result } = renderHook(() => useKeyVault(localStorage))

    // 向后兼容不变量：已建库的用户绝不能落入新的 disabled 默认（否则会以明文重存其私钥）。
    expect(result.current.status).toBe('locked')
    expect(result.current.codec).not.toBeNull()
  })

  it('enable() moves disabled -> setup; codec becomes non-null', () => {
    const { result } = renderHook(() => useKeyVault(localStorage))

    act(() => result.current.enable())

    expect(result.current.status).toBe('setup')
    expect(result.current.codec).not.toBeNull()
  })

  it('disable() clears the blob and returns to disabled/plaintext', () => {
    seedVaultBlob()
    const { result } = renderHook(() => useKeyVault(localStorage))
    expect(result.current.status).toBe('locked')

    act(() => result.current.disable())

    expect(result.current.status).toBe('disabled')
    expect(result.current.codec).toBeNull()
    expect(localStorage.getItem(VAULT_KEY)).toBeNull()
  })
})
