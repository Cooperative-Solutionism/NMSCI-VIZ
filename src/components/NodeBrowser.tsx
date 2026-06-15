import { Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useFlowNodeDirectory } from '../hooks/useFlowNodeDirectory'
import { shortHex } from '../lib/format'

const PAGE_SIZE = 10

// 节点发现：按 registered/authorized/locked 过滤浏览节点目录，点选即把公钥填入查询，
// 解决"打开工具却没有任何可查的 UUID"的冷启动死胡同。
export function NodeBrowser({
  apiBase,
  onPick,
}: {
  apiBase: string
  onPick: (pubkey: string) => void
}) {
  const directory = useFlowNodeDirectory(apiBase)
  const [open, setOpen] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [locked, setLocked] = useState(false)
  const [page, setPage] = useState(0)

  const browse = useCallback((targetPage: number) => {
    const nextPage = Math.max(0, targetPage)
    setPage(nextPage)
    void directory.load({
      registered: registered || undefined,
      authorized: authorized || undefined,
      locked: locked || undefined,
      page: nextPage,
      size: PAGE_SIZE,
    })
  }, [authorized, directory, locked, registered])

  return (
    <section className="node-browser">
      <button
        type="button"
        className="node-browser-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Browse nodes
      </button>
      {open ? (
        <div className="node-browser-body">
          <div className="filter-chips" role="group" aria-label="Node filters">
            <ChipToggle label="Registered" active={registered} onToggle={() => setRegistered((v) => !v)} />
            <ChipToggle label="Authorized" active={authorized} onToggle={() => setAuthorized((v) => !v)} />
            <ChipToggle label="Locked" active={locked} onToggle={() => setLocked((v) => !v)} />
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={directory.loading}
            onClick={() => browse(0)}
          >
            <Search size={15} />
            {directory.loading ? 'Loading' : 'Browse'}
          </button>
          {directory.error ? <p className="operation-message error">{directory.error}</p> : null}
          {directory.items.length > 0 ? (
            <ul className="node-browser-list">
              {directory.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="node-browser-row" onClick={() => onPick(item.flowNodePubkey)}>
                    <span className="node-browser-key">{shortHex(item.flowNodePubkey)}</span>
                    <span className="node-browser-badges">
                      {item.registered ? <em className="badge reg">reg</em> : null}
                      {item.authorized ? <em className="badge auth">auth</em> : null}
                      {item.locked ? <em className="badge lock">lock</em> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {directory.items.length > 0 ? (
            <div className="node-browser-pager">
              <button type="button" disabled={!directory.hasPrevious || directory.loading} onClick={() => browse(page - 1)}>
                Prev
              </button>
              <span>page {directory.page}</span>
              <button type="button" disabled={!directory.hasNext || directory.loading} onClick={() => browse(page + 1)}>
                Next
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
    <button type="button" className={`chip ${active ? 'active' : ''}`} aria-pressed={active} onClick={onToggle}>
      {label}
    </button>
  )
}
