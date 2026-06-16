import { getPublicKeyFromPrivate } from '@nmsci/sdk'

export const INT64_MAX = 9223372036854775807n

export function assertKeypairIntegrity(node: {
  privateKeyHex: string
  publicKeyHex: string
}): void {
  if (getPublicKeyFromPrivate(node.privateKeyHex) !== node.publicKeyHex) {
    throw new Error('检测到密钥对损坏：存储的私钥与公钥不匹配。')
  }
}
