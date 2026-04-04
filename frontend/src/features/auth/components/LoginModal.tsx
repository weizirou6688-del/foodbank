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

export default function LoginModal({ isOpen, onClose, initialTab = 'signin', redirectTo = null, requiredRole = null }: LoginModalProps) {
  const [tab, setTab] = useState<'signin' | 'register'>(initialTab)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  const [signInForm, setSignInForm] = useState({ email: '', password: '' })
  const [signInError, setSignInError] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)

  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [regErrors, setRegErrors] = useState<Record<string, string>>({})
  const [regLoading, setRegLoading] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab)
    }
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
            {tab === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
        </div>

        <div className={styles.tabs}>
          {(['signin', 'register'] as const).map((tabName) => (
            <button
              key={tabName}
              type="button"
              className={`${styles.tabItem} ${tab === tabName ? styles.tabItemActive : ''}`.trim()}
              onClick={() => setTab(tabName)}
            >
              {tabName === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {tab === 'signin' ? (
          <form className={styles.formPanel} onSubmit={(event) => event.preventDefault()}>
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSignIn()
                  }}
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
            </div>

            <button type="button" className={styles.submitButton} onClick={handleSignIn} disabled={signInLoading}>
              {signInLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className={styles.demoAccounts}>
              <h4 className={styles.demoTitle}>Demo accounts:</h4>
              <ul className={styles.demoList}>
                <li className={styles.demoItem}>admin@foodbank.com / admin123</li>
                <li className={styles.demoItem}>supermarket@foodbank.com / supermarket123</li>
                <li className={styles.demoItem}>user@example.com / user12345</li>
              </ul>
            </div>
          </form>
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

