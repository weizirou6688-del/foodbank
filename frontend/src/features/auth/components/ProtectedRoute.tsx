import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { hasAllowedRole, type AllowedRole } from '../auth.helpers'
import LoginModal from './LoginModal'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRole?: AllowedRole
  showFooterWhenBlocked?: boolean
}

const gateStyle: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  padding: '2rem 1.5rem',
  textAlign: 'center',
}

const gateButtonStyle: CSSProperties = {
  border: '1px solid #121212',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#121212',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 600,
  lineHeight: 1.2,
  padding: '0.85rem 1rem',
  transition: 'all 0.3s ease',
}

export default function ProtectedRoute({
  children,
  allowedRole,
  showFooterWhenBlocked = false,
}: ProtectedRouteProps) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoginOpen(true)
    }
  }, [isAuthenticated, location.pathname, location.search])

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`

    return (
      <>
        <div style={gateStyle}>
          <p style={{ color: '#6b7280', margin: 0 }}>Please sign in to access this page.</p>
          <button type="button" style={gateButtonStyle} onClick={() => setIsLoginOpen(true)}>
            Sign In
          </button>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          initialTab="signin"
          redirectTo={redirectTo}
          requiredRole={allowedRole}
        />
      </>
    )
  }

  if (!hasAllowedRole(user, allowedRole)) {
    return (
      <>
        <div style={gateStyle}>
          <p style={{ color: '#6b7280', margin: 0 }}>You do not have permission to access this page.</p>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
      </>
    )
  }

  return <>{children}</>
}
