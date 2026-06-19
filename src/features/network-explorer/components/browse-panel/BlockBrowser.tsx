import { AlertCircle, Box, Search } from 'lucide-react'
import { useCallback } from 'react'
import { defaultBlockPageSize } from '../../../../app/config'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../../../components/ui/field'
import { Input } from '../../../../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table'
import { useBlockBrowser } from '../../../../hooks/useBlockBrowser'
import { shortId } from '../../../../lib/chainGraph'
import { useUrlNumberParam } from '../../../../shared/hooks/useUrlQueryParam'

function normalizePage(value: number): number {
  return Math.max(0, Math.trunc(value))
}

function normalizePageSize(value: number): number {
  return Math.max(1, Math.trunc(value))
}

export function BlockBrowser({ apiBase }: { apiBase: string }) {
  const browser = useBlockBrowser(apiBase)
  const [page, setPage] = useUrlNumberParam('blockBrowserPage', 0, normalizePage)
  const [pageSize, setPageSize] = useUrlNumberParam(
    'blockBrowserSize',
    defaultBlockPageSize,
    normalizePageSize,
  )

  const loadPage = useCallback(
    (requestedPage: number) => {
      const nextPage = normalizePage(requestedPage)
      setPage(nextPage)
      void browser.load({ page: nextPage, size: pageSize })
    },
    [browser, pageSize, setPage],
  )

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="size-4" aria-hidden="true" />
            区块
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="browse-filter-grid">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="block-browser-page">区块页码</FieldLabel>
                <Input
                  id="block-browser-page"
                  name="blockPage"
                  type="number"
                  min={1}
                  value={page + 1}
                  onChange={(event) => setPage(Number(event.currentTarget.value) - 1)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="block-browser-size">区块每页数量</FieldLabel>
                <Input
                  id="block-browser-size"
                  name="blockPageSize"
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
              type="button"
              className="browse-filter-action"
              disabled={browser.loading}
              onClick={() => loadPage(page)}
            >
              <Search data-icon="inline-start" />
              {browser.loading ? '加载中…' : '加载区块'}
            </Button>
            {browser.latestHeight == null ? (
              <FieldDescription>
                区块列表会先读取最新高度，再按高度批量加载当前页。
              </FieldDescription>
            ) : (
              <FieldDescription>最新高度 {browser.latestHeight}。</FieldDescription>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {browser.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>区块加载失败</AlertTitle>
          <AlertDescription>{browser.error}</AlertDescription>
        </Alert>
      ) : null}

      {browser.items.length > 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="browse-results-table" data-testid="block-results-table">
              <Table aria-label="区块列表">
                <TableHeader>
                  <TableRow>
                    <TableHead>高度</TableHead>
                    <TableHead>区块</TableHead>
                    <TableHead>Merkle</TableHead>
                    <TableHead>时间戳</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {browser.items.map((block) => (
                    <TableRow key={block.id}>
                      <TableCell>
                        <Badge variant="outline">高度 {block.height}</Badge>
                      </TableCell>
                      <TableCell>
                        <code translate="no">{shortId(block.id)}</code>
                      </TableCell>
                      <TableCell>
                        <code translate="no">{shortId(block.merkleRoot)}</code>
                      </TableCell>
                      <TableCell>{block.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="browse-pager">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={!browser.hasPrevious || browser.loading}
                onClick={() => loadPage(browser.page - 1)}
              >
                上一页
              </Button>
              <span>第 {browser.page + 1} 页</span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={!browser.hasNext || browser.loading}
                onClick={() => loadPage(browser.page + 1)}
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
