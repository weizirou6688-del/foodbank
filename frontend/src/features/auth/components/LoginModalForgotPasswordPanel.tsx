import { FORGOT_FIELDS } from './LoginModal.constants'
import { FeedbackText, FormFields, InlineLinkButton, PanelForm } from './LoginModalPanelShared'
import type { ForgotPasswordPanelProps } from './LoginModal.types'
import styles from './LoginModal.module.css'

export function LoginModalForgotPasswordPanel({
  forgotEmail,
  forgotFeedback,
  forgotLoading,
  onEmailChange,
  onBackToSignIn,
  onSubmit,
}: ForgotPasswordPanelProps) {
  return (
    <PanelForm onSubmit={onSubmit}>
      <div className={styles.panelIntro}>
        <p className={styles.panelDescription}>
          Enter your account email. If it exists, we&apos;ll send a 6-digit verification code to that inbox.
        </p>
      </div>
      <FormFields
        prefix="forgot"
        fields={FORGOT_FIELDS}
        values={{ email: forgotEmail }}
        onFieldChange={(_, value) => onEmailChange(value)}
      />
      <FeedbackText feedback={forgotFeedback} />
      <button type="submit" className={styles.submitButton} disabled={forgotLoading}>
        {forgotLoading ? 'Sending code...' : 'Send Verification Code'}
      </button>
      <div className={styles.inlineActions}>
        <InlineLinkButton onClick={onBackToSignIn}>Back to sign in</InlineLinkButton>
      </div>
    </PanelForm>
  )
}
