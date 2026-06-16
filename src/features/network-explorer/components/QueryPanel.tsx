import {
  CircleDot,
  Database,
  Filter,
  KeyRound,
  LocateFixed,
  Orbit,
  Plus,
  Search,
} from 'lucide-react'
import { Field, NodeBrowser, PanelHeader, VaultGate } from '../../../components'
import { statusLabel } from '../../../lib/consumeChainFilters'
import { useUrlStateParam } from '../../../shared/hooks/useUrlQueryParam'
import type { CurrencyFilter } from '../../../hooks/useConsumeChainQuery'
import type { LoopStatus, QueryMode } from '../../../lib/types'
import type { VaultStatus } from '../../../hooks/useKeyVault'

type LeftTab = 'query' | 'browse' | 'keys'

function isLeftTab(value: string): value is LeftTab {
  return value === 'query' || value === 'browse' || value === 'keys'
}

export function QueryPanel({
  apiBase,
  currencyFilter,
  error,
  extended,
  loading,
  loopStatus,
  mode,
  nodeId,
  onAddConsumeNode,
  onAddFlowNode,
  onApiBaseChange,
  onImportLocalNode,
  onLockVault,
  onPickNode,
  onRunQuery,
  onSetCurrencyFilter,
  onSetLoopStatus,
  onSetMode,
  onSetNodeId,
  onSetupVault,
  onUnlockVault,
  registrationError,
  requestUrl,
  showKeyringError,
  vaultError,
  vaultStatus,
  warning,
}: {
  apiBase: string
  currencyFilter: CurrencyFilter
  error: string | null
  extended: boolean
  loading: boolean
  loopStatus: LoopStatus
  mode: QueryMode
  nodeId: string
  onAddConsumeNode: () => void
  onAddFlowNode: () => void
  onApiBaseChange: (value: string) => void
  onImportLocalNode: () => void
  onLockVault: () => void
  onPickNode: (pubkey: string) => void
  onRunQuery: () => Promise<void>
  onSetCurrencyFilter: (filter: CurrencyFilter) => void
  onSetLoopStatus: (status: LoopStatus) => void
  onSetMode: (mode: QueryMode) => void
  onSetNodeId: (nodeId: string) => void
  onSetupVault: (passphrase: string) => void
  onUnlockVault: (passphrase: string) => void
  registrationError: string | null
  requestUrl: string
  showKeyringError: boolean
  vaultError: string | null
  vaultStatus: VaultStatus
  warning: string | null
}) {
  const [leftTab, setLeftTab] = useUrlStateParam<LeftTab>('panel', 'query', isLeftTab)

  return (
    <div className="query-panel-content" aria-label="消费链查询">
      <div className="floating-tabs" role="tablist" aria-label="面板分区">
        <button
          role="tab"
          aria-selected={leftTab === 'query'}
          className={leftTab === 'query' ? 'active' : ''}
          type="button"
          onClick={() => setLeftTab('query')}
        >
          <Filter size={15} />
          查询
        </button>
        <button
          role="tab"
          aria-selected={leftTab === 'browse'}
          className={leftTab === 'browse' ? 'active' : ''}
          type="button"
          onClick={() => setLeftTab('browse')}
        >
          <Database size={15} />
          浏览
        </button>
        <button
          role="tab"
          aria-selected={leftTab === 'keys'}
          className={leftTab === 'keys' ? 'active' : ''}
          type="button"
          onClick={() => setLeftTab('keys')}
        >
          <KeyRound size={15} />
          密钥
        </button>
      </div>

      <div className="floating-body">
        {leftTab === 'query' ? (
          <>
            <Field label="API 基址">
              <input
                name="apiBase"
                autoComplete="off"
                value={apiBase}
                onChange={(event) => onApiBaseChange(event.currentTarget.value)}
                spellCheck={false}
              />
            </Field>

            <Field label="模式">
              <div className="segmented" role="group" aria-label="查询模式">
                <button
                  className={mode === 'start' ? 'active' : ''}
                  type="button"
                  onClick={() => onSetMode('start')}
                >
                  <LocateFixed size={15} />
                  起点
                </button>
                <button
                  className={mode === 'end' ? 'active' : ''}
                  type="button"
                  onClick={() => onSetMode('end')}
                >
                  <CircleDot size={15} />
                  终点
                </button>
                <button
                  className={mode === 'node' ? 'active' : ''}
                  type="button"
                  onClick={() => onSetMode('node')}
                >
                  <Orbit size={15} />
                  节点
                </button>
              </div>
            </Field>

            <Field label="流转节点 ID / 公钥">
              <textarea
                name="nodeId"
                autoComplete="off"
                rows={3}
                value={nodeId}
                onChange={(event) => onSetNodeId(event.currentTarget.value)}
                spellCheck={false}
              />
            </Field>
            <p className="field-hint">支持 UUID 或 66 位十六进制公钥（自动识别）</p>

            <Field label="循环状态">
              <div className="segmented compact" role="group" aria-label="循环状态">
                {(['all', 'looped', 'open'] as const).map((status) => (
                  <button
                    key={status}
                    className={loopStatus === status ? 'active' : ''}
                    type="button"
                    onClick={() => onSetLoopStatus(status)}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>
            </Field>

            <div className="form-grid">
              <Field label="币种">
                <select
                  name="currencyFilter"
                  autoComplete="off"
                  value={currencyFilter}
                  onChange={(event) =>
                    onSetCurrencyFilter(event.currentTarget.value as CurrencyFilter)
                  }
                >
                  <option value="all">全部</option>
                  <option value="1">CNY</option>
                  <option value="0">Au 微克</option>
                </select>
                <span className="field-hint">当前页视图过滤</span>
              </Field>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                disabled={loading || nodeId.trim().length === 0}
                aria-describedby={nodeId.trim().length === 0 ? 'load-disabled-reason' : undefined}
                onClick={() => void onRunQuery()}
              >
                <Search size={16} />
                {loading ? '加载中…' : '加载'}
              </button>
              {nodeId.trim().length === 0 ? (
                <span id="load-disabled-reason" className="sr-only">
                  请输入流转节点 UUID 后加载链路数据。
                </span>
              ) : null}
            </div>

            <div className="request-preview">
              <span>请求</span>
              <code translate="no">{requestUrl}</code>
            </div>

            {error ? (
              <p className="error-banner" role="alert">
                {error}。当前图谱已保持不变。
              </p>
            ) : null}
            {warning ? (
              <p className="info-banner" aria-live="polite">
                {warning}
              </p>
            ) : null}
            {extended ? (
              <p className="info-banner" aria-live="polite">
                已扩展图谱视图；重新加载查询可恢复干净的后端结果。
              </p>
            ) : null}
          </>
        ) : null}

        {leftTab === 'browse' ? (
          <NodeBrowser
            apiBase={apiBase}
            onPick={(pubkey) => {
              onPickNode(pubkey)
              setLeftTab('query')
            }}
          />
        ) : null}

        {leftTab === 'keys' ? (
          <div className="flow-node-block">
            <PanelHeader icon={<KeyRound size={16} />} title="密钥" />
            <VaultGate
              status={vaultStatus}
              error={vaultError}
              onSetup={onSetupVault}
              onUnlock={onUnlockVault}
              onLock={onLockVault}
            />
            <div className="action-row two">
              <button
                className="secondary-button"
                type="button"
                disabled={vaultStatus !== 'unlocked'}
                onClick={() => onAddFlowNode()}
              >
                <Plus size={15} />
                流转节点
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={vaultStatus !== 'unlocked'}
                onClick={() => onAddConsumeNode()}
              >
                <Plus size={15} />
                消费节点
              </button>
            </div>
            <div className="action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={vaultStatus !== 'unlocked'}
                onClick={onImportLocalNode}
              >
                <Plus size={15} />
                导入流转节点
              </button>
            </div>
            <p className="field-hint">
              {vaultStatus === 'unlocked'
                ? '可在画布右键添加节点，点击节点后可注册、授权或构建交易。'
                : '解锁密钥保险库后可添加或导入节点；私钥会加密存储。'}
            </p>
            {registrationError && showKeyringError ? (
              <p className="operation-message error" role="alert">
                {registrationError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
