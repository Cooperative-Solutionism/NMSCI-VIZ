import { useCallback, useMemo, useRef, useState } from 'react'
import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  randomSalt,
  type EncryptedSecret,
  type SecretCodec,
} from '../lib/keyVault'

export type { SecretCodec }

// 私钥保险库：口令派生的 AES-GCM 会话密钥只驻内存（useRef，不入 state、不持久化）。
// localStorage 仅存盐 + 一个用会话密钥加密的校验串（verifier）——解锁时解密 verifier 即可验证口令是否正确，
// 无需任何私钥在场。
export type VaultStatus = 'setup' | 'locked' | 'unlocked'

const VAULT_KEY = 'nmsci.vault.v1'
const VERIFIER_PLAINTEXT = 'nmsci-key-vault-verifier'

interface VaultBlob {
  version: 1
  salt: string
  check: EncryptedSecret
}

function loadVaultBlob(storage: Storage): VaultBlob | null {
  const raw = storage.getItem(VAULT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<VaultBlob>
    if (parsed.version !== 1 || typeof parsed.salt !== 'string' || !parsed.check) return null
    return parsed as VaultBlob
  } catch {
    return null
  }
}

export function useKeyVault(storage: Storage = window.localStorage) {
  const [status, setStatus] = useState<VaultStatus>(() => (loadVaultBlob(storage) ? 'locked' : 'setup'))
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)

  // 首次建库：生成盐、派生密钥、写入加密 verifier，并解锁本会话。
  const setup = useCallback(async (passphrase: string): Promise<boolean> => {
    setError(null)
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.')
      return false
    }
    try {
      const salt = randomSalt()
      const key = await deriveKey(passphrase, salt)
      const check = await encryptSecret(key, VERIFIER_PLAINTEXT)
      const blob: VaultBlob = { version: 1, salt, check }
      storage.setItem(VAULT_KEY, JSON.stringify(blob))
      keyRef.current = key
      setStatus('unlocked')
      return true
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Failed to create vault.')
      return false
    }
  }, [storage])

  // 解锁：用口令 + 存储盐派生密钥，解密 verifier 校验口令；错误口令会因 AES-GCM 认证失败而拒绝。
  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    setError(null)
    const blob = loadVaultBlob(storage)
    if (!blob) {
      setStatus('setup')
      return false
    }
    try {
      const key = await deriveKey(passphrase, blob.salt)
      const verified = await decryptSecret(key, blob.check)
      if (verified !== VERIFIER_PLAINTEXT) throw new Error('verifier mismatch')
      keyRef.current = key
      setStatus('unlocked')
      return true
    } catch {
      setError('Incorrect passphrase.')
      return false
    }
  }, [storage])

  const lock = useCallback(() => {
    keyRef.current = null
    setError(null)
    setStatus(loadVaultBlob(storage) ? 'locked' : 'setup')
  }, [storage])

  // 编解码器对象引用稳定（useMemo []）；加解密时读 keyRef.current，故始终用当前会话密钥，锁定时拒绝。
  const codec = useMemo<SecretCodec>(() => ({
    encrypt: (plaintext) =>
      keyRef.current
        ? encryptSecret(keyRef.current, plaintext)
        : Promise.reject(new Error('Key vault is locked.')),
    decrypt: (secret) =>
      keyRef.current
        ? decryptSecret(keyRef.current, secret)
        : Promise.reject(new Error('Key vault is locked.')),
  }), [])

  return useMemo(
    () => ({ status, error, setup, unlock, lock, codec }),
    [status, error, setup, unlock, lock, codec],
  )
}
