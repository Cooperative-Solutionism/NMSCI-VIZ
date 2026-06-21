import { useCallback, useRef, useState, type FormEvent } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'

export interface UserConfirmPromptOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export interface UserTextPromptOptions {
  title: string
  label: string
  cancelLabel?: string
  confirmLabel?: string
  defaultValue?: string
  description?: string
  placeholder?: string
  type?: 'text' | 'password'
}

export type RequestUserConfirm = (options: UserConfirmPromptOptions) => Promise<boolean>
export type RequestUserText = (options: UserTextPromptOptions) => Promise<string | null>

interface ConfirmPromptState extends UserConfirmPromptOptions {
  id: number
}

interface TextPromptState extends UserTextPromptOptions {
  id: number
}

export function useUserPromptDialogs() {
  const nextIdRef = useRef(0)
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null)
  const textResolverRef = useRef<((value: string | null) => void) | null>(null)
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPromptState | null>(null)
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null)
  const [textValue, setTextValue] = useState('')

  const closeConfirmPrompt = useCallback((value: boolean) => {
    const resolver = confirmResolverRef.current
    confirmResolverRef.current = null
    setConfirmPrompt(null)
    resolver?.(value)
  }, [])

  const closeTextPrompt = useCallback((value: string | null) => {
    const resolver = textResolverRef.current
    textResolverRef.current = null
    setTextPrompt(null)
    setTextValue('')
    resolver?.(value)
  }, [])

  const requestConfirm = useCallback<RequestUserConfirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        confirmResolverRef.current?.(false)
        confirmResolverRef.current = resolve
        nextIdRef.current += 1
        setConfirmPrompt({ id: nextIdRef.current, ...options })
      }),
    [],
  )

  const requestText = useCallback<RequestUserText>(
    (options) =>
      new Promise<string | null>((resolve) => {
        textResolverRef.current?.(null)
        textResolverRef.current = resolve
        nextIdRef.current += 1
        setTextValue(options.defaultValue ?? '')
        setTextPrompt({ id: nextIdRef.current, ...options })
      }),
    [],
  )

  const handleTextSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      closeTextPrompt(textValue)
    },
    [closeTextPrompt, textValue],
  )

  const dialogs = (
    <>
      <AlertDialog
        open={confirmPrompt !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirmPrompt(false)
        }}
      >
        {confirmPrompt ? (
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmPrompt.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmPrompt.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => closeConfirmPrompt(false)}>
                {confirmPrompt.cancelLabel ?? '取消'}
              </Button>
              <Button
                type="button"
                variant={confirmPrompt.destructive ? 'destructive' : 'default'}
                onClick={() => closeConfirmPrompt(true)}
              >
                {confirmPrompt.confirmLabel ?? '确认'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <Dialog
        open={textPrompt !== null}
        onOpenChange={(open) => {
          if (!open) closeTextPrompt(null)
        }}
      >
        {textPrompt ? (
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleTextSubmit}>
              <DialogHeader>
                <DialogTitle>{textPrompt.title}</DialogTitle>
                {textPrompt.description ? (
                  <DialogDescription>{textPrompt.description}</DialogDescription>
                ) : null}
              </DialogHeader>
              <FieldGroup className="py-4">
                <Field>
                  <FieldLabel htmlFor={`user-text-prompt-${textPrompt.id}`}>
                    {textPrompt.label}
                  </FieldLabel>
                  <Input
                    id={`user-text-prompt-${textPrompt.id}`}
                    type={textPrompt.type ?? 'text'}
                    value={textValue}
                    placeholder={textPrompt.placeholder}
                    onChange={(event) => setTextValue(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => closeTextPrompt(null)}>
                  {textPrompt.cancelLabel ?? '取消'}
                </Button>
                <Button type="submit">{textPrompt.confirmLabel ?? '确认'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )

  return { dialogs, requestConfirm, requestText }
}
