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
        <button className="secondary-button" type="button" onClick={onCreateRecord}>
          创建交易记录
        </button>
      ) : null}
      {onCreateMount ? (
        <button className="secondary-button" type="button" onClick={onCreateMount}>
          挂载已有记录
        </button>
      ) : null}
    </>
  )
}
