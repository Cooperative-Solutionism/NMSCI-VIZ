import { Network, Search } from 'lucide-react'
import { useCallback } from 'react'
import { defaultFlowNodePageSize } from '../../../../app/config'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card'
import { Field, FieldGroup, FieldLabel } from '../../../../components/ui/field'
import { Input } from '../../../../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table'
import { Toggle } from '../../../../components/ui/toggle'
import { useFlowNodeDirectory } from '../../../../hooks/useFlowNodeDirectory'
import { shortId } from '../../../../lib/chainGraph'
import { useUrlBooleanParam, useUrlNumberParam } from '../../../../shared/hooks/useUrlQueryParam'

function normalizePage(value: number): number {
  return Math.max(0, Math.trunc(value))
}

function normalizePageSize(value: number): number {
  return Math.max(1, Math.trunc(value))
}

export function FlowNodeBrowser({
  apiBase,
}: {
  apiBase: string
}) {
  const directory = useFlowNodeDirectory(apiBase)
  const [registered, setRegistered] = useUrlBooleanParam('flowNodeRegistered')
  const [authorized, setAuthorized] = useUrlBooleanParam('flowNodeAuthorized')
  const [locked, setLocked] = useUrlBooleanParam('flowNodeLocked')
  const [page, setPage] = useUrlNumberParam('flowNodePage', 0, normalizePage)
  const [pageSize, setPageSize] = useUrlNumberParam(
    'flowNodePageSize',
    defaultFlowNodePageSize,
    normalizePageSize,
  )

  const browse = useCallback(
    (requestedPage: number) => {
      const nextPage = normalizePage(requestedPage)
      setPage(nextPage)
      void directory.load({
        registered: registered || undefined,
        authorized: authorized || undefined,
        locked: locked || undefined,
        page: nextPage,
        size: pageSize,
      })
    },
    [authorized, directory, locked, pageSize, registered, setPage],
  )

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="size-4" aria-hidden="true" />
            流转节点
          </CardTitle>
        </CardHeader>
        <CardContent className="node-browser-body">
          <FieldGroup className="browse-filter-grid">
            <div className="filter-chips browse-filter-wide" role="group" aria-label="节点过滤">
              <ChipToggle
                label="已注册"
                active={registered}
                onToggle={() => {
                  setRegistered((value) => !value)
                  setPage(0)
                }}
              />
              <ChipToggle
                label="已授权"
                active={authorized}
                onToggle={() => {
                  setAuthorized((value) => !value)
                  setPage(0)
                }}
              />
              <ChipToggle
                label="已锁定"
                active={locked}
                onToggle={() => {
                  setLocked((value) => !value)
                  setPage(0)
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="flow-node-page">流转节点页码</FieldLabel>
                <Input
                  id="flow-node-page"
                  name="flowNodePage"
                  type="number"
                  min={1}
                  value={page + 1}
                  onChange={(event) => setPage(Number(event.currentTarget.value) - 1)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="flow-node-page-size">流转节点数量</FieldLabel>
                <Input
                  id="flow-node-page-size"
                  name="flowNodePageSize"
                  type="number"
                  min={1}
                  value={pageSize}
                  onChange={(event) => {
                    setPage(0)
                    setPageSize(Number(event.currentTarget.value))
                  }}
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              type="button"
              className="browse-filter-action"
              disabled={directory.loading}
              onClick={() => browse(page)}
            >
              <Search data-icon="inline-start" />
              {directory.loading ? '加载中…' : '加载流转节点'}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      {directory.error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>流转节点加载失败</AlertTitle>
          <AlertDescription>{directory.error}</AlertDescription>
        </Alert>
      ) : null}

      {directory.items.length > 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="browse-results-table" data-testid="flow-node-results-table">
              <Table aria-label="流转节点列表">
                <TableHeader>
                  <TableRow>
                    <TableHead>节点</TableHead>
                    <TableHead>公钥</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directory.items.map((item) => {
                    const itemLabel = shortId(item.id)

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <code className="node-browser-key" translate="no">
                            {itemLabel}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="node-browser-key" translate="no">
                            {shortId(item.flowNodePubkey)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className="node-browser-badges">
                            {item.registered ? <Badge>注册</Badge> : null}
                            {item.authorized ? <Badge variant="secondary">授权</Badge> : null}
                            {item.locked ? <Badge variant="destructive">锁定</Badge> : null}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="browse-pager">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={!directory.hasPrevious || directory.loading}
                onClick={() => browse(directory.page - 1)}
              >
                上一页
              </Button>
              <span>第 {directory.page + 1} 页</span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={!directory.hasNext || directory.loading}
                onClick={() => browse(directory.page + 1)}
              >
                下一页
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
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
    <Toggle variant="outline" size="sm" pressed={active} onPressedChange={onToggle}>
      {label}
    </Toggle>
  )
}
