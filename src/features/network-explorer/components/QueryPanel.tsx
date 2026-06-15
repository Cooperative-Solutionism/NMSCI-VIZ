import {
  ChevronLeft,
  CircleDot,
  Database,
  Filter,
  GripVertical,
  KeyRound,
  Layers,
  LocateFixed,
  Orbit,
  Plus,
  Search,
} from 'lucide-react'
import { useState, type RefObject } from 'react'
import { Field, NodeBrowser, PanelHeader, VaultGate } from '../../../components'
import { statusLabel } from '../../../lib/consumeChainFilters'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { CurrencyFilter } from '../../../hooks/useConsumeChainQuery'
import type { LoopStatus, QueryMode } from '../../../lib/types'
import type { VaultStatus } from '../../../hooks/useKeyVault'

type LeftTab = 'query' | 'browse' | 'keys'

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
  onSetPage,
  onSetSize,
  onSetupVault,
  onUnlockVault,
  page,
  registrationError,
  requestUrl,
  showKeyringError,
  size,
  vaultError,
  vaultStatus,
  warning,
  workspaceRef,
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
  onRunQuery: (page: number) => Promise<void>
  onSetCurrencyFilter: (filter: CurrencyFilter) => void
  onSetLoopStatus: (status: LoopStatus) => void
  onSetMode: (mode: QueryMode) => void
  onSetNodeId: (nodeId: string) => void
  onSetPage: (page: number) => void
  onSetSize: (size: number) => void
  onSetupVault: (passphrase: string) => void
  onUnlockVault: (passphrase: string) => void
  page: number
  registrationError: string | null
  requestUrl: string
  showKeyringError: boolean
  size: number
  vaultError: string | null
  vaultStatus: VaultStatus
  warning: string | null
  workspaceRef: RefObject<HTMLElement | null>
}) {
  const [leftTab, setLeftTab] = useState<LeftTab>('query')
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const {
    dragging: panelDragging,
    elementRef: panelRef,
    onPointerDown: handlePanelPointerDown,
    style: panelStyle,
  } = useDraggable({ boundsRef: workspaceRef })

  return (
    <>
      {panelCollapsed ? (
        <button
          className="floating-reopen"
          type="button"
          onClick={() => setPanelCollapsed(false)}
          aria-label="打开控制台面板"
        >
          <Layers size={18} />
        </button>
      ) : null}

      <aside
        ref={panelRef}
        style={panelStyle}
        className={`query-panel${panelCollapsed ? ' collapsed' : ''}${panelDragging ? ' dragging' : ''}`}
        aria-label="消费链查询"
        aria-hidden={panelCollapsed}
      >
        <div className="floating-head" onPointerDown={handlePanelPointerDown}>
          <div className="floating-title">
            <GripVertical className="floating-grip" size={15} aria-hidden />
            <Layers size={15} />
            <span>控制台</span>
          </div>
          <button
            className="floating-collapse"
            type="button"
            onClick={() => setPanelCollapsed(true)}
            aria-label="收起面板"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

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
                <Field label="页码">
                  <input
                    min={0}
                    type="number"
                    value={page}
                    onChange={(event) => onSetPage(Math.max(0, Number(event.currentTarget.value)))}
                  />
                </Field>
                <Field label="每页数量">
                  <input
                    min={1}
                    max={200}
                    type="number"
                    value={size}
                    onChange={(event) => onSetSize(Number(event.currentTarget.value))}
                  />
                </Field>
              </div>

              <div className="action-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={loading || nodeId.trim().length === 0}
                  aria-describedby={nodeId.trim().length === 0 ? 'load-disabled-reason' : undefined}
                  onClick={() => void onRunQuery(0)}
                >
                  <Search size={16} />
                  {loading ? '加载中' : '加载'}
                </button>
                {nodeId.trim().length === 0 ? (
                  <span id="load-disabled-reason" className="sr-only">
                    请输入流转节点 UUID 后加载链路数据。
                  </span>
                ) : null}
              </div>

              <div className="request-preview">
                <span>请求</span>
                <code>{requestUrl}</code>
              </div>

              {error ? <p className="error-banner">{error}。当前图谱已保持不变。</p> : null}
              {warning ? <p className="info-banner">{warning}</p> : null}
              {extended ? (
                <p className="info-banner">已扩展图谱视图；重新加载查询可恢复分页。</p>
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
                <p className="operation-message error">{registrationError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
