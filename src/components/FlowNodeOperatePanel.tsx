import { BadgeCheck, KeyRound, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import { DetailRow } from './DetailRow'
import { Field } from './Field'
import { PanelHeader } from './PanelHeader'

export type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | null

// 流转节点操作面板（点击画布上的本地流转节点后显示在右侧检查器）：
// 密钥信息 + 链上状态 + 注册 + 中心公钥授权 + 钥匙管理。原左栏 FLOW NODES 巨块迁移至此。
export function FlowNodeOperatePanel({
  busy,
  centralLocked,
  centralPubkey,
  error,
  lastRawBytes,
  miningAttempts,
  node,
  nodeState,
  onAuthorize,
  onCentralPubkeyChange,
  onCopy,
  onCreateRecord,
  onDelete,
  onDifficultyChange,
  onExportPrivateKey,
  onFetchDifficulty,
  onQuery,
  onRegister,
  onRename,
  registerDifficultyTarget,
  status,
}: {
  busy: FlowNodeBusyState
  centralLocked: boolean
  centralPubkey: string
  error: string | null
  lastRawBytes: string
  miningAttempts: number | null
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onAuthorize: () => void
  onCentralPubkeyChange: (value: string) => void
  onCopy: (value: string, label: string) => void
  onCreateRecord?: () => void
  onDelete: () => void
  onDifficultyChange: (value: string) => void
  onExportPrivateKey: () => void
  onFetchDifficulty: () => void
  onQuery: () => void
  onRegister: () => void
  onRename: () => void
  registerDifficultyTarget: string
  status: string | null
}) {
  const registerDisabled = registerDifficultyTarget.trim().length === 0 || busy !== null || centralLocked
  return (
    <div className="inspector-content">
      <PanelHeader icon={<KeyRound size={16} />} title="Flow node" />

      <div className="node-key-box">
        <DetailRow
          label="Pubkey"
          value={(
            <span className="copyable-value">
              <code>{node.publicKeyHex}</code>
              <button type="button" onClick={() => onCopy(node.publicKeyHex, 'Pubkey')}>
                Copy
              </button>
            </span>
          )}
        />
        <DetailRow
          label="Register id"
          value={node.registration?.id ? (
            <span className="copyable-value">
              <code>{node.registration.id}</code>
              <button type="button" onClick={() => onCopy(node.registration?.id ?? '', 'Register id')}>
                Copy
              </button>
            </span>
          ) : '—'}
        />
        <DetailRow label="Secret" value={<code>{maskSecret(node.privateKeyHex)}</code>} />
        <DetailRow label="Saved" value={formatDateTime(node.createdAt)} />
        <DetailRow label="Register" value={node.registration?.status ?? '-'} />
        <DetailRow label="Auth count" value={node.authorizations.length} />
        <DetailRow
          label="On-chain"
          value={
            nodeState
              ? `${nodeState.registered ? 'registered' : 'unregistered'}${nodeState.authorized ? ' · authorized' : ''}${nodeState.locked ? ' · locked' : ''}`
              : '—'
          }
        />
        <button className="secondary-button" type="button" onClick={onQuery}>
          <Search size={15} />
          Query this node
        </button>
        <button className="secondary-button" type="button" onClick={onExportPrivateKey}>
          Export private key
        </button>
        <button className="secondary-button" type="button" onClick={onRename}>
          Rename
        </button>
        <button className="secondary-button danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>

      <div className="section-title">Register</div>
      <Field label="Register difficulty target">
        <input
          value={registerDifficultyTarget}
          onChange={(event) => onDifficultyChange(event.currentTarget.value)}
          inputMode="text"
          placeholder="1d00ffff"
        />
      </Field>
      <button
        className="secondary-button"
        type="button"
        disabled={busy === 'difficulty'}
        onClick={onFetchDifficulty}
      >
        <RefreshCw size={15} />
        {busy === 'difficulty' ? 'Loading' : 'Use latest difficulty'}
      </button>
      {centralLocked ? (
        <p className="operation-message error">
          Central public key is frozen; registration and authorization are disabled.
        </p>
      ) : null}
      <button
        className="primary-button"
        type="button"
        disabled={registerDisabled}
        onClick={onRegister}
      >
        <BadgeCheck size={16} />
        {busy === 'register'
          ? miningAttempts != null
            ? `Mining ${miningAttempts.toLocaleString()}`
            : 'Registering'
          : 'Register node'}
      </button>

      <div className="section-title">Authorize central key</div>
      <Field label="Central pubkey">
        <textarea
          rows={3}
          value={centralPubkey}
          onChange={(event) => onCentralPubkeyChange(event.currentTarget.value)}
          spellCheck={false}
          placeholder="33-byte compressed public key hex"
        />
      </Field>
      <button
        className="primary-button"
        type="button"
        disabled={centralPubkey.trim().length === 0 || busy !== null || centralLocked}
        onClick={onAuthorize}
      >
        <ShieldCheck size={16} />
        {busy === 'authorize' ? 'Authorizing' : 'Authorize central'}
      </button>

      {onCreateRecord ? (
        <>
          <div className="section-title">Transaction</div>
          <button className="secondary-button" type="button" onClick={onCreateRecord}>
            Create transaction record
          </button>
        </>
      ) : null}

      {status ? <p className="operation-message">{status}</p> : null}
      {error ? <p className="operation-message error">{error}</p> : null}
      {lastRawBytes ? (
        <div className="raw-preview">
          <span>Last raw message</span>
          <code>{lastRawBytes}</code>
        </div>
      ) : null}
    </div>
  )
}
