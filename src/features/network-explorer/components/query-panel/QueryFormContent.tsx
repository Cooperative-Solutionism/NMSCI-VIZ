import {
  AlertCircle,
  CircleDot,
  Download,
  Info,
  KeyRound,
  LocateFixed,
  Lock,
  LockOpen,
  Orbit,
  Plus,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '../../../../components/ui/field'
import { Input } from '../../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select'
import { Separator } from '../../../../components/ui/separator'
import { Textarea } from '../../../../components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../../../../components/ui/toggle-group'
import { statusLabel } from '../../../../lib/consumeChainFilters'
import type { CurrencyFilter } from '../../../../hooks/useConsumeChainQuery'
import type { QueryFormContentProps } from './types'

const queryModeOptions = [
  { value: 'start', label: '起点', icon: LocateFixed },
  { value: 'end', label: '终点', icon: CircleDot },
  { value: 'node', label: '节点', icon: Orbit },
] satisfies Array<{
  value: QueryFormContentProps['mode']
  label: string
  icon: LucideIcon
}>

const currencyOptions = [
  { value: 'all', label: '全部' },
  { value: '1', label: 'CNY' },
  { value: '0', label: 'Au 微克' },
] satisfies Array<{ value: CurrencyFilter; label: string }>

export function QueryFormContent({
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
  onOpenVault,
  onRunQuery,
  onSetCurrencyFilter,
  onSetLoopStatus,
  onSetMode,
  onSetNodeId,
  requestUrl,
  vaultStatus,
  warning,
}: QueryFormContentProps) {
  const nodeIdEmpty = nodeId.trim().length === 0
  const VaultIcon =
    vaultStatus === 'unlocked' ? Lock : vaultStatus === 'setup' ? ShieldCheck : LockOpen
  const vaultLabel =
    vaultStatus === 'unlocked'
      ? '锁定密钥保险库'
      : vaultStatus === 'setup'
        ? '创建密钥保险库'
        : '解锁密钥保险库'
  const vaultAction = vaultStatus === 'unlocked' ? onLockVault : onOpenVault

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>链路查询</CardTitle>
          <CardDescription>
            按流转节点 ID 或公钥加载消费链路，并在当前图谱中浏览结果。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="query-api-base">API 基址</FieldLabel>
              <Input
                id="query-api-base"
                name="apiBase"
                autoComplete="off"
                value={apiBase}
                onChange={(event) => onApiBaseChange(event.currentTarget.value)}
                spellCheck={false}
              />
            </Field>

            <Field>
              <FieldTitle id="query-mode-label">模式</FieldTitle>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => {
                  if (value) onSetMode(value as QueryFormContentProps['mode'])
                }}
                aria-labelledby="query-mode-label"
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
              >
                {queryModeOptions.map(({ value, label, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value}>
                    <Icon data-icon="inline-start" />
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="query-node-id">流转节点 ID / 公钥</FieldLabel>
              <Textarea
                id="query-node-id"
                name="nodeId"
                autoComplete="off"
                rows={3}
                value={nodeId}
                onChange={(event) => onSetNodeId(event.currentTarget.value)}
                spellCheck={false}
                aria-describedby="query-node-id-description"
              />
              <FieldDescription id="query-node-id-description">
                支持 UUID 或 66 位十六进制公钥（自动识别）。
              </FieldDescription>
            </Field>

            <Field>
              <FieldTitle id="query-loop-status-label">循环状态</FieldTitle>
              <ToggleGroup
                type="single"
                value={loopStatus}
                onValueChange={(value) => {
                  if (value) onSetLoopStatus(value as QueryFormContentProps['loopStatus'])
                }}
                aria-labelledby="query-loop-status-label"
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
              >
                {(['all', 'looped', 'open'] as const).map((status) => (
                  <ToggleGroupItem key={status} value={status}>
                    {statusLabel(status)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="query-currency-filter">币种</FieldLabel>
              <Select
                name="currencyFilter"
                value={currencyFilter}
                onValueChange={(value) => onSetCurrencyFilter(value as CurrencyFilter)}
              >
                <SelectTrigger id="query-currency-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>已加载结果视图过滤。</FieldDescription>
            </Field>

            <Button
              type="button"
              disabled={loading || nodeIdEmpty}
              aria-describedby={nodeIdEmpty ? 'load-disabled-reason' : undefined}
              onClick={() => void onRunQuery()}
            >
              <Search data-icon="inline-start" />
              {loading ? '加载中…' : '加载'}
            </Button>
            {nodeIdEmpty ? (
              <span id="load-disabled-reason" className="sr-only">
                请输入流转节点 UUID 后加载链路数据。
              </span>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden="true" />
            本地节点
          </CardTitle>
          <CardDescription>需要访问私钥的操作会按需打开密钥保险库弹窗。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" type="button" onClick={onAddFlowNode}>
              <Plus data-icon="inline-start" />
              新建流转节点
            </Button>
            <Button variant="secondary" type="button" onClick={onAddConsumeNode}>
              <Plus data-icon="inline-start" />
              新建消费节点
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" type="button" onClick={vaultAction}>
              <VaultIcon data-icon="inline-start" />
              {vaultLabel}
            </Button>
            <Button variant="outline" type="button" onClick={onImportLocalNode}>
              <Download data-icon="inline-start" />
              导入流转节点
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="request-preview">
        <Badge variant="outline">请求</Badge>
        <code translate="no">{requestUrl}</code>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>查询失败</AlertTitle>
          <AlertDescription>{error}。当前图谱已保持不变。</AlertDescription>
        </Alert>
      ) : null}
      {warning ? (
        <Alert role="status" aria-live="polite">
          <Info />
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
      {extended ? (
        <Alert role="status" aria-live="polite">
          <Info />
          <AlertTitle>图谱已扩展</AlertTitle>
          <AlertDescription>已扩展图谱视图；重新加载查询可恢复干净的后端结果。</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
