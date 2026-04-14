import { useEffect, useState } from 'react'
import {
  createPasswordVisibilityState,
  modalTitleFor,
  type PasswordVisibilityKey,
} from './LoginModalState.helpers'
import type { AuthTab, LoginModalProps } from './LoginModal.types'
import { useLoginModalRecoveryFlow } from './useLoginModalRecoveryFlow'
import { useLoginModalRegisterFlow } from './useLoginModalRegisterFlow'
import { useLoginModalSignInFlow } from './useLoginModalSignInFlow'

type UseLoginModalStateOptions = Pick<
  LoginModalProps,
  'initialTab' | 'isOpen' | 'onClose' | 'redirectTo' | 'requiredRole'
>

export function useLoginModalState({
  initialTab = 'signin',
  isOpen,
  onClose,
  redirectTo,
  requiredRole,
}: UseLoginModalStateOptions) {
  const [tab, setTab] = useState<AuthTab>(initialTab)

  const signInFlow = useLoginModalSignInFlow({
    onClose,
    redirectTo,
    requiredRole,
  })
  const recoveryFlow = useLoginModalRecoveryFlow({
    signInEmail: signInFlow.signInForm.email,
    clearSignInStatus: signInFlow.clearStatus,
    syncSignInEmail: signInFlow.syncEmail,
    completePasswordReset: signInFlow.completePasswordReset,
  })
  const registerFlow = useLoginModalRegisterFlow({ onClose })
  const { resetState } = recoveryFlow

  const [passwordVisibility, setPasswordVisibility] = useState(createPasswordVisibilityState)

  const togglePasswordVisibility = (key: PasswordVisibilityKey) => {
    setPasswordVisibility((state) => ({ ...state, [key]: !state[key] }))
  }

  const resetAuthViews = (nextTab: AuthTab) => {
    setTab(nextTab)
    resetState()
    setPasswordVisibility(createPasswordVisibilityState())
  }

  useEffect(() => {
    if (!isOpen) return
    setTab(initialTab)
    resetState()
    setPasswordVisibility(createPasswordVisibilityState())
  }, [initialTab, isOpen, resetState])

  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  return {
    tab,
    signInView: recoveryFlow.signInView,
    modalTitle: modalTitleFor(tab, recoveryFlow.signInView),
    signInForm: signInFlow.signInForm,
    signInError: signInFlow.signInError,
    signInNotice: signInFlow.signInNotice,
    signInLoading: signInFlow.signInLoading,
    forgotEmail: recoveryFlow.forgotEmail,
    forgotLoading: recoveryFlow.forgotLoading,
    forgotFeedback: recoveryFlow.forgotFeedback,
    resetForm: recoveryFlow.resetForm,
    resetErrors: recoveryFlow.resetErrors,
    resetLoading: recoveryFlow.resetLoading,
    resetFeedback: recoveryFlow.resetFeedback,
    regForm: registerFlow.regForm,
    regErrors: registerFlow.regErrors,
    regLoading: registerFlow.regLoading,
    passwordVisibility,
    resetAuthViews,
    togglePasswordVisibility,
    updateSignInField: signInFlow.updateSignInField,
    handleSignIn: signInFlow.handleSignIn,
    openForgotPassword: recoveryFlow.openForgotPassword,
    handleForgotPassword: recoveryFlow.handleForgotPassword,
    changeForgotEmail: recoveryFlow.changeForgotEmail,
    backToSignInFromForgot: recoveryFlow.backToSignInFromForgot,
    updateResetField: recoveryFlow.updateResetField,
    handleResetPassword: recoveryFlow.handleResetPassword,
    useAnotherEmail: recoveryFlow.useAnotherEmail,
    backToSignInFromReset: recoveryFlow.backToSignInFromReset,
    updateRegisterField: registerFlow.updateRegisterField,
    handleRegister: registerFlow.handleRegister,
  }
}
