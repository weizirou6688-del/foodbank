import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loginModal,   setLoginModal]   = useState<{ open: boolean; tab: 'signin' | 'register' }>({ open: false, tab: 'signin' })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const openLogin = (tab: 'signin' | 'register') => { setLoginModal({ open: true, tab }); setMobileOpen(false) }
  const handleLogout = () => { logout(); navigate('/') }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isAdmin = isAuthenticated && user?.role === 'admin'
  const isSuper = isAuthenticated && user?.role === 'supermarket'
  const isLoggedIn = isAuthenticated && !!user

  const roleBadgeLabel = user?.role === 'admin' ? 'Admin'
    : user?.role === 'supermarket' ? 'Supermarket'
    : 'Public'

  /* ── Supermarket: minimal navbar ─────────────────────────── */
  if (isSuper) {
    return (
      <header style={{
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
      }}>
        <Link to="/" style={{ fontWeight: 900, fontSize: '1.25rem', color: '#1A1A1A', textDecoration: 'none' }}>
          ABC Foodbank
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ background: '#F7DC6F', color: '#1A1A1A', padding: '0.375rem 1rem', borderRadius: 9999, fontWeight: 800, fontSize: '0.8rem' }}>
            Supermarket
          </span>
          <button
            onClick={handleLogout}
            style={{ background: '#fff', border: '1.5px solid #E5E7EB', color: '#1A1A1A', padding: '0.375rem 1rem', borderRadius: 9999, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Sign Out
          </button>
        </div>
      </header>
    )
  }

  /* ── Standard navbar (public + admin) ───────────────────── */
  return (
    <>
      <nav className="sticky top-0 z-50 flex h-[72px] items-center justify-between border-b-[1.5px] border-[#E8E8E8] bg-white px-4 md:px-8">

        {/* Logo */}
        <Link to="/" className="font-bold text-xl tracking-wide whitespace-nowrap text-[#1A1A1A] no-underline" style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800 }}>
          ABC Foodbank
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/donate/cash"   className="font-medium text-gray-500 hover:text-[#1A1A1A] transition-colors no-underline text-sm">Donate Cash</Link>
          <Link to="/donate/goods"  className="font-medium text-gray-500 hover:text-[#1A1A1A] transition-colors no-underline text-sm">Donate Goods</Link>
          <Link to="/find-foodbank" className="font-medium text-gray-500 hover:text-[#1A1A1A] transition-colors no-underline text-sm">Find Food Bank</Link>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">

          {/* Role badge when logged in */}
          {isLoggedIn && (
            <span className="bg-[#F7DC6F] text-[#1A1A1A] px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap hidden md:inline-block">
              {roleBadgeLabel}
            </span>
          )}

          {/* Admin dashboard dropdown */}
          {isAdmin && (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors text-[#1A1A1A]"
              >
                Dashboard
              </button>
              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-lg py-2 z-50 flex flex-col">
                  <button onClick={() => { navigate('/admin');              setDropdownOpen(false) }} className="px-6 py-2 text-left text-sm font-medium hover:bg-[#F7DC6F]/20 bg-[#F7DC6F] font-semibold">Statistics</button>
                  <button onClick={() => { navigate('/admin?section=food'); setDropdownOpen(false) }} className="px-6 py-2 text-left text-sm font-medium hover:bg-[#F7DC6F]/20">Food Management</button>
                </div>
              )}
            </div>
          )}

          {/* Sign Out (logged in) */}
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors text-[#1A1A1A]"
            >
              Sign Out
            </button>
          )}

          {/* Sign In / Register (not logged in) — matches screenshot */}
          {!isLoggedIn && (
            <>
              <button
                onClick={() => openLogin('signin')}
                className="hidden md:inline-flex bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors text-[#1A1A1A]"
              >
                Sign In
              </button>
              <button
                onClick={() => openLogin('register')}
                className="hidden md:inline-flex bg-[#F7DC6F] border-[1.5px] border-[#F7DC6F] rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-[#F0C419] transition-colors text-[#1A1A1A]"
              >
                Register
              </button>
            </>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2 text-[#1A1A1A] md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[72px] bg-white z-40 flex flex-col p-4 gap-3 border-b border-[#E8E8E8] shadow-lg overflow-y-auto">
          <Link to="/donate/cash"   className="font-medium text-[#1A1A1A] p-2 hover:bg-[#F7DC6F]/10 rounded-lg no-underline text-sm" onClick={() => setMobileOpen(false)}>Donate Cash</Link>
          <Link to="/donate/goods"  className="font-medium text-[#1A1A1A] p-2 hover:bg-[#F7DC6F]/10 rounded-lg no-underline text-sm" onClick={() => setMobileOpen(false)}>Donate Goods</Link>
          <Link to="/find-foodbank" className="font-medium text-[#1A1A1A] p-2 hover:bg-[#F7DC6F]/10 rounded-lg no-underline text-sm" onClick={() => setMobileOpen(false)}>Find Food Bank</Link>
          <div className="h-px bg-[#E8E8E8] my-1" />
          {isLoggedIn && (
            <span className="bg-[#F7DC6F] text-[#1A1A1A] px-4 py-1.5 rounded-full text-sm font-semibold text-center">{roleBadgeLabel}</span>
          )}
          {isAdmin && (
            <>
              <button onClick={() => { navigate('/admin');              setMobileOpen(false) }} className="bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-2 text-sm font-medium text-center">Statistics</button>
              <button onClick={() => { navigate('/admin?section=food'); setMobileOpen(false) }} className="bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-2 text-sm font-medium text-center">Food Management</button>
            </>
          )}
          {isLoggedIn
            ? <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-2 text-sm font-medium text-center">Sign Out</button>
            : <>
                <button onClick={() => openLogin('signin')}   className="bg-white border-[1.5px] border-[#E8E8E8] rounded-full px-4 py-2 text-sm font-medium text-center">Sign In</button>
                <button onClick={() => openLogin('register')} className="bg-[#F7DC6F] border-[1.5px] border-[#F7DC6F] rounded-full px-4 py-2 text-sm font-semibold text-center">Register</button>
              </>
          }
        </div>
      )}

      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((s) => ({ ...s, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
