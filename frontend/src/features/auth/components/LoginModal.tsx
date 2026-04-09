import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { isStrongPassword, isValidEmail } from '@/shared/lib/validation'
import styles from './LoginModal.module.css'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'signin' | 'register'
  redirectTo?: string | null
  requiredRole?: 'admin' | 'supermarket' | null
}

const getPasswordEmoji = (visible: boolean) => (visible ? '\u{1F441}\uFE0F' : '\u{1F648}')
type SignInView = 'signin' | 'forgot' | 'reset'
type Feedback = { tone: 'success' | 'error'; message: string }

export default function LoginModal({
  isOpen,
  onClose,
  initialTab = 'signin',
  redirectTo = null,
  requiredRole = null,
}: LoginModalProps) {
  const [tab, setTab] = useState<'signin' | 'register'>(initialTab)
  const { forgotPassword, login, register, resetPassword } = useAuthStore()
  const navigate = useNavigate()

  const [signInView, setSignInView] = useState<SignInView>('signin')
  const [signInForm, setSignInForm] = useState({ email: '', password: '' })
  const [signInError, setSignInError] = useState('')
  const [signInNotice, setSignInNotice] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState<Feedback | null>(null)

  const [resetForm, setResetForm] = useState({
    email: '',
    verificationCode: '',
    newPassword: '',
    confirm: '',
  })
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({})
  const [resetLoading, setResetLoading] = useState(false)
  const [resetFeedback, setResetFeedback] = useState<Feedback | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [regErrors, setRegErrors] = useState<Record<string, string>>({})
  const [regLoading, setRegLoading] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false)

  const resetAuthViews = (nextTab: 'signin' | 'register') => {
    setTab(nextTab)
    setSignInView('signin')
    setSignInError('')
    setSignInNotice('')
    setForgotEmail('')
    setForgotFeedback(null)
    setResetForm({ email: '', verificationCode: '', newPassword: '', confirm: '' })
    setResetErrors({})
    setResetFeedback(null)
    setShowSignInPassword(false)
    setShowResetPassword(false)
    setShowResetConfirm(false)
  }

  useEffect(() => {
    if (!isOpen) return

    setTab(initialTab)
    setSignInView('signin')
    setSignInError('')
    setSignInNotice('')
    setForgotEmail('')
    setForgotFeedback(null)
    setResetForm({ email: '', verificationCode: '', newPassword: '', confirm: '' })
    setResetErrors({})
    setResetFeedback(null)
    setShowSignInPassword(false)
    setShowResetPassword(false)
    setShowResetConfirm(false)
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSignIn = async () => {
    setSignInError('')
    setSignInNotice('')
    if (!signInForm.email || !signInForm.password) {
      setSignInError('Please fill in all fields.')
      return
    }

    setSignInLoading(true)
    const result = await login(signInForm.email, signInForm.password)
    setSignInLoading(false)

    if (result.success) {
      onClose()
      const { user } = useAuthStore.getState()

      if (redirectTo && (!requiredRole || user?.role === requiredRole)) {
        if (redirectTo.startsWith('/admin')) {
          navigate(redirectTo, { replace: true })
        } else {
          navigate(redirectTo)
        }
        return
      }

      if (user?.role === 'admin') navigate('/admin?section=food', { replace: true })
      else if (user?.role === 'supermarket') navigate('/supermarket')
    } else {
      setSignInError(result.message ?? 'Login failed.')
    }
  }

  const openForgotPassword = () => {
    setSignInView('forgot')
    setSignInError('')
    setSignInNotice('')
    setForgotFeedback(null)
    setResetFeedback(null)
    setForgotEmail((current) => current || signInForm.email)
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

    setSignInForm((form) => ({ ...form, email: forgotEmail }))
    setResetForm((form) => ({
      ...form,
      email: forgotEmail,
      verificationCode: '',
      newPassword: '',
      confirm: '',
    }))
    setResetErrors({})
    setSignInView('reset')
    setResetFeedback({
      tone: 'success',
      message:
        result.message ??
        'If this email exists, a verification code has been sent. Enter it below with your new password.',
    })
  }

  const handleResetPassword = async () => {
    const errors: Record<string, string> = {}
    const passwordIsStrong = isStrongPassword(resetForm.newPassword)

    if (!isValidEmail(resetForm.email)) {
      errors.email = 'Please enter a valid email.'
    }
    if (!resetForm.verificationCode.trim()) {
      errors.verificationCode = 'Verification code is required.'
    } else if (!/^\d{6}$/.test(resetForm.verificationCode.trim())) {
      errors.verificationCode = 'Verification code must contain exactly 6 digits.'
    }
    if (!passwordIsStrong) {
      errors.newPassword = 'Password must include letters, numbers, and special characters (no spaces).'
    }
    if (!resetForm.confirm) {
      errors.confirm = 'Please confirm password.'
    } else if (passwordIsStrong && resetForm.newPassword !== resetForm.confirm) {
      errors.confirm = 'Passwords do not match.'
    }

    setResetErrors(errors)
    setResetFeedback(null)
    if (Object.keys(errors).length > 0) return

    setResetLoading(true)
    const result = await resetPassword(
      resetForm.email.trim(),
      resetForm.verificationCode.trim(),
      resetForm.newPassword,
    )
    setResetLoading(false)

    if (!result.success) {
      setResetFeedback({ tone: 'error', message: result.message ?? 'Password reset failed.' })
      return
    }

    setResetForm({ email: '', verificationCode: '', newPassword: '', confirm: '' })
    setResetErrors({})
    setResetFeedback(null)
    setSignInView('signin')
    setSignInNotice(result.message ?? 'Password reset successful. Please sign in with your new password.')
    setSignInForm((form) => ({ ...form, email: resetForm.email.trim(), password: '' }))
  }

  const handleRegister = async () => {
    const errors: Record<string, string> = {}
    const passwordIsStrong = isStrongPassword(regForm.password)

    if (!regForm.name.trim()) errors.name = 'Name is required.'
    if (!isValidEmail(regForm.email)) errors.email = 'Please enter a valid email.'
    if (!passwordIsStrong) {
      errors.password = 'Password must include letters, numbers, and special characters (no spaces).'
    }
    if (!regForm.confirm) {
      errors.confirm = 'Please confirm password.'
    } else if (passwordIsStrong && regForm.password !== regForm.confirm) {
      errors.confirm = 'Passwords do not match.'
    }

    setRegErrors(errors)
    if (Object.keys(errors).length > 0) return

    setRegLoading(true)
    const result = await register(regForm.name, regForm.email, regForm.password)
    setRegLoading(false)

    if (result.success) {
      onClose()
    } else {
      setRegErrors({ email: result.message ?? 'Registration failed.' })
    }
  }

  const registerFields: Array<{
    label: string
    key: keyof typeof regForm
    type: 'text' | 'email' | 'password'
    placeholder: string
  }> = [
    { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your name' },
    { label: 'Email Address', key: 'email', type: 'email', placeholder: 'you@example.com' },
    {
      label: 'Password',
      key: 'password',
      type: 'password',
      placeholder: 'At least 8 chars with letters, numbers, and symbols',
    },
    { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: 'Repeat password' },
  ]

  const resetFields: Array<{
    label: string
    key: keyof typeof resetForm
    type: 'text' | 'email' | 'password'
    placeholder: string
  }> = [
    {
      label: 'Email Address',
      key: 'email',
      type: 'email',
      placeholder: 'you@example.com',
    },
    {
      label: 'Verification Code',
      key: 'verificationCode',
      type: 'text',
      placeholder: 'Enter the 6-digit code from your email',
    },
    {
      label: 'New Password',
      key: 'newPassword',
      type: 'password',
      placeholder: 'At least 8 chars with letters, numbers, and symbols',
    },
    { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: 'Repeat new password' },
  ]

  const modalTitle =
    tab === 'register'
      ? 'Create Account'
      : signInView === 'forgot'
        ? 'Forgot Password'
        : signInView === 'reset'
          ? 'Reset Password'
          : 'Welcome Back'

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
          {(['signin', 'register'] as const).map((tabName) => (
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

        {tab === 'signin' ? (
          signInView === 'signin' ? (
            <form
              className={styles.formPanel}
              onSubmit={(event) => {
                event.preventDefault()
                void handleSignIn()
              }}
            >
              <div className={styles.formGroup}>
                <label htmlFor="signin-email" className={styles.label}>
                  Email Address
                </label>
                <input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInForm.email}
                  onChange={(event) => setSignInForm((form) => ({ ...form, email: event.target.value }))}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="signin-password" className={styles.label}>
                  Password
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    id="signin-password"
                    type={showSignInPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={signInForm.password}
                    onChange={(event) => setSignInForm((form) => ({ ...form, password: event.target.value }))}
                    className={`${styles.formInput} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowSignInPassword((visible) => !visible)}
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className={styles.passwordEmoji} aria-hidden="true">
                      {getPasswordEmoji(showSignInPassword)}
                    </span>
                  </button>
                </div>
                {signInError && <p className={styles.errorText}>{signInError}</p>}
                {signInNotice && <p className={styles.successText}>{signInNotice}</p>}
              </div>

              <div className={styles.inlineActions}>
                <button type="button" className={styles.linkButton} onClick={openForgotPassword}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className={styles.submitButton} disabled={signInLoading}>
                {signInLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className={styles.demoAccounts}>
                <h4 className={styles.demoTitle}>Demo accounts:</h4>
                <ul className={styles.demoList}>
                  <li className={styles.demoItem}>admin@foodbank.com / admin123</li>
                  <li className={styles.demoItem}>localadmin@foodbank.com / localadmin123</li>
                  <li className={styles.demoItem}>supermarket@foodbank.com / supermarket123</li>
                  <li className={styles.demoItem}>user@example.com / user12345</li>
                </ul>
              </div>
            </form>
          ) : signInView === 'forgot' ? (
            <form
              className={styles.formPanel}
              onSubmit={(event) => {
                event.preventDefault()
                void handleForgotPassword()
              }}
            >
              <div className={styles.panelIntro}>
                <p className={styles.panelDescription}>
                  Enter your account email. If it exists, we&apos;ll send a 6-digit verification code to that inbox.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="forgot-email" className={styles.label}>
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(event) => {
                    setForgotEmail(event.target.value)
                    setForgotFeedback(null)
                  }}
                  className={styles.formInput}
                />
                {forgotFeedback?.tone === 'error' ? <p className={styles.errorText}>{forgotFeedback.message}</p> : null}
                {forgotFeedback?.tone === 'success' ? (
                  <p className={styles.successText}>{forgotFeedback.message}</p>
                ) : null}
              </div>

              <button type="submit" className={styles.submitButton} disabled={forgotLoading}>
                {forgotLoading ? 'Sending code...' : 'Send Verification Code'}
              </button>

              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setSignInView('signin')
                    setForgotFeedback(null)
                  }}
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setSignInView('reset')
                    setResetFeedback(null)
                    setResetForm((form) => ({
                      ...form,
                      email: forgotEmail || form.email || signInForm.email,
                    }))
                  }}
                >
                  I already have a code
                </button>
              </div>
            </form>
          ) : (
            <form
              className={styles.formPanel}
              onSubmit={(event) => {
                event.preventDefault()
                void handleResetPassword()
              }}
            >
              <div className={styles.panelIntro}>
                <p className={styles.panelDescription}>
                  Enter the email address that received the code, then use that 6-digit verification code to choose a new password.
                </p>
              </div>

              {resetFeedback?.tone === 'success' ? <p className={styles.successText}>{resetFeedback.message}</p> : null}
              {resetFeedback?.tone === 'error' ? <p className={styles.errorText}>{resetFeedback.message}</p> : null}

              {resetFields.map(({ label, key, type, placeholder }) => {
                const isPasswordField = key === 'newPassword' || key === 'confirm'
                const isVisible = key === 'newPassword' ? showResetPassword : showResetConfirm
                const inputType = isPasswordField ? (isVisible ? 'text' : 'password') : type
                const inputClassName = `${styles.formInput} ${resetErrors[key] ? styles.inputError : ''} ${
                  isPasswordField ? styles.passwordInput : ''
                }`.trim()

                return (
                  <div key={key} className={styles.formGroup}>
                    <label htmlFor={`reset-${key}`} className={styles.label}>
                      {label}
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id={`reset-${key}`}
                        type={inputType}
                        placeholder={placeholder}
                        value={resetForm[key]}
                        onChange={(event) => {
                          const value = event.target.value
                          setResetForm((form) => ({ ...form, [key]: value }))
                          setResetErrors((current) => {
                            const next = { ...current }
                            delete next[key]
                            if (key === 'email' || key === 'verificationCode') {
                              return next
                            }
                            if (key === 'newPassword' || key === 'confirm') {
                              delete next.confirm
                            }
                            return next
                          })
                          setResetFeedback((current) => (current?.tone === 'error' ? null : current))
                        }}
                        className={inputClassName}
                      />
                      {isPasswordField && (
                        <button
                          type="button"
                          className={styles.passwordToggle}
                          onClick={() => {
                            if (key === 'newPassword') setShowResetPassword((visible) => !visible)
                            if (key === 'confirm') setShowResetConfirm((visible) => !visible)
                          }}
                          aria-label={isVisible ? 'Hide password' : 'Show password'}
                        >
                          <span className={styles.passwordEmoji} aria-hidden="true">
                            {getPasswordEmoji(isVisible)}
                          </span>
                        </button>
                      )}
                    </div>
                    {resetErrors[key] && <p className={styles.errorText}>{resetErrors[key]}</p>}
                  </div>
                )
              })}

              <button type="submit" className={styles.submitButton} disabled={resetLoading}>
                {resetLoading ? 'Updating password...' : 'Reset Password'}
              </button>

              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setForgotEmail(resetForm.email)
                    setSignInView('forgot')
                    setResetFeedback(null)
                  }}
                >
                  Use another email
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setSignInView('signin')
                    setResetFeedback(null)
                    setResetErrors({})
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )
        ) : (
          <form className={styles.formPanel} onSubmit={(event) => event.preventDefault()}>
            {registerFields.map(({ label, key, type, placeholder }) => {
              const isPasswordField = key === 'password' || key === 'confirm'
              const isVisible = key === 'password' ? showRegisterPassword : showRegisterConfirm
              const inputType = isPasswordField ? (isVisible ? 'text' : 'password') : type
              const inputClassName = `${styles.formInput} ${regErrors[key] ? styles.inputError : ''} ${
                isPasswordField ? styles.passwordInput : ''
              }`.trim()

              return (
                <div key={key} className={styles.formGroup}>
                  <label htmlFor={`register-${key}`} className={styles.label}>
                    {label}
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      id={`register-${key}`}
                      type={inputType}
                      placeholder={placeholder}
                      value={regForm[key]}
                      onChange={(event) => {
                        const value = event.target.value
                        setRegForm((form) => ({ ...form, [key]: value }))
                        setRegErrors((current) => {
                          const next = { ...current }
                          delete next[key]
                          if (key === 'password' || key === 'confirm') {
                            delete next.confirm
                          }
                          return next
                        })
                      }}
                      className={inputClassName}
                    />
                    {isPasswordField && (
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => {
                          if (key === 'password') setShowRegisterPassword((visible) => !visible)
                          if (key === 'confirm') setShowRegisterConfirm((visible) => !visible)
                        }}
                        aria-label={isVisible ? 'Hide password' : 'Show password'}
                      >
                        <span className={styles.passwordEmoji} aria-hidden="true">
                          {getPasswordEmoji(isVisible)}
                        </span>
                      </button>
                    )}
                  </div>
                  {regErrors[key] && <p className={styles.errorText}>{regErrors[key]}</p>}
                </div>
              )
            })}

            <button type="button" className={styles.submitButton} onClick={handleRegister} disabled={regLoading}>
              {regLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
