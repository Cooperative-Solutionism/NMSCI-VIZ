import { useCallback, useReducer } from 'react'

export type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | 'record' | 'mount' | null

export interface OperationFeedbackState {
  busy: FlowNodeBusyState
  status: string | null
  error: string | null
}

export type OperationFeedbackAction =
  | { type: 'START'; busy: FlowNodeBusyState }
  | { type: 'SUCCESS'; status: string }
  | { type: 'FAILURE'; error: string }
  | { type: 'SET_BUSY'; busy: FlowNodeBusyState }
  | { type: 'NOTIFY_STATUS'; status: string | null }
  | { type: 'NOTIFY_ERROR'; error: string | null }

const initialFeedbackState: OperationFeedbackState = {
  busy: null,
  status: null,
  error: null,
}

export function useOperationFeedback() {
  const [{ busy, status, error }, dispatch] = useReducer(feedbackReducer, initialFeedbackState)

  const notifyStatus = useCallback((nextStatus: string | null) => {
    dispatch({ type: 'NOTIFY_STATUS', status: nextStatus })
  }, [])

  const notifyError = useCallback((nextError: string | null) => {
    dispatch({ type: 'NOTIFY_ERROR', error: nextError })
  }, [])

  return {
    busy,
    status,
    error,
    dispatch,
    notifyStatus,
    notifyError,
  }
}

function feedbackReducer(
  state: OperationFeedbackState,
  action: OperationFeedbackAction,
): OperationFeedbackState {
  switch (action.type) {
    case 'START':
      return { ...state, busy: action.busy, error: null }
    case 'SUCCESS':
      return { ...state, busy: null, status: action.status }
    case 'FAILURE':
      return { ...state, busy: null, error: action.error }
    case 'SET_BUSY':
      return { ...state, busy: action.busy }
    case 'NOTIFY_STATUS':
      return { ...state, status: action.status, error: null }
    case 'NOTIFY_ERROR':
      return { ...state, status: null, error: action.error }
  }
}
