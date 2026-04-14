import { AUTH_TABS } from './LoginModal.constants'
import { LoginModalForgotPasswordPanel } from './LoginModalForgotPasswordPanel'
import { LoginModalRegisterPanel } from './LoginModalRegisterPanel'
import { LoginModalResetPasswordPanel } from './LoginModalResetPasswordPanel'
import { LoginModalSignInPanel } from './LoginModalSignInPanel'
import type { LoginModalProps } from './LoginModal.types'
import { useLoginModalState } from './useLoginModalState'
import styles from './LoginModal.module.css'

export default function LoginModal(props: LoginModalProps) {
  const { isOpen, onClose } = props
  const {
    tab,
    signInView,
    modalTitle,
    signInForm,
    signInError,
    signInNotice,
    signInLoading,
    forgotEmail,
    forgotLoading,
    forgotFeedback,
    resetForm,
    resetErrors,
    resetLoading,
    resetFeedback,
    regForm,
    regErrors,
    regLoading,
    passwordVisibility,
    resetAuthViews,
    togglePasswordVisibility,
    updateSignInField,
    handleSignIn,
    openForgotPassword,
    handleForgotPassword,
    changeForgotEmail,
    backToSignInFromForgot,
    updateResetField,
    handleResetPassword,
    useAnotherEmail,
    backToSignInFromReset,
    updateRegisterField,
    handleRegister,
  } = useLoginModalState(props)

  if (!isOpen) return null

  const renderActivePanel = () => {
    if (tab === 'register') {
      return (
        <LoginModalRegisterPanel
          regForm={regForm}
          regErrors={regErrors}
          regLoading={regLoading}
          showRegisterPassword={passwordVisibility.register}
          showRegisterConfirm={passwordVisibility.registerConfirm}
          onFieldChange={updateRegisterField}
          onToggleRegisterPassword={() => togglePasswordVisibility('register')}
          onToggleRegisterConfirm={() => togglePasswordVisibility('registerConfirm')}
          onSubmit={handleRegister}
        />
      )
    }

    if (signInView === 'forgot') {
      return (
        <LoginModalForgotPasswordPanel
          forgotEmail={forgotEmail}
          forgotFeedback={forgotFeedback}
          forgotLoading={forgotLoading}
          onEmailChange={changeForgotEmail}
          onBackToSignIn={backToSignInFromForgot}
          onSubmit={handleForgotPassword}
        />
      )
    }

    if (signInView === 'reset') {
      return (
        <LoginModalResetPasswordPanel
          resetForm={resetForm}
          resetErrors={resetErrors}
          resetFeedback={resetFeedback}
          resetLoading={resetLoading}
          showResetPassword={passwordVisibility.reset}
          showResetConfirm={passwordVisibility.resetConfirm}
          onFieldChange={updateResetField}
          onToggleResetPassword={() => togglePasswordVisibility('reset')}
          onToggleResetConfirm={() => togglePasswordVisibility('resetConfirm')}
          onUseAnotherEmail={useAnotherEmail}
          onBackToSignIn={backToSignInFromReset}
          onSubmit={handleResetPassword}
        />
      )
    }

    return (
      <LoginModalSignInPanel
        signInForm={signInForm}
        signInError={signInError}
        signInNotice={signInNotice}
        signInLoading={signInLoading}
        showSignInPassword={passwordVisibility.signIn}
        onFieldChange={updateSignInField}
        onTogglePassword={() => togglePasswordVisibility('signIn')}
        onOpenForgotPassword={openForgotPassword}
        onSubmit={handleSignIn}
      />
    )
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
          &times;
        </button>
        <div className={styles.header}>
          <h1 id="login-modal-title" className={styles.title}>
            {modalTitle}
          </h1>
        </div>
        <div className={styles.tabs}>
          {AUTH_TABS.map((tabName) => (
            <button
              key={tabName}
              type="button"
              className={`${styles.tabItem} ${tab === tabName ? styles.tabItemActive : ''}`.trim()}
              onClick={() => resetAuthViews(tabName)}
            >
              {tabName === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {renderActivePanel()}
      </div>
    </div>
  )
}
