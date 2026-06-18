import { Search } from 'lucide-react'
import { useCallback } from 'react'
import { useFlowNodeDirectory } from '../hooks/useFlowNodeDirectory'
import { shortId } from '../lib/chainGraph'
import { useUrlBooleanParam, useUrlNumberParam } from '../shared/hooks/useUrlQueryParam'

const PAGE_SIZE = 10

function normalizePage(value: number): number {
  return Math.max(0, Math.trunc(value))
}

export function NodeBrowser({
  apiBase,
  onPick,
}: {
  apiBase: string
  onPick: (pubkey: string) => void
}) {
  const directory = useFlowNodeDirectory(apiBase)
  const [open, setOpen] = useUrlBooleanParam('nodeBrowserOpen')
  const [registered, setRegistered] = useUrlBooleanParam('nodeRegistered')
  const [authorized, setAuthorized] = useUrlBooleanParam('nodeAuthorized')
  const [locked, setLocked] = useUrlBooleanParam('nodeLocked')
  const [nodeBrowserPage, setNodeBrowserPage] = useUrlNumberParam(
    'nodeBrowserPage',
    0,
    normalizePage,
  )

  const browse = useCallback(
    (requestedNodeBrowserPage: number) => {
      const nextPage = Math.max(0, requestedNodeBrowserPage)
      setNodeBrowserPage(nextPage)
      void directory.load({
        registered: registered || undefined,
        authorized: authorized || undefined,
        locked: locked || undefined,
        page: nextPage,
        size: PAGE_SIZE,
      })
    },
    [authorized, directory, locked, registered, setNodeBrowserPage],
  )

  return (
    <section className="node-browser">
      <button
        type="button"
        className="node-browser-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        浏览节点
      </button>
      {open ? (
        <div className="node-browser-body">
          <div className="filter-chips" role="group" aria-label="节点过滤">
            <ChipToggle
              label="已注册"
              active={registered}
              onToggle={() => setRegistered((value) => !value)}
            />
            <ChipToggle
              label="已授权"
              active={authorized}
              onToggle={() => setAuthorized((value) => !value)}
            />
            <ChipToggle
              label="已锁定"
              active={locked}
              onToggle={() => setLocked((value) => !value)}
            />
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={directory.loading}
            onClick={() => browse(0)}
          >
            <Search size={15} />
            {directory.loading ? '加载中…' : '浏览'}
          </button>
          {directory.error ? (
            <p className="operation-message error" role="alert">
              {directory.error}
            </p>
          ) : null}
          {directory.items.length > 0 ? (
            <ul className="node-browser-list">
              {directory.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="node-browser-row"
                    onClick={() => onPick(item.flowNodePubkey)}
                  >
                    <span className="node-browser-key" translate="no">
                      {shortId(item.id)}
                    </span>
                    <span className="node-browser-badges">
                      {item.registered ? <em className="badge reg">注册</em> : null}
                      {item.authorized ? <em className="badge auth">授权</em> : null}
                      {item.locked ? <em className="badge lock">锁定</em> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {directory.items.length > 0 ? (
            <div className="node-browser-pager">
              <button
                type="button"
                disabled={!directory.hasPrevious || directory.loading}
                onClick={() => browse(nodeBrowserPage - 1)}
              >
                上一页
              </button>
              <span>第 {directory.page + 1} 页</span>
              <button
                type="button"
                disabled={!directory.hasNext || directory.loading}
                onClick={() => browse(nodeBrowserPage + 1)}
              >
                下一页
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function ChipToggle({
  active,
  label,
  onToggle,
}: {
  active: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'active' : ''}`}
      aria-pressed={active}
      onClick={onToggle}
    >
      {label}
    </button>
  )
}
