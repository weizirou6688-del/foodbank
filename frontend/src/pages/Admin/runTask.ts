import type { Dispatch, SetStateAction } from 'react'
import type { PageFeedback, PendingAction } from './adminFoodManagement.types'
import { toErrorMessage } from './rules'

export type BusySetter = Dispatch<SetStateAction<boolean>>
export type ErrorSetter = Dispatch<SetStateAction<string>>
export type PendingKey = Exclude<PendingAction, null>

type PageNotice = (tone: PageFeedback['tone'], message: string) => void

export function makeTaskRunner({
  accessToken,
  sessionExpiredMessage,
  setPageNotice,
  setPendingAction,
}: {
  accessToken: string | null
  sessionExpiredMessage: string
  setPageNotice: PageNotice
  setPendingAction?: Dispatch<SetStateAction<PendingAction>>
}) {
  const getToken = (report = (message: string) => setPageNotice('error', message)) =>
    accessToken || (report(sessionExpiredMessage), null)

  const reportError = (message: string, setError?: ErrorSetter, onError?: (message: string) => void) => {
    if (onError) onError(message)
    else if (setError) setError(message)
    else setPageNotice('error', message)
  }

  return {
    getToken,
    async runBusyTask({ setBusy, setError, fallbackMessage, task, onError }: { setBusy: BusySetter; setError?: ErrorSetter; fallbackMessage: string; task: (token: string) => Promise<void>; onError?: (message: string) => void }) {
      const token = getToken(setError)
      if (!token) return
      setBusy(true)
      setError?.('')
      try { await task(token) } catch (error) { reportError(toErrorMessage(error, fallbackMessage), setError, onError) } finally { setBusy(false) }
    },
    async runPendingTask<Result>({ action, fallbackMessage, task, onError, onSuccess, successMessage, afterSuccess, reportMissingToken }: { action: PendingKey; fallbackMessage: string; task: (token: string) => Promise<Result>; onError?: (message: string) => void; onSuccess?: (result: Result) => void; successMessage?: string; afterSuccess?: () => Promise<unknown> | unknown; reportMissingToken?: (message: string) => void }) {
      const token = getToken(reportMissingToken)
      if (!token) return undefined
      setPendingAction?.(action)
      try {
        const result = await task(token)
        await afterSuccess?.()
        onSuccess?.(result)
        if (successMessage) setPageNotice('success', successMessage)
        return result
      } catch (error) {
        reportError(toErrorMessage(error, fallbackMessage), undefined, onError)
        return undefined
      } finally {
        setPendingAction?.(null)
      }
    },
  }
}