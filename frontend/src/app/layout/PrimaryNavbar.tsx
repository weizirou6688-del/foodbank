import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import styles from './PrimaryNavbar.module.css'

type NavbarVariant = 'public' | 'supermarket'

interface PrimaryNavbarProps {
  variant?: NavbarVariant
}

interface NavItem {
  key: string
  label: string
  path: string
}

const publicNavItems: NavItem[] = [
  { key: 'about', label: 'About Us', path: '/home' },
  { key: 'support', label: 'Get Support', path: '/find-foodbank' },
  { key: 'cash', label: 'Donate Cash', path: '/donate/cash' },
  { key: 'goods', label: 'Donate Goods', path: '/donate/goods' },
]

const supermarketNavItems: NavItem[] = [
  { key: 'restock', label: 'Supermarket Restock', path: '/supermarket' },
]

function HamburgerIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function getActiveKey(pathname: string, variant: NavbarVariant) {
  if (variant === 'supermarket') {
    return pathname === '/supermarket' ? 'restock' : ''
  }

  if (pathname === '/home') {
    return 'about'
  }

  if (
    pathname === '/find-foodbank' ||
    pathname === '/food-packages' ||
    pathname === '/application'
  ) {
    return 'support'
  }

  if (pathname === '/donate/cash') {
    return 'cash'
  }

  if (pathname === '/donate/goods') {
    return 'goods'
  }

  return ''
}

export default function PrimaryNavbar({ variant = 'public' }: PrimaryNavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuthStore()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navItems = variant === 'supermarket' ? supermarketNavItems : publicNavItems
  const activeKey = getActiveKey(location.pathname, variant)
  const roleLabel = variant === 'supermarket' ? 'Supermarket' : 'Public'
  const authLabel = isAuthenticated ? 'Sign Out' : 'Sign In'

  const navigateTo = (path: string) => {
    setMobileOpen(false)
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate(path)
  }

  const handleAuthClick = () => {
    setMobileOpen(false)
    if (isAuthenticated) {
      logout()
      navigate('/home')
      return
    }

    setLoginModal({ open: true, tab: 'signin' })
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <span className={styles.brand}>ABC Foodbank</span>

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

          <div className={styles.actions}>
            <span className={styles.roleBadge}>{roleLabel}</span>
            <button type="button" onClick={handleAuthClick} className={styles.authButton}>
              {authLabel}
            </button>
          </div>

          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setMobileOpen((current) => !current)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        {mobileOpen ? (
          <div className={styles.mobilePanel}>
            <div className={styles.mobileInner}>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className={`${styles.mobileNavButton} ${
                    activeKey === item.key ? styles.mobileNavButtonActive : ''
                  }`.trim()}
                >
                  {item.label}
                </button>
              ))}

              <div className={styles.mobileActions}>
                <span className={styles.roleBadge}>{roleLabel}</span>
                <button type="button" onClick={handleAuthClick} className={styles.authButton}>
                  {authLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
