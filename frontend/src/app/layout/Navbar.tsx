import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const openLogin = (tab: 'signin' | 'register') => {
    setLoginModal({ open: true, tab })
    setMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    setMobileOpen(false)
    navigate('/')
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [location.pathname])

  const isAdmin = isAuthenticated && user?.role === 'admin'
  const isSupermarket = isAuthenticated && user?.role === 'supermarket'
  const isLoggedIn = isAuthenticated && !!user
  const isHomePage = location.pathname === '/'
  const isFindFoodBankPage = location.pathname === '/find-foodbank'

  const roleBadgeLabel =
    user?.role === 'admin' ? 'Admin' : user?.role === 'supermarket' ? 'Supermarket' : 'Account'

  if (isSupermarket) {
    return (
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid #F3F4F6',
          padding: '0 2rem',
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          to="/"
          style={{
            fontWeight: 900,
            fontSize: '1.25rem',
            color: '#1A1A1A',
            textDecoration: 'none',
          }}
        >
          ABC Foodbank
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: '#F7DC6F',
              color: '#1A1A1A',
              padding: '0.375rem 1rem',
              borderRadius: 9999,
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            Supermarket
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: '#fff',
              border: '1.5px solid #E5E7EB',
              color: '#1A1A1A',
              padding: '0.375rem 1rem',
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>
    )
  }

  if (isHomePage || isFindFoodBankPage) {
    return null
  }

  return (
    <>
      <nav className="sticky top-0 z-50 flex h-[72px] items-center justify-between border-b-[1.5px] border-[#E8E8E8] bg-white px-4 md:px-8">
        <Link
          to="/"
          className="whitespace-nowrap text-xl font-bold tracking-wide text-[#1A1A1A] no-underline"
          style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800 }}
        >
          ABC Foodbank
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            to="/donate/cash"
            className="text-sm font-medium text-gray-500 no-underline transition-colors hover:text-[#1A1A1A]"
          >
            Donate Cash
          </Link>
          <Link
            to="/donate/goods"
            className="text-sm font-medium text-gray-500 no-underline transition-colors hover:text-[#1A1A1A]"
          >
            Donate Goods
          </Link>
          <Link
            to="/find-foodbank"
            className="text-sm font-medium text-gray-500 no-underline transition-colors hover:text-[#1A1A1A]"
          >
            Get Supports
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-gray-500 no-underline transition-colors hover:text-[#1A1A1A]"
          >
            Volunteering
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && (
            <span className="hidden rounded-full bg-[#F7DC6F] px-4 py-1.5 text-sm font-semibold text-[#1A1A1A] md:inline-block">
              {roleBadgeLabel}
            </span>
          )}

          {isAdmin && (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((open) => !open)}
                className="rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-1.5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-gray-50"
                type="button"
              >
                Dashboard
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 flex w-48 flex-col rounded-xl border-[1.5px] border-[#E8E8E8] bg-white py-2 shadow-lg">
                  <button
                    onClick={() => {
                      navigate('/admin')
                      setDropdownOpen(false)
                    }}
                    className="bg-[#F7DC6F] px-6 py-2 text-left text-sm font-semibold hover:bg-[#F7DC6F]/80"
                    type="button"
                  >
                    Statistics
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin?section=food')
                      setDropdownOpen(false)
                    }}
                    className="px-6 py-2 text-left text-sm font-medium hover:bg-[#F7DC6F]/20"
                    type="button"
                  >
                    Food Management
                  </button>
                </div>
              )}
            </div>
          )}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="hidden rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-1.5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-gray-50 md:inline-flex"
              type="button"
            >
              Sign Out
            </button>
          ) : (
            <>
              <button
                onClick={() => openLogin('signin')}
                className="hidden rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-1.5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-gray-50 md:inline-flex"
                type="button"
              >
                Sign In
              </button>
              <button
                onClick={() => openLogin('register')}
                className="hidden rounded-full border-[1.5px] border-[#F7DC6F] bg-[#F7DC6F] px-4 py-1.5 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F0C419] md:inline-flex"
                type="button"
              >
                Register
              </button>
            </>
          )}

          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="p-2 text-[#1A1A1A] md:hidden"
            aria-label="Menu"
            type="button"
          >
            {mobileOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 top-[72px] z-40 flex flex-col gap-3 overflow-y-auto border-b border-[#E8E8E8] bg-white p-4 shadow-lg md:hidden">
          <Link
            to="/donate/cash"
            className="rounded-lg p-2 text-sm font-medium text-[#1A1A1A] no-underline hover:bg-[#F7DC6F]/10"
          >
            Donate Cash
          </Link>
          <Link
            to="/donate/goods"
            className="rounded-lg p-2 text-sm font-medium text-[#1A1A1A] no-underline hover:bg-[#F7DC6F]/10"
          >
            Donate Goods
          </Link>
          <Link
            to="/find-foodbank"
            className="rounded-lg p-2 text-sm font-medium text-[#1A1A1A] no-underline hover:bg-[#F7DC6F]/10"
          >
            Get Supports
          </Link>
          <Link
            to="/"
            className="rounded-lg p-2 text-sm font-medium text-[#1A1A1A] no-underline hover:bg-[#F7DC6F]/10"
          >
            Volunteering
          </Link>
          <div className="my-1 h-px bg-[#E8E8E8]" />

          {isLoggedIn && (
            <span className="rounded-full bg-[#F7DC6F] px-4 py-1.5 text-center text-sm font-semibold text-[#1A1A1A]">
              {roleBadgeLabel}
            </span>
          )}

          {isAdmin && (
            <>
              <button
                onClick={() => {
                  navigate('/admin')
                  setMobileOpen(false)
                }}
                className="rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-center"
                type="button"
              >
                Statistics
              </button>
              <button
                onClick={() => {
                  navigate('/admin?section=food')
                  setMobileOpen(false)
                }}
                className="rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-center"
                type="button"
              >
                Food Management
              </button>
            </>
          )}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-center"
              type="button"
            >
              Sign Out
            </button>
          ) : (
            <>
              <button
                onClick={() => openLogin('signin')}
                className="rounded-full border-[1.5px] border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-center"
                type="button"
              >
                Sign In
              </button>
              <button
                onClick={() => openLogin('register')}
                className="rounded-full border-[1.5px] border-[#F7DC6F] bg-[#F7DC6F] px-4 py-2 text-sm font-semibold text-center"
                type="button"
              >
                Register
              </button>
            </>
          )}
        </div>
      )}

      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
