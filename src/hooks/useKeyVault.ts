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
//
// 状态机：
//   disabled —— 保险库关闭（默认）。私钥以明文存储，操作无需口令；codec 为 null，存储层走明文路径。
//   setup    —— 用户已选择启用、尚未设置口令的过渡态。
//   locked   —— 已启用且存在盐/校验串，但当前会话未解锁。
//   unlocked —— 已启用且会话密钥在内存中。
export type VaultStatus = 'disabled' | 'setup' | 'locked' | 'unlocked'

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
  // 默认关闭：仅当此前已建库（存在盐/校验串）才以 locked 启动，否则保持 disabled 由用户自行启用。
  const [status, setStatus] = useState<VaultStatus>(() =>
    loadVaultBlob(storage) ? 'locked' : 'disabled',
  )
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)

  // 启用保险库：进入设置态，等待用户创建口令（随后 setup 完成迁移加密）。
  const enable = useCallback(() => {
    setError(null)
    setStatus((current) => (current === 'disabled' ? 'setup' : current))
  }, [])

  // 关闭保险库：清空会话密钥与盐/校验串，回到明文模式。
  // 调用方（控制器）负责在此之前把内存中的明文私钥以明文重存。
  const disable = useCallback(() => {
    keyRef.current = null
    storage.removeItem(VAULT_KEY)
    setError(null)
    setStatus('disabled')
  }, [storage])

  // 首次建库：生成盐、派生密钥、写入加密 verifier，并解锁本会话。
  const setup = useCallback(
    async (passphrase: string): Promise<boolean> => {
      setError(null)
      if (passphrase.length < 8) {
        setError('口令至少需要 8 个字符。')
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
        setError(setupError instanceof Error ? setupError.message : '创建保险库失败。')
        return false
      }
    },
    [storage],
  )

  // 解锁：用口令 + 存储盐派生密钥，解密 verifier 校验口令；错误口令会因 AES-GCM 认证失败而拒绝。
  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
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
        setError('口令不正确。')
        return false
      }
    },
    [storage],
  )

  const lock = useCallback(() => {
    keyRef.current = null
    setError(null)
    setStatus(loadVaultBlob(storage) ? 'locked' : 'disabled')
  }, [storage])

  // codec 在关闭态为 null（存储层据此走明文路径）；启用态下加解密读 keyRef.current，锁定时拒绝。
  const codec = useMemo<SecretCodec | null>(() => {
    if (status === 'disabled') return null
    return {
      encrypt: (plaintext) =>
        keyRef.current
          ? encryptSecret(keyRef.current, plaintext)
          : Promise.reject(new Error('密钥保险库已锁定。')),
      decrypt: (secret) =>
        keyRef.current
          ? decryptSecret(keyRef.current, secret)
          : Promise.reject(new Error('密钥保险库已锁定。')),
    }
  }, [status])

  return useMemo(
    () => ({ status, error, setup, unlock, lock, enable, disable, codec }),
    [status, error, setup, unlock, lock, enable, disable, codec],
  )
}
