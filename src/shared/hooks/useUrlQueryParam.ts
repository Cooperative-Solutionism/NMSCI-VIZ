import { useCallback, useEffect, useState, type SetStateAction } from 'react'

function currentParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get(key)
}

function replaceParam(key: string, value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value == null || value.length === 0) {
    url.searchParams.delete(key)
  } else {
    url.searchParams.set(key, value)
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, '', nextUrl)
}

function resolveAction<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === 'function' ? (action as (value: T) => T)(current) : action
}

export function useUrlStateParam<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    const initial = currentParam(key)
    return initial && isValid(initial) ? initial : fallback
  })

  useEffect(() => {
    const onPopState = () => {
      const next = currentParam(key)
      setValue(next && isValid(next) ? next : fallback)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [fallback, isValid, key])

  const setUrlValue = useCallback(
    (action: SetStateAction<T>) => {
      setValue((current) => {
        const next = resolveAction(action, current)
        replaceParam(key, next === fallback ? null : next)
        return next
      })
    },
    [fallback, key],
  )

  return [value, setUrlValue] as const
}

export function useUrlBooleanParam(key: string, fallback = false) {
  const [value, setValue] = useState(() => currentParam(key) === '1' || fallback)

  useEffect(() => {
    const onPopState = () => setValue(currentParam(key) === '1' || fallback)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [fallback, key])

  const setUrlValue = useCallback(
    (action: SetStateAction<boolean>) => {
      setValue((current) => {
        const next = resolveAction(action, current)
        replaceParam(key, next === fallback ? null : next ? '1' : '0')
        return next
      })
    },
    [fallback, key],
  )

  return [value, setUrlValue] as const
}

export function useUrlNumberParam(
  key: string,
  fallback: number,
  normalize: (value: number) => number = (value) => value,
) {
  const read = useCallback(() => {
    const raw = currentParam(key)
    const parsed = raw == null ? NaN : Number(raw)
    return Number.isFinite(parsed) ? normalize(parsed) : fallback
  }, [fallback, key, normalize])
  const [value, setValue] = useState(read)

  useEffect(() => {
    const onPopState = () => setValue(read())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [read])

  const setUrlValue = useCallback(
    (action: SetStateAction<number>) => {
      setValue((current) => {
        const next = normalize(resolveAction(action, current))
        replaceParam(key, next === fallback ? null : String(next))
        return next
      })
    },
    [fallback, key, normalize],
  )

  return [value, setUrlValue] as const
}
