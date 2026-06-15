// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { decryptSecret, deriveKey, encryptSecret, randomSalt } from './keyVault'

describe('keyVault', () => {
  it('round-trips a secret through derive → encrypt → decrypt', async () => {
    const salt = randomSalt()
    const key = await deriveKey('correct horse battery staple', salt)
    const secret = await encryptSecret(key, '0'.repeat(63) + '1')
    expect(secret.iv).toBeTruthy()
    expect(secret.ct).toBeTruthy()
    await expect(decryptSecret(key, secret)).resolves.toBe('0'.repeat(63) + '1')
  })

  it('never stores the plaintext in the ciphertext payload', async () => {
    const key = await deriveKey('pw', randomSalt())
    const plaintext = 'deadbeef'.repeat(8)
    const secret = await encryptSecret(key, plaintext)
    expect(secret.ct).not.toContain(plaintext)
  })

  it('fails to decrypt with the wrong passphrase (AES-GCM auth tag)', async () => {
    const salt = randomSalt()
    const good = await deriveKey('right-pass', salt)
    const bad = await deriveKey('wrong-pass', salt)
    const secret = await encryptSecret(good, 'secret-material')
    await expect(decryptSecret(bad, secret)).rejects.toBeDefined()
  })

  it('uses a fresh random IV per encryption (no nonce reuse)', async () => {
    const key = await deriveKey('pw', randomSalt())
    const a = await encryptSecret(key, 'same-plaintext')
    const b = await encryptSecret(key, 'same-plaintext')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
  })

  it('derives different keys for different salts', async () => {
    const key1 = await deriveKey('pw', randomSalt())
    const secret = await encryptSecret(key1, 'x')
    const key2 = await deriveKey('pw', randomSalt())
    // 不同盐 → 不同密钥 → 无法解开另一把密钥的密文。
    await expect(decryptSecret(key2, secret)).rejects.toBeDefined()
  })

  it('generates 16-byte salts encoded as base64', () => {
    const salt = randomSalt()
    expect(atob(salt).length).toBe(16)
    expect(randomSalt()).not.toBe(salt)
  })
})
