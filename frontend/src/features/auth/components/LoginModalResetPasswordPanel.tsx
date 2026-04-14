import { RESET_FIELDS } from './LoginModal.constants'
import { FeedbackText, FormFields, InlineLinkButton, PanelForm } from './LoginModalPanelShared'
import type { ResetPasswordPanelProps } from './LoginModal.types'
import styles from './LoginModal.module.css'

export function LoginModalResetPasswordPanel({
  resetForm,
  resetErrors,
  resetFeedback,
  resetLoading,
  showResetPassword,
  showResetConfirm,
  onFieldChange,
  onToggleResetPassword,
  onToggleResetConfirm,
  onUseAnotherEmail,
  onBackToSignIn,
  onSubmit,
}: ResetPasswordPanelProps) {
  return (
    <PanelForm onSubmit={onSubmit}>
      <div className={styles.panelIntro}>
        <p className={styles.panelDescription}>
          Enter the email address that received the code, then use that 6-digit verification code to choose a new password.
        </p>
      </div>
      <FeedbackText feedback={resetFeedback} />
      <FormFields
        prefix="reset"
        fields={RESET_FIELDS}
        values={resetForm}
        errors={resetErrors}
        visibility={{ newPassword: showResetPassword, confirm: showResetConfirm }}
        onFieldChange={onFieldChange}
        onToggleVisibility={(key) => {
          if (key === 'newPassword') onToggleResetPassword()
          if (key === 'confirm') onToggleResetConfirm()
        }}
      />
      <button type="submit" className={styles.submitButton} disabled={resetLoading}>
        {resetLoading ? 'Updating password...' : 'Reset Password'}
      </button>
      <div className={styles.inlineActions}>
        <InlineLinkButton onClick={onUseAnotherEmail}>Use another email</InlineLinkButton>
        <InlineLinkButton onClick={onBackToSignIn}>Back to sign in</InlineLinkButton>
      </div>
    </PanelForm>
  )
}
