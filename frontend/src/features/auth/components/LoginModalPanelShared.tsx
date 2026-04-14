import { type FormEvent, type ReactNode } from 'react'
import { getEnglishInputValidationProps } from '@/shared/lib/nativeValidation'
import { DEMO_SIGNIN_ACCOUNTS, getPasswordEmoji } from './LoginModal.constants'
import type {
  Feedback,
  FieldConfig,
  FieldErrors,
  FormValues,
  SubmitHandler,
  VisibilityState,
} from './LoginModal.types'
import styles from './LoginModal.module.css'

type FormFieldsProps<FormState extends FormValues> = {
  prefix: string
  fields: FieldConfig<FormState>[]
  values: FormState
  errors?: FieldErrors<FormState>
  visibility?: VisibilityState<FormState>
  onFieldChange: (key: keyof FormState, value: string) => void
  onToggleVisibility?: (key: keyof FormState) => void
}

type PanelFormProps = {
  onSubmit: SubmitHandler
  children: ReactNode
}

type InlineLinkButtonProps = {
  onClick: () => void
  children: ReactNode
}

export function PanelForm({ onSubmit, children }: PanelFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <form className={styles.formPanel} onSubmit={handleSubmit} noValidate>
      {children}
    </form>
  )
}

export function FeedbackText({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null

  return <p className={feedback.tone === 'error' ? styles.errorText : styles.successText}>{feedback.message}</p>
}

export function InlineLinkButton({ onClick, children }: InlineLinkButtonProps) {
  return (
    <button type="button" className={styles.linkButton} onClick={onClick}>
      {children}
    </button>
  )
}

export function DemoAccountsCard() {
  return (
    <div className={styles.demoAccounts}>
      <p className={styles.demoTitle}>Demo accounts</p>
      <ul className={styles.demoList}>
        {DEMO_SIGNIN_ACCOUNTS.map((account) => (
          <li key={account} className={styles.demoItem}>
            {account}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FormFields<FormState extends FormValues>({
  prefix,
  fields,
  values,
  errors = {},
  visibility = {},
  onFieldChange,
  onToggleVisibility,
}: FormFieldsProps<FormState>) {
  return (
    <>
      {fields.map(([label, key, type, placeholder]) => {
        const stringKey = String(key)
        const isPassword = type === 'password'
        const isVisible = Boolean(visibility[key])
        const error = errors[key]
        const validationProps = getEnglishInputValidationProps(label)

        return (
          <div key={stringKey} className={styles.formGroup}>
            <label htmlFor={`${prefix}-${stringKey}`} className={styles.label}>
              {label}
            </label>
            <div className={styles.inputWrapper}>
              <input
                id={`${prefix}-${stringKey}`}
                type={isPassword && isVisible ? 'text' : type}
                placeholder={placeholder}
                value={values[key]}
                onChange={(event) => onFieldChange(key, event.target.value)}
                className={`${styles.formInput} ${isPassword ? styles.passwordInput : ''} ${error ? styles.inputError : ''}`.trim()}
                {...validationProps}
              />
              {isPassword ? (
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => onToggleVisibility?.(key)}
                  aria-label={isVisible ? 'Hide password' : 'Show password'}
                >
                  <span className={styles.passwordEmoji} aria-hidden="true">
                    {getPasswordEmoji(isVisible)}
                  </span>
                </button>
              ) : null}
            </div>
            {error ? <p className={styles.errorText}>{error}</p> : null}
          </div>
        )
      })}
    </>
  )
}

