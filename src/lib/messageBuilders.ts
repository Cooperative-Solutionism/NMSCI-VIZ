import {
  MsgType,
  buildCentralPubkeyEmpowerPayload,
  buildFlowNodeRegisterPayload,
  buildTransactionMountPayload,
  buildTransactionRecordPayload,
  calculateTargetFromNBits,
  concat,
  mineNonce,
  mineTransactionMountNonce,
  mineTransactionRecordNonce,
  nBitsToBytes,
  pubkeyToBytes,
  serializeCentralPubkeyEmpowerSubmitPayload,
  serializeFlowNodeRegister,
  serializeTransactionMountSubmitPayload,
  serializeTransactionRecordSubmitPayload,
  signCentralPubkeyEmpowerPayload,
  signFlowNodeRegisterPayload,
  signTransactionMountPayload,
  signTransactionRecordPayload,
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

export async function buildRegisterMessage(
  params: {
    uuid: string
    privateKeyHex: string
    publicKeyHex: string
    difficultyHex: string
  },
  onProgress?: (attempts: number) => void,
): Promise<{ bytes: Uint8Array; rawBytesHex: string; nonce: number }> {
  const noncePrefix = concat(
    toBytesBigEndian(MsgType.FLOW_NODE_REGISTRATION, 2),
    uuidToBytes(params.uuid),
    nBitsToBytes(params.difficultyHex),
  )
  const nonceSuffix = pubkeyToBytes(params.publicKeyHex)
  const target = calculateTargetFromNBits(params.difficultyHex)
  const nonce = onProgress
    ? await mineNonce(noncePrefix, nonceSuffix, target, (attempts) => onProgress(attempts))
    : await mineNonce(noncePrefix, nonceSuffix, target)
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

// 消费记录：需要消费节点与流转节点对同一 135 字节载荷各签一次（运维本地同时持两把私钥）。
// nonce 位于 135 字节载荷的 32-35 字节，故用 slice(0,32)/slice(36) 切出前后缀喂给矿工（矿工内部自算 target，入参传 nBits hex）。
export async function buildTransactionRecordMessage(
  params: {
    uuid: string
    amount: bigint
    currencyType: number
    difficultyHex: string
    consumeNodePubkeyHex: string
    flowNodePubkeyHex: string
    centralPubkeyHex: string
    consumePrivateKeyHex: string
    flowPrivateKeyHex: string
  },
  onProgress?: (attempts: number) => void,
): Promise<{ bytes: Uint8Array; rawBytesHex: string; nonce: number }> {
  const base = {
    uuid: params.uuid,
    amount: params.amount,
    currencyType: params.currencyType,
    transactionDifficultyTarget: params.difficultyHex,
    consumeNodePubkey: params.consumeNodePubkeyHex,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
  }
  const preMine = buildTransactionRecordPayload({ ...base, nonce: 0 })
  const noncePrefix = preMine.slice(0, 32)
  const nonceSuffix = preMine.slice(36)
  const nonce = onProgress
    ? await mineTransactionRecordNonce(noncePrefix, nonceSuffix, params.difficultyHex, (attempts) => onProgress(attempts))
    : await mineTransactionRecordNonce(noncePrefix, nonceSuffix, params.difficultyHex)
  const payload = buildTransactionRecordPayload({ ...base, nonce })
  const consumeNodeSignature = await signTransactionRecordPayload(payload, params.consumePrivateKeyHex)
  const flowNodeSignature = await signTransactionRecordPayload(payload, params.flowPrivateKeyHex)
  const bytes = serializeTransactionRecordSubmitPayload({
    msgType: MsgType.TRANSACTION_RECORD,
    ...base,
    nonce,
    consumeNodeSignature,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes), nonce }
}

// 消费记录挂载：把已落库的记录 (mountedTransactionRecordId) 挂到链上；同样双签，nonce 位于 141 字节载荷的 38-41 字节。
export async function buildTransactionMountMessage(
  params: {
    uuid: string
    mountedTransactionRecordId: string
    difficultyHex: string
    consumeNodePubkeyHex: string
    flowNodePubkeyHex: string
    centralPubkeyHex: string
    consumePrivateKeyHex: string
    flowPrivateKeyHex: string
  },
  onProgress?: (attempts: number) => void,
): Promise<{ bytes: Uint8Array; rawBytesHex: string; nonce: number }> {
  const base = {
    uuid: params.uuid,
    mountedTransactionRecordId: params.mountedTransactionRecordId,
    transactionDifficultyTarget: params.difficultyHex,
    consumeNodePubkey: params.consumeNodePubkeyHex,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
  }
  const preMine = buildTransactionMountPayload({ ...base, nonce: 0 })
  const noncePrefix = preMine.slice(0, 38)
  const nonceSuffix = preMine.slice(42)
  const nonce = onProgress
    ? await mineTransactionMountNonce(noncePrefix, nonceSuffix, params.difficultyHex, (attempts) => onProgress(attempts))
    : await mineTransactionMountNonce(noncePrefix, nonceSuffix, params.difficultyHex)
  const payload = buildTransactionMountPayload({ ...base, nonce })
  const consumeNodeSignature = await signTransactionMountPayload(payload, params.consumePrivateKeyHex)
  const flowNodeSignature = await signTransactionMountPayload(payload, params.flowPrivateKeyHex)
  const bytes = serializeTransactionMountSubmitPayload({
    msgType: MsgType.TRANSACTION_MOUNT,
    ...base,
    nonce,
    consumeNodeSignature,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes), nonce }
}
