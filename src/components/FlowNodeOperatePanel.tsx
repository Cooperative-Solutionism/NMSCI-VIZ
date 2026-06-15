import { BadgeCheck, KeyRound, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { formatDateTime, maskSecret } from '../lib/format'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import { DetailRow } from './DetailRow'
import { Field } from './Field'
import { PanelHeader } from './PanelHeader'

export type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | 'record' | 'mount' | null

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
  onCreateMount,
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
  onCreateMount?: () => void
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
  const registerDisabled =
    registerDifficultyTarget.trim().length === 0 || busy !== null || centralLocked
  const chainState = nodeState
    ? `${nodeState.registered ? '已注册' : '未注册'}${nodeState.authorized ? ' · 已授权' : ''}${nodeState.locked ? ' · 已锁定' : ''}`
    : '-'

  return (
    <div className="inspector-content">
      <PanelHeader icon={<KeyRound size={16} />} title="流转节点" />

      <div className="node-key-box">
        <DetailRow
          label="公钥"
          value={
            <span className="copyable-value">
              <code>{node.publicKeyHex}</code>
              <button type="button" onClick={() => onCopy(node.publicKeyHex, '公钥')}>
                复制
              </button>
            </span>
          }
        />
        <DetailRow
          label="注册 ID"
          value={
            node.registration?.id ? (
              <span className="copyable-value">
                <code>{node.registration.id}</code>
                <button
                  type="button"
                  onClick={() => onCopy(node.registration?.id ?? '', '注册 ID')}
                >
                  复制
                </button>
              </span>
            ) : (
              '-'
            )
          }
        />
        <DetailRow label="私钥" value={<code>{maskSecret(node.privateKeyHex)}</code>} />
        <DetailRow label="保存时间" value={formatDateTime(node.createdAt)} />
        <DetailRow label="注册状态" value={formatRegistrationStatus(node.registration?.status)} />
        <DetailRow label="授权数" value={node.authorizations.length} />
        <DetailRow label="链上状态" value={chainState} />
        <button className="secondary-button" type="button" onClick={onQuery}>
          <Search size={15} />
          查询此节点
        </button>
        <button className="secondary-button" type="button" onClick={onExportPrivateKey}>
          导出私钥
        </button>
        <button className="secondary-button" type="button" onClick={onRename}>
          重命名
        </button>
        <button className="secondary-button danger" type="button" onClick={onDelete}>
          删除
        </button>
      </div>

      <div className="section-title">注册</div>
      <Field label="注册难度目标">
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
        {busy === 'difficulty' ? '加载中' : '使用最新难度'}
      </button>
      {centralLocked ? (
        <p className="operation-message error">中心公钥已冻结，注册和授权已禁用。</p>
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
            ? `挖矿 ${miningAttempts.toLocaleString()}`
            : '注册中'
          : '注册节点'}
      </button>

      <div className="section-title">授权中心公钥</div>
      <Field label="中心公钥">
        <textarea
          rows={3}
          value={centralPubkey}
          onChange={(event) => onCentralPubkeyChange(event.currentTarget.value)}
          spellCheck={false}
          placeholder="33 字节压缩公钥 hex"
        />
      </Field>
      <button
        className="primary-button"
        type="button"
        disabled={centralPubkey.trim().length === 0 || busy !== null || centralLocked}
        onClick={onAuthorize}
      >
        <ShieldCheck size={16} />
        {busy === 'authorize' ? '授权中' : '授权中心'}
      </button>

      {onCreateRecord || onCreateMount ? (
        <>
          <div className="section-title">交易</div>
          {onCreateRecord ? (
            <button className="secondary-button" type="button" onClick={onCreateRecord}>
              创建交易记录
            </button>
          ) : null}
          {onCreateMount ? (
            <button className="secondary-button" type="button" onClick={onCreateMount}>
              挂载已有记录
            </button>
          ) : null}
        </>
      ) : null}

      {status ? <p className="operation-message">{status}</p> : null}
      {error ? <p className="operation-message error">{error}</p> : null}
      {lastRawBytes ? (
        <div className="raw-preview">
          <span>最近原始消息</span>
          <code>{lastRawBytes}</code>
        </div>
      ) : null}
    </div>
  )
}

function formatRegistrationStatus(status: string | undefined): string {
  if (status === 'sent') return '已发送'
  if (status === 'failed') return '失败'
  return '-'
}
