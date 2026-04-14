import { SIGNIN_FIELDS } from './LoginModal.constants'
import { DemoAccountsCard, FormFields, InlineLinkButton, PanelForm } from './LoginModalPanelShared'
import type { SignInPanelProps } from './LoginModal.types'
import styles from './LoginModal.module.css'

export function LoginModalSignInPanel({
  signInForm,
  signInError,
  signInNotice,
  signInLoading,
  showSignInPassword,
  onFieldChange,
  onTogglePassword,
  onOpenForgotPassword,
  onSubmit,
}: SignInPanelProps) {
  return (
    <PanelForm onSubmit={onSubmit}>
      <FormFields
        prefix="signin"
        fields={SIGNIN_FIELDS}
        values={signInForm}
        visibility={{ password: showSignInPassword }}
        onFieldChange={onFieldChange}
        onToggleVisibility={(key) => {
          if (key === 'password') onTogglePassword()
        }}
      />
      {signInError ? <p className={styles.errorText}>{signInError}</p> : null}
      {signInNotice ? <p className={styles.successText}>{signInNotice}</p> : null}
      <div className={styles.inlineActions}>
        <InlineLinkButton onClick={onOpenForgotPassword}>Forgot password?</InlineLinkButton>
      </div>
      <button type="submit" className={styles.submitButton} disabled={signInLoading}>
        {signInLoading ? 'Signing in...' : 'Sign In'}
      </button>
      <DemoAccountsCard />
    </PanelForm>
  )
}
