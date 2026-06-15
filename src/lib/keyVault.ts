// 生产级私钥静态加密原语：口令经 PBKDF2(SHA-256) 派生出 AES-GCM 会话密钥，用于加密本地私钥。
// 仅密文（iv + ct）落 localStorage；派生出的 CryptoKey 只存活在内存的解锁会话期，绝不持久化。
// 本模块为纯加密层（不触 localStorage / React），可在浏览器与 Node 下运行，便于单测。

// PBKDF2 迭代数：贴近 OWASP 对 PBKDF2-HMAC-SHA256 的当前建议量级，平衡安全与解锁延迟。
const PBKDF2_ITERATIONS = 210_000
const SALT_BYTES = 16
const IV_BYTES = 12
const AES_KEY_BITS = 256

// 单条加密私钥的存储形态（base64 编码，JSON 友好）。
export interface EncryptedSecret {
  iv: string
  ct: string
}

function getCrypto(): Crypto {
  // 浏览器为 window.crypto；Node 20+ 为全局 webcrypto。两处都暴露在 globalThis.crypto。
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is unavailable in this environment.')
  }
  return cryptoObj
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// 返回类型显式标注 <ArrayBuffer>：裸 Uint8Array 会被 TS 6 视为 <ArrayBufferLike>，
// 而 Web Crypto 的 BufferSource 参数要求非共享 ArrayBuffer 背衬。
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

// 每个保险库一份随机盐（与密文同存，非机密）；换盐即换派生密钥。
export function randomSalt(): string {
  const salt = new Uint8Array(SALT_BYTES)
  getCrypto().getRandomValues(salt)
  return toBase64(salt)
}

// 由口令 + 盐派生不可导出的 AES-GCM 密钥。extractable=false 确保密钥无法被读出内存。
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const subtle = getCrypto().subtle
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

// 用每次随机的 IV 加密；AES-GCM 自带完整性标签，错误口令/篡改会让 decrypt 抛错。
export async function encryptSecret(key: CryptoKey, plaintext: string): Promise<EncryptedSecret> {
  const iv = new Uint8Array(IV_BYTES)
  getCrypto().getRandomValues(iv)
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ciphertext)) }
}

export async function decryptSecret(key: CryptoKey, secret: EncryptedSecret): Promise<string> {
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(secret.iv) },
    key,
    fromBase64(secret.ct),
  )
  return new TextDecoder().decode(plaintext)
}
