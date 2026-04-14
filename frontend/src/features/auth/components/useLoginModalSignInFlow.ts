import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { isValidEmail } from '@/shared/lib/validation'
import { getPostLoginRedirect } from '../auth.helpers'
import { createEmptySignInForm } from './LoginModalState.helpers'
import type { LoginModalProps, SignInFormState } from './LoginModal.types'

type UseLoginModalSignInFlowOptions = Pick<LoginModalProps, 'onClose' | 'redirectTo' | 'requiredRole'>

export function useLoginModalSignInFlow({
  onClose,
  redirectTo,
  requiredRole,
}: UseLoginModalSignInFlowOptions) {
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const [signInForm, setSignInForm] = useState<SignInFormState>(createEmptySignInForm)
  const [signInError, setSignInError] = useState('')
  const [signInNotice, setSignInNotice] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)

  const clearStatus = useCallback(() => {
    setSignInError('')
    setSignInNotice('')
  }, [])

  const updateSignInField = (key: keyof SignInFormState, value: string) => {
    setSignInForm((form) => ({ ...form, [key]: value }))
  }

  const syncEmail = useCallback((email: string) => {
    setSignInForm((form) => ({ ...form, email }))
  }, [])

  const completePasswordReset = useCallback((email: string, notice: string) => {
    setSignInForm((form) => ({ ...form, email, password: '' }))
    setSignInError('')
    setSignInNotice(notice)
  }, [])

  const handleSignIn = async () => {
    clearStatus()
    if (!signInForm.email || !signInForm.password) {
      setSignInError('Please fill in all fields.')
      return
    }

    if (!isValidEmail(signInForm.email)) {
      setSignInError('Please enter a valid email.')
      return
    }

    setSignInLoading(true)
    const result = await login(signInForm.email, signInForm.password)
    setSignInLoading(false)

    if (!result.success) {
      setSignInError(result.message ?? 'Login failed.')
      return
    }

    onClose()
    const { user } = useAuthStore.getState()
    const destination = getPostLoginRedirect(user, redirectTo, requiredRole)

    if (destination) {
      navigate(destination, destination.startsWith('/admin') || destination.startsWith('/workspace') ? { replace: true } : undefined)
    }
  }

  return {
    signInForm,
    signInError,
    signInNotice,
    signInLoading,
    clearStatus,
    updateSignInField,
    syncEmail,
    completePasswordReset,
    handleSignIn,
  }
}
