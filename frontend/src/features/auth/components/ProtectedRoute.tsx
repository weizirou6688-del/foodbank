import { useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import LoginModal from './LoginModal'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRole?: 'admin' | 'supermarket'
  showFooterWhenBlocked?: boolean
}

export default function ProtectedRoute({
  children,
  allowedRole,
  showFooterWhenBlocked = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const [showModal, setShowModal] = useState(!isAuthenticated)

  useEffect(() => {
    setShowModal(!isAuthenticated)
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280' }}>Please sign in to access this page.</p>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
        <LoginModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    )
  }

  if (allowedRole && user?.role !== allowedRole) {
    return (
      <>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280' }}>You do not have permission to access this page.</p>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
      </>
    )
  }

  return <>{children}</>
}
