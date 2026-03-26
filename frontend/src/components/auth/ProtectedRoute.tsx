// Compatibility stub: re-export from new location (features/auth/components/ProtectedRoute)
export { default } from '@/features/auth/components/ProtectedRoute'

/*  Old implementation moved to features/auth/components/ProtectedRoute.tsx
import { useState, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import LoginModal from './LoginModal'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRole?: 'admin' | 'supermarket'
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {*/
  const { isAuthenticated, user } = useAuthStore()
  const [showModal, setShowModal] = useState(!isAuthenticated)

  if (!isAuthenticated) {
    return (
      <>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280' }}>Please sign in to access this page.</p>
        </div>
        <LoginModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    )
  }

  if (allowedRole && user?.role !== allowedRole) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>You do not have permission to access this page.</p>
      </div>
    )
  }

  return <>{children}</>
}
