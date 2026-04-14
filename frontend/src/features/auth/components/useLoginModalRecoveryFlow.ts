import { useCallback, useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import { isValidEmail } from '@/shared/lib/validation'
import {
  clearFormErrors,
  createEmptyResetForm,
  type FormErrors,
  validateResetForm,
} from './LoginModalState.helpers'
import type { Feedback, ResetFormState, SignInView } from './LoginModal.types'

type UseLoginModalRecoveryFlowOptions = {
  signInEmail: string
  clearSignInStatus: () => void
  syncSignInEmail: (email: string) => void
  completePasswordReset: (email: string, notice: string) => void
}

export function useLoginModalRecoveryFlow({
  signInEmail,
  clearSignInStatus,
  syncSignInEmail,
  completePasswordReset,
}: UseLoginModalRecoveryFlowOptions) {
  const { forgotPassword, resetPassword } = useAuthStore()

  const [signInView, setSignInView] = useState<SignInView>('signin')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState<Feedback | null>(null)

  const [resetForm, setResetForm] = useState<ResetFormState>(createEmptyResetForm)
  const [resetErrors, setResetErrors] = useState<FormErrors>({})
  const [resetLoading, setResetLoading] = useState(false)
  const [resetFeedback, setResetFeedback] = useState<Feedback | null>(null)

  const resetState = useCallback(() => {
    setSignInView('signin')
    clearSignInStatus()
    setForgotEmail('')
    setForgotFeedback(null)
    setResetForm(createEmptyResetForm())
    setResetErrors({})
    setResetFeedback(null)
  }, [clearSignInStatus])

  const openForgotPassword = () => {
    setSignInView('forgot')
    clearSignInStatus()
    setForgotFeedback(null)
    setResetFeedback(null)
    setForgotEmail((current) => current || signInEmail)
  }

  const handleForgotPassword = async () => {
    if (!isValidEmail(forgotEmail)) {
      setForgotFeedback({ tone: 'error', message: 'Please enter a valid email.' })
      return
    }

    setForgotLoading(true)
    setForgotFeedback(null)
    const result = await forgotPassword(forgotEmail)
    setForgotLoading(false)

    if (!result.success) {
      setForgotFeedback({ tone: 'error', message: result.message ?? 'Unable to start password reset.' })
      return
    }

    syncSignInEmail(forgotEmail)
    setResetForm({ email: forgotEmail, verificationCode: '', newPassword: '', confirm: '' })
    setResetErrors({})
    setSignInView('reset')
    setResetFeedback({
      tone: 'success',
      message:
        result.message ??
        'If this email exists, a verification code has been sent. Enter it below with your new password.',
    })
  }

  const changeForgotEmail = (value: string) => {
    setForgotEmail(value)
    setForgotFeedback(null)
  }

  const backToSignInFromForgot = () => {
    setSignInView('signin')
    setForgotFeedback(null)
  }

  const updateResetField = (key: keyof ResetFormState, value: string) => {
    setResetForm((form) => ({ ...form, [key]: value }))
    setResetErrors((current) =>
      clearFormErrors(current, String(key), key === 'newPassword' || key === 'confirm' ? ['confirm'] : []),
    )
    setResetFeedback((current) => (current?.tone === 'error' ? null : current))
  }

  const handleResetPassword = async () => {
    const errors = validateResetForm(resetForm)

    setResetErrors(errors)
    setResetFeedback(null)
    if (Object.keys(errors).length > 0) return

    const email = resetForm.email.trim()
    setResetLoading(true)
    const result = await resetPassword(email, resetForm.verificationCode.trim(), resetForm.newPassword)
    setResetLoading(false)

    if (!result.success) {
      setResetFeedback({ tone: 'error', message: result.message ?? 'Password reset failed.' })
      return
    }

    setResetForm(createEmptyResetForm())
    setResetErrors({})
    setResetFeedback(null)
    setSignInView('signin')
    completePasswordReset(email, result.message ?? 'Password reset successful. Please sign in with your new password.')
  }

  const useAnotherEmail = () => {
    setForgotEmail(resetForm.email)
    setSignInView('forgot')
    setResetFeedback(null)
  }

  const backToSignInFromReset = () => {
    setSignInView('signin')
    setResetFeedback(null)
    setResetErrors({})
  }

  return {
    signInView,
    forgotEmail,
    forgotLoading,
    forgotFeedback,
    resetForm,
    resetErrors,
    resetLoading,
    resetFeedback,
    resetState,
    openForgotPassword,
    handleForgotPassword,
    changeForgotEmail,
    backToSignInFromForgot,
    updateResetField,
    handleResetPassword,
    useAnotherEmail,
    backToSignInFromReset,
  }
}
