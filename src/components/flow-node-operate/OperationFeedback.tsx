interface OperationFeedbackProps {
  error: string | null
  lastRawBytes: string
  status: string | null
}

export function OperationFeedback({ error, lastRawBytes, status }: OperationFeedbackProps) {
  return (
    <>
      {status ? (
        <p className="operation-message" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="operation-message error" role="alert">
          {error}
        </p>
      ) : null}
      {lastRawBytes ? (
        <div className="raw-preview">
          <span>最近原始消息</span>
          <code translate="no">{lastRawBytes}</code>
        </div>
      ) : null}
    </>
  )
}
