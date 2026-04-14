import { REGISTER_FIELDS } from './LoginModal.constants'
import { FormFields, PanelForm } from './LoginModalPanelShared'
import type { RegisterPanelProps } from './LoginModal.types'
import styles from './LoginModal.module.css'

export function LoginModalRegisterPanel({
  regForm,
  regErrors,
  regLoading,
  showRegisterPassword,
  showRegisterConfirm,
  onFieldChange,
  onToggleRegisterPassword,
  onToggleRegisterConfirm,
  onSubmit,
}: RegisterPanelProps) {
  return (
    <PanelForm onSubmit={onSubmit}>
      <FormFields
        prefix="register"
        fields={REGISTER_FIELDS}
        values={regForm}
        errors={regErrors}
        visibility={{ password: showRegisterPassword, confirm: showRegisterConfirm }}
        onFieldChange={onFieldChange}
        onToggleVisibility={(key) => {
          if (key === 'password') onToggleRegisterPassword()
          if (key === 'confirm') onToggleRegisterConfirm()
        }}
      />
      <button type="submit" className={styles.submitButton} disabled={regLoading}>
        {regLoading ? 'Creating account...' : 'Create Account'}
      </button>
    </PanelForm>
  )
}
