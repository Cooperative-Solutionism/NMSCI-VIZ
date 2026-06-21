import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'

type ImportExternalNodeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 粘贴公钥/ID：复用后端查询加载并显示其消费链图谱，并入当前画布。
  onImportIdentifier: (identifier: string) => void
  // 上传此前导出的消费链 JSON：离线解析并并入当前画布。
  onImportJson: (text: string) => void
}

// 表单状态随弹窗内容挂载而重建：每次打开都从空白开始。
function ImportDialogBody({
  onImportIdentifier,
  onImportJson,
  onOpenChange,
}: Pick<ImportExternalNodeDialogProps, 'onImportIdentifier' | 'onImportJson' | 'onOpenChange'>) {
  const [identifier, setIdentifier] = useState('')
  const trimmed = identifier.trim()

  const handleSubmitIdentifier = () => {
    if (!trimmed) return
    onImportIdentifier(trimmed)
    onOpenChange(false)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    // 重置以便同一文件可再次选择触发 change。
    event.currentTarget.value = ''
    if (!file) return
    try {
      const text = await file.text()
      onImportJson(text)
      onOpenChange(false)
    } catch {
      // 读取失败极少见：保留弹窗，错误经全局提示反馈。
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="import-external-identifier">公钥 / 节点 ID</FieldLabel>
        <Input
          id="import-external-identifier"
          name="importExternalIdentifier"
          autoComplete="off"
          spellCheck={false}
          translate="no"
          placeholder="粘贴外部节点公钥（hex）或后端 ID"
          value={identifier}
          onChange={(event) => setIdentifier(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmitIdentifier()
            }
          }}
        />
        <p className="text-sm text-muted-foreground">
          无需私钥，加载该外部节点的消费链并并入当前画布。
        </p>
        <Button type="button" disabled={!trimmed} onClick={handleSubmitIdentifier}>
          加载消费链
        </Button>
      </Field>

      <Field>
        <FieldLabel htmlFor="import-external-json">从 JSON 文件导入</FieldLabel>
        <Input
          id="import-external-json"
          name="importExternalJson"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleFileChange(event)}
        />
        <p className="text-sm text-muted-foreground">
          选择此前「导出 JSON」的消费链文件，离线渲染并并入当前画布。
        </p>
      </Field>
    </FieldGroup>
  )
}

export function ImportExternalNodeDialog({
  open,
  onOpenChange,
  onImportIdentifier,
  onImportJson,
}: ImportExternalNodeDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="关闭导入外部节点"
        className="fixed inset-0 isolate z-50 h-auto w-auto cursor-default rounded-none bg-black/10 p-0 hover:bg-black/10"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="font-heading text-base leading-none font-medium">
            导入外部节点
          </h2>
          <p id={descriptionId} className="text-sm text-muted-foreground">
            通过公钥/ID 加载外部节点的消费链，或导入此前导出的 JSON，复用图谱的加载与查看能力。
          </p>
        </div>
        <ImportDialogBody
          onImportIdentifier={onImportIdentifier}
          onImportJson={onImportJson}
          onOpenChange={onOpenChange}
        />
        <Button
          variant="ghost"
          className="absolute top-2 right-2"
          size="icon-sm"
          type="button"
          onClick={() => onOpenChange(false)}
        >
          <XIcon />
          <span className="sr-only">关闭</span>
        </Button>
      </div>
    </>
  )
}
