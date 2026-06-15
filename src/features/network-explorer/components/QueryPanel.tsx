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
          aria-label="Open console panel"
        >
          <Layers size={18} />
        </button>
      ) : null}

      <aside
        ref={panelRef}
        style={panelStyle}
        className={`query-panel${panelCollapsed ? ' collapsed' : ''}${panelDragging ? ' dragging' : ''}`}
        aria-label="Consume chain query"
        aria-hidden={panelCollapsed}
      >
        <div className="floating-head" onPointerDown={handlePanelPointerDown}>
          <div className="floating-title">
            <GripVertical className="floating-grip" size={15} aria-hidden />
            <Layers size={15} />
            <span>Console</span>
          </div>
          <button
            className="floating-collapse"
            type="button"
            onClick={() => setPanelCollapsed(true)}
            aria-label="Collapse panel"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="floating-tabs" role="tablist" aria-label="Panel sections">
          <button
            role="tab"
            aria-selected={leftTab === 'query'}
            className={leftTab === 'query' ? 'active' : ''}
            type="button"
            onClick={() => setLeftTab('query')}
          >
            <Filter size={15} />
            Query
          </button>
          <button
            role="tab"
            aria-selected={leftTab === 'browse'}
            className={leftTab === 'browse' ? 'active' : ''}
            type="button"
            onClick={() => setLeftTab('browse')}
          >
            <Database size={15} />
            Browse
          </button>
          <button
            role="tab"
            aria-selected={leftTab === 'keys'}
            className={leftTab === 'keys' ? 'active' : ''}
            type="button"
            onClick={() => setLeftTab('keys')}
          >
            <KeyRound size={15} />
            Keys
          </button>
        </div>

        <div className="floating-body">
          {leftTab === 'query' ? (
            <>
              <Field label="API base">
                <input
                  value={apiBase}
                  onChange={(event) => onApiBaseChange(event.currentTarget.value)}
                  spellCheck={false}
                />
              </Field>

              <Field label="Mode">
                <div className="segmented" role="group" aria-label="Query mode">
                  <button
                    className={mode === 'start' ? 'active' : ''}
                    type="button"
                    onClick={() => onSetMode('start')}
                  >
                    <LocateFixed size={15} />
                    Start
                  </button>
                  <button
                    className={mode === 'end' ? 'active' : ''}
                    type="button"
                    onClick={() => onSetMode('end')}
                  >
                    <CircleDot size={15} />
                    End
                  </button>
                  <button
                    className={mode === 'node' ? 'active' : ''}
                    type="button"
                    onClick={() => onSetMode('node')}
                  >
                    <Orbit size={15} />
                    Node
                  </button>
                </div>
              </Field>

              <Field label="Flow node id / pubkey">
                <textarea
                  rows={3}
                  value={nodeId}
                  onChange={(event) => onSetNodeId(event.currentTarget.value)}
                  spellCheck={false}
                />
              </Field>
              <p className="field-hint">UUID or 66-hex public key (auto-detected)</p>

              <Field label="Loop status">
                <div className="segmented compact" role="group" aria-label="Loop status">
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
                <Field label="Currency">
                  <select
                    value={currencyFilter}
                    onChange={(event) =>
                      onSetCurrencyFilter(event.currentTarget.value as CurrencyFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="1">CNY</option>
                    <option value="0">Au ug</option>
                  </select>
                  <span className="field-hint">Current page view filter</span>
                </Field>
                <Field label="Page">
                  <input
                    min={0}
                    type="number"
                    value={page}
                    onChange={(event) => onSetPage(Math.max(0, Number(event.currentTarget.value)))}
                  />
                </Field>
                <Field label="Size">
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
                  {loading ? 'Loading' : 'Load'}
                </button>
                {nodeId.trim().length === 0 ? (
                  <span id="load-disabled-reason" className="sr-only">
                    Enter a flow node UUID to load chain data.
                  </span>
                ) : null}
              </div>

              <div className="request-preview">
                <span>Request</span>
                <code>{requestUrl}</code>
              </div>

              {error ? (
                <p className="error-banner">{error}. Current graph was kept unchanged.</p>
              ) : null}
              {warning ? <p className="info-banner">{warning}</p> : null}
              {extended ? (
                <p className="info-banner">
                  Extended graph view; reload the query to resume pagination.
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
              <PanelHeader icon={<KeyRound size={16} />} title="Keys" />
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
                  Flow node
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={vaultStatus !== 'unlocked'}
                  onClick={() => onAddConsumeNode()}
                >
                  <Plus size={15} />
                  Consume node
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
                  Import flow node
                </button>
              </div>
              <p className="field-hint">
                {vaultStatus === 'unlocked'
                  ? 'Right-click the canvas to add a node, then click a node to register, authorize, or build transactions on it.'
                  : 'Unlock your key vault to add or import nodes. Private keys are encrypted at rest.'}
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
