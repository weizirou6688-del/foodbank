import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import { scrollToTop } from '@/shared/lib/scroll'
import { styles } from './primaryNavbarStyles'

export type NavbarVariant = 'public' | 'supermarket'

interface PrimaryNavbarProps {
  variant?: NavbarVariant
  centerText?: string
}

interface NavItem {
  key: string
  label: string
  path: string
}

const publicNavItems: NavItem[] = [
  { key: 'home', label: 'Home', path: '/home' },
  { key: 'support', label: 'Get Support', path: '/find-foodbank' },
  { key: 'cash', label: 'Donate Cash', path: '/donate/cash' },
  { key: 'goods', label: 'Donate Goods', path: '/donate/goods' },
]

const supermarketNavItems: NavItem[] = [
  { key: 'restock', label: 'Supermarket Restock', path: '/workspace?section=restock' },
]

function getActiveKey(pathname: string, search: string, variant: NavbarVariant) {
  if (variant === 'supermarket') {
    const section = new URLSearchParams(search).get('section')
    return pathname === '/supermarket' || (pathname === '/workspace' && section === 'restock') ? 'restock' : ''
  }

  if (pathname === '/home') {
    return 'home'
  }

  if (
    pathname === '/find-foodbank'
    || pathname === '/food-packages'
    || pathname === '/get-support'
  ) {
    return 'support'
  }

  if (pathname === '/donate/cash' || pathname === '/donate-cash') {
    return 'cash'
  }

  if (pathname === '/donate/goods' || pathname === '/donate-goods') {
    return 'goods'
  }

  return ''
}

export default function PrimaryNavbar({ variant = 'public', centerText }: PrimaryNavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, signOut } = useAuthStore()
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  const navItems = variant === 'supermarket' ? supermarketNavItems : publicNavItems
  const activeKey = getActiveKey(location.pathname, location.search, variant)
  const roleLabel = variant === 'supermarket' ? 'Supermarket' : 'Public'
  const authLabel = isAuthenticated ? 'Sign Out' : 'Sign In'
  const currentPath = `${location.pathname}${location.search}`

  const navigateTo = (path: string) => {
    if (currentPath === path) {
      scrollToTop()
      return
    }

    navigate(path)
  }

  const handleAuthClick = () => {
    if (isAuthenticated) {
      void signOut()
      navigate('/home')
      return
    }

    setLoginModal({ open: true, tab: 'signin' })
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <button type="button" className={styles.brandButton} onClick={() => navigateTo('/home')}>
            <span className={styles.brand}>ABC Foodbank</span>
          </button>
          {centerText ? (
            <span className={styles.centerText}>{centerText}</span>
          ) : (
            <nav className={styles.nav} aria-label={`${variant} navigation`}>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className={`${styles.navButton} ${
                    activeKey === item.key ? styles.navButtonActive : ''
                  }`.trim()}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
          <div className={styles.actions}>
            <span className={styles.roleBadge}>{roleLabel}</span>
            <button type="button" onClick={handleAuthClick} className={styles.authButton}>
              {authLabel}
            </button>
          </div>
        </div>
      </header>
      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
