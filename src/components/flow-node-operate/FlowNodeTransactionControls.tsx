import { Button } from '../ui/button'

interface FlowNodeTransactionControlsProps {
  onCreateMount?: () => void
  onCreateRecord?: () => void
}

export function FlowNodeTransactionControls({
  onCreateMount,
  onCreateRecord,
}: FlowNodeTransactionControlsProps) {
  if (!onCreateRecord && !onCreateMount) return null

  return (
    <>
      <div className="section-title">交易</div>
      {onCreateRecord ? (
        <Button variant="secondary" type="button" onClick={onCreateRecord}>
          创建交易记录
        </Button>
      ) : null}
      {onCreateMount ? (
        <Button variant="secondary" type="button" onClick={onCreateMount}>
          挂载已有记录
        </Button>
      ) : null}
    </>
  )
}
