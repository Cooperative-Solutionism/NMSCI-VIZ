import { useState } from 'react'
import { Activity, Search } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Field, FieldGroup, FieldLabel } from '../../../../components/ui/field'
import { Input } from '../../../../components/ui/input'
import { DetailRow } from '../../../../components/DetailRow'
import { useReturningFlowRateLookup } from '../../../../hooks/useReturningFlowRateLookup'
import { formatAmount } from '../../../../lib/chainGraph'
import { formatRate } from '../../../../lib/format'

// 压缩公钥：02/03 前缀 + 64 位十六进制（与后端 validateRequiredCompressedPubkey 一致）。
const pubkeyPattern = /^0[23][0-9a-fA-F]{64}$/

export function FlowIndexBrowser({ apiBase }: { apiBase: string }) {
  const { data, error, status, lookup } = useReturningFlowRateLookup(apiBase)
  const [sourcePubkey, setSourcePubkey] = useState('')
  const [targetPubkey, setTargetPubkey] = useState('')

  const source = sourcePubkey.trim()
  const target = targetPubkey.trim()
  const canQuery = pubkeyPattern.test(source) && pubkeyPattern.test(target) && status !== 'loading'

  const handleQuery = () => {
    if (!canQuery) return
    void lookup(source, target)
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" aria-hidden="true" />
            回流指数
          </CardTitle>
        </CardHeader>
        <CardContent className="node-browser-body">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="flow-index-source">来源节点公钥</FieldLabel>
              <Input
                id="flow-index-source"
                name="flowIndexSource"
                autoComplete="off"
                spellCheck={false}
                translate="no"
                placeholder="source 公钥（66 位十六进制）"
                value={sourcePubkey}
                onChange={(event) => setSourcePubkey(event.currentTarget.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="flow-index-target">目标节点公钥</FieldLabel>
              <Input
                id="flow-index-target"
                name="flowIndexTarget"
                autoComplete="off"
                spellCheck={false}
                translate="no"
                placeholder="target 公钥（66 位十六进制）"
                value={targetPubkey}
                onChange={(event) => setTargetPubkey(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleQuery()
                  }
                }}
              />
            </Field>
            <Button
              variant="secondary"
              type="button"
              className="browse-filter-action"
              disabled={!canQuery}
              onClick={handleQuery}
            >
              <Search data-icon="inline-start" />
              {status === 'loading' ? '计算中…' : '计算指数'}
            </Button>
            <p className="text-sm text-muted-foreground">
              计算 source → target 之间的总金额、成环金额、未成环金额与回流率。
            </p>
          </FieldGroup>
        </CardContent>
      </Card>

      {status === 'error' ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>指数查询失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {status === 'loaded' && data ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="section-title">source → target 回流指数</div>
            <DetailRow
              label="总金额"
              value={formatAmount(data.loopedAmount + data.unloopedAmount, data.currencyType)}
            />
            <DetailRow
              label="成环金额"
              value={formatAmount(data.loopedAmount, data.currencyType)}
            />
            <DetailRow
              label="未成环金额"
              value={formatAmount(data.unloopedAmount, data.currencyType)}
            />
            <DetailRow label="回流率" value={formatRate(data.returningFlowRate)} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
