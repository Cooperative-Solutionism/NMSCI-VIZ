import {
  MsgType,
  buildCentralPubkeyEmpowerPayload,
  buildFlowNodeRegisterPayload,
  calculateTargetFromNBits,
  concat,
  mineNonce,
  nBitsToBytes,
  pubkeyToBytes,
  serializeCentralPubkeyEmpowerSubmitPayload,
  serializeFlowNodeRegister,
  signCentralPubkeyEmpowerPayload,
  signFlowNodeRegisterPayload,
  toBytesBigEndian,
  toHex,
  uuidToBytes,
} from '@nmsci/sdk'

export function makeMessageId(): string {
  return crypto.randomUUID()
}

export function normalizePubkeyHex(value: string): string {
  return toHex(pubkeyToBytes(value.trim()))
}

export async function buildRegisterMessage(params: {
  uuid: string
  privateKeyHex: string
  publicKeyHex: string
  difficultyHex: string
}): Promise<{ bytes: Uint8Array; rawBytesHex: string; nonce: number }> {
  const noncePrefix = concat(
    toBytesBigEndian(MsgType.FLOW_NODE_REGISTRATION, 2),
    uuidToBytes(params.uuid),
    nBitsToBytes(params.difficultyHex),
  )
  const nonceSuffix = pubkeyToBytes(params.publicKeyHex)
  const target = calculateTargetFromNBits(params.difficultyHex)
  const nonce = await mineNonce(noncePrefix, nonceSuffix, target)
  const payload = buildFlowNodeRegisterPayload({
    uuid: params.uuid,
    registerDifficultyTarget: params.difficultyHex,
    nonce,
    flowNodePubkey: params.publicKeyHex,
  })
  const flowNodeSignature = await signFlowNodeRegisterPayload(payload, params.privateKeyHex)
  const bytes = serializeFlowNodeRegister({
    msgType: MsgType.FLOW_NODE_REGISTRATION,
    uuid: params.uuid,
    registerDifficultyTarget: params.difficultyHex,
    nonce,
    flowNodePubkey: params.publicKeyHex,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes), nonce }
}

export async function buildEmpowerMessage(params: {
  uuid: string
  privateKeyHex: string
  flowNodePubkeyHex: string
  centralPubkeyHex: string
}): Promise<{ bytes: Uint8Array; rawBytesHex: string }> {
  const payload = buildCentralPubkeyEmpowerPayload({
    uuid: params.uuid,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
  })
  const flowNodeSignature = await signCentralPubkeyEmpowerPayload(payload, params.privateKeyHex)
  const bytes = serializeCentralPubkeyEmpowerSubmitPayload({
    msgType: MsgType.CENTRAL_KEY_AUTH,
    uuid: params.uuid,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes) }
}
