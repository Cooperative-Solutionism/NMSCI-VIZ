import { generateKeyPair, getPublicKeyFromPrivate } from '@nmsci/sdk'
import { shortId } from '../../../lib/chainGraph'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import { makeMessageId } from '../../../lib/messageBuilders'

export function createLocalFlowNode(position?: { x: number; y: number }): LocalFlowNode {
  const keypair = generateKeyPair()
  return makeLocalFlowNode(keypair.privateKey, keypair.publicKey, position)
}

export function createLocalConsumeNode(position?: { x: number; y: number }): LocalConsumeNode {
  const keypair = generateKeyPair()
  const now = new Date().toISOString()
  return {
    id: makeMessageId(),
    label: shortId(keypair.publicKey),
    privateKeyHex: keypair.privateKey,
    publicKeyHex: keypair.publicKey,
    createdAt: now,
    updatedAt: now,
    position,
  }
}

export function importLocalFlowNode(privateKeyHex: string): LocalFlowNode {
  return makeLocalFlowNode(privateKeyHex, getPublicKeyFromPrivate(privateKeyHex))
}

function makeLocalFlowNode(
  privateKeyHex: string,
  publicKeyHex: string,
  position?: { x: number; y: number },
): LocalFlowNode {
  const now = new Date().toISOString()
  return {
    id: makeMessageId(),
    label: shortId(publicKeyHex),
    privateKeyHex,
    publicKeyHex,
    createdAt: now,
    updatedAt: now,
    position,
    authorizations: [],
  }
}
