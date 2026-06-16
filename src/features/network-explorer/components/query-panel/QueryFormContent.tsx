import { CircleDot, LocateFixed, Orbit, Search } from 'lucide-react'
import { Field } from '../../../../components'
import { statusLabel } from '../../../../lib/consumeChainFilters'
import type { CurrencyFilter } from '../../../../hooks/useConsumeChainQuery'
import type { QueryFormContentProps } from './types'

export function QueryFormContent({
  apiBase,
  currencyFilter,
  error,
  extended,
  loading,
  loopStatus,
  mode,
  nodeId,
  onApiBaseChange,
  onRunQuery,
  onSetCurrencyFilter,
  onSetLoopStatus,
  onSetMode,
  onSetNodeId,
  requestUrl,
  warning,
}: QueryFormContentProps) {
  return (
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
      <p className="field-hint">支持 UUID 或 66 位十六进制公钥（自动识别）。</p>

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
            onChange={(event) => onSetCurrencyFilter(event.currentTarget.value as CurrencyFilter)}
          >
            <option value="all">全部</option>
            <option value="1">CNY</option>
            <option value="0">Au 微克</option>
          </select>
          <span className="field-hint">已加载结果视图过滤</span>
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
  )
}
