import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'

export function Header() {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/home')
  }

  return (
    <header className="relative border-b bg-white" style={{ borderColor: '#E5E7EB' }}>
      <nav className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link
              to="/home"
              className="text-[28px] font-bold no-underline"
              style={{ color: '#1A1A1A' }}
            >
              ABC Foodbank
            </Link>
          </div>

          <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
            <span className="text-[15px] font-medium" style={{ color: '#1A1A1A' }}>
              Supermarket Restock
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div
              className="rounded-md px-4 py-2 text-[15px]"
              style={{ backgroundColor: '#F2F4F3', color: '#1A1A1A' }}
            >
              Supermarket
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[15px]"
              style={{ color: '#1A1A1A' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
