import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { isStrongPassword, isValidEmail } from '@/shared/lib/validation'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'signin' | 'register'
}

const inputStyle = {
  height: 44,
  padding: '0 0.875rem',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.875rem',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  width: '100%',
  background: '#fff',
  color: '#1A1A1A',
  transition: 'border-color 0.2s',
} as const

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
}

const errorStyle = { fontSize: '0.75rem', color: '#E63946', marginTop: 4 }

export default function LoginModal({ isOpen, onClose, initialTab = 'signin' }: LoginModalProps) {
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

  if (!isOpen) return null

  const handleSignIn = async () => {
    setSignInError('')
    if (!signInForm.email || !signInForm.password) { setSignInError('Please fill in all fields.'); return }
    setSignInLoading(true)
    const result = await login(signInForm.email, signInForm.password)
    setSignInLoading(false)
    if (result.success) {
      onClose()
      const { user } = useAuthStore.getState()
      if (user?.role === 'admin')       navigate('/admin')
      else if (user?.role === 'supermarket') navigate('/supermarket')
    } else {
      setSignInError(result.message ?? 'Login failed.')
    }
  }

  const handleRegister = async () => {
    const errors: Record<string, string> = {}
    const passwordIsStrong = isStrongPassword(regForm.password)

    if (!regForm.name.trim())         errors.name     = 'Name is required.'
    if (!isValidEmail(regForm.email)) errors.email    = 'Please enter a valid email.'
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
    if (result.success) { onClose() }
    else { setRegErrors({ email: result.message ?? 'Registration failed.' }) }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md relative overflow-y-auto"
        style={{ borderRadius: 24, maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.75rem 1.75rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#1A1A1A' }}>
            {tab === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: '#F3F4F6', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#6b7280' }}
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #E5E7EB', margin: '1.25rem 1.75rem 0', paddingBottom: 0 }}>
          {(['signin', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2.5px solid #F7DC6F' : '2.5px solid transparent',
                marginBottom: -1.5,
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: tab === t ? '#1A1A1A' : '#9CA3AF',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem 1.75rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'signin' ? (
            <>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={signInForm.email}
                  onChange={(e) => setSignInForm((f) => ({ ...f, email: e.target.value }))}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#F7DC6F' }}
                  onBlur={(e)  => { e.target.style.borderColor = '#E5E7EB' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={signInForm.password}
                    onChange={(e) => setSignInForm((f) => ({ ...f, password: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    style={{ ...inputStyle, paddingRight: '2.75rem' }}
                    onFocus={(e) => { e.target.style.borderColor = '#F7DC6F' }}
                    onBlur={(e)  => { e.target.style.borderColor = '#E5E7EB' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((v) => !v)}
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: '#6b7280',
                      cursor: 'pointer',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {showSignInPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c5.5 0 9.4 3.4 10.8 6-0.6 1.2-1.8 2.8-3.5 4.1M6.1 6.6C4.2 7.8 2.8 9.7 2 12c1.4 2.6 5.3 6 10 6 1.4 0 2.8-0.3 4.1-0.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {signInError && <p style={errorStyle}>{signInError}</p>}
              <button
                onClick={handleSignIn}
                disabled={signInLoading}
                style={{ background: '#F7DC6F', border: 'none', borderRadius: 8, padding: '0.75rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#1A1A1A', cursor: 'pointer', transition: 'background 0.2s', opacity: signInLoading ? 0.6 : 1 }}
              >
                {signInLoading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* Demo accounts */}
              <div style={{ background: '#FEF9C3', border: '1px solid #F7DC6F', borderRadius: 10, padding: '0.75rem 1rem' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>Demo accounts:</p>
                <p style={{ fontFamily: 'DM Sans, monospace', fontSize: '0.75rem', color: '#78350F', marginBottom: 3 }}>admin@foodbank.com / admin123</p>
                <p style={{ fontFamily: 'DM Sans, monospace', fontSize: '0.75rem', color: '#78350F', marginBottom: 3 }}>supermarket@foodbank.com / supermarket123</p>
                <p style={{ fontFamily: 'DM Sans, monospace', fontSize: '0.75rem', color: '#78350F' }}>user@example.com / user12345</p>
              </div>
            </>
          ) : (
            <>
              {[
                { label: 'Full Name',         key: 'name',     type: 'text',     placeholder: 'Your name' },
                { label: 'Email Address',      key: 'email',    type: 'email',    placeholder: 'you@example.com' },
                { label: 'Password',           key: 'password', type: 'password', placeholder: 'At least 8 chars with letters, numbers, and symbols' },
                { label: 'Confirm Password',   key: 'confirm',  type: 'password', placeholder: 'Repeat password' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={
                        key === 'password'
                          ? (showRegisterPassword ? 'text' : 'password')
                          : key === 'confirm'
                            ? (showRegisterConfirm ? 'text' : 'password')
                            : type
                      }
                      placeholder={placeholder}
                      value={regForm[key as keyof typeof regForm]}
                      onChange={(e) => {
                        const value = e.target.value
                        setRegForm((f) => ({ ...f, [key]: value }))
                        setRegErrors((prev) => {
                          const next = { ...prev }
                          delete next[key]
                          if (key === 'password' || key === 'confirm') {
                            delete next.confirm
                          }
                          return next
                        })
                      }}
                      style={{
                        ...inputStyle,
                        borderColor: regErrors[key] ? '#E63946' : '#E5E7EB',
                        paddingRight: key === 'password' || key === 'confirm' ? '2.75rem' : inputStyle.padding,
                      }}
                      onFocus={(e) => { if (!regErrors[key]) e.target.style.borderColor = '#F7DC6F' }}
                      onBlur={(e)  => { if (!regErrors[key]) e.target.style.borderColor = '#E5E7EB' }}
                    />
                    {(key === 'password' || key === 'confirm') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (key === 'password') setShowRegisterPassword((v) => !v)
                          if (key === 'confirm') setShowRegisterConfirm((v) => !v)
                        }}
                        aria-label={
                          key === 'password'
                            ? (showRegisterPassword ? 'Hide password' : 'Show password')
                            : (showRegisterConfirm ? 'Hide password' : 'Show password')
                        }
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: '#6b7280',
                          cursor: 'pointer',
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                        }}
                      >
                        {((key === 'password' && showRegisterPassword) || (key === 'confirm' && showRegisterConfirm)) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c5.5 0 9.4 3.4 10.8 6-0.6 1.2-1.8 2.8-3.5 4.1M6.1 6.6C4.2 7.8 2.8 9.7 2 12c1.4 2.6 5.3 6 10 6 1.4 0 2.8-0.3 4.1-0.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {regErrors[key] && <p style={errorStyle}>{regErrors[key]}</p>}
                </div>
              ))}
              <button
                onClick={handleRegister}
                disabled={regLoading}
                style={{ background: '#F7DC6F', border: 'none', borderRadius: 8, padding: '0.75rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#1A1A1A', cursor: 'pointer', transition: 'background 0.2s', opacity: regLoading ? 0.6 : 1 }}
              >
                {regLoading ? 'Creating account…' : 'Create Account'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
