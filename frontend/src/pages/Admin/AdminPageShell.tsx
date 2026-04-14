import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import { scrollToTop, useScrollTopVisibility } from '@/shared/lib/scroll'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { AdminButton, AdminLinkButton } from './chrome'
import {
  getAdminTabs,
  makeWorkspaceUrl,
  type AdminTab,
} from './workspaceTabs'
import './admin.css'

export interface HeroAction {
  label: string
  targetId?: string
  href?: string
  onClick?: () => void
}

interface AdminPageShellProps {
  section: AdminTab
  title: string
  description: string
  features?: string[]
  actions?: HeroAction[]
  featureClassName?: string
  featureItemClassName?: string
  showScrollTopButton?: boolean
  children: ReactNode
}

export default function AdminPageShell({
  section,
  title,
  description,
  features = [],
  actions = [],
  featureClassName = 'hero-benefits',
  featureItemClassName = 'benefit-item',
  showScrollTopButton = false,
  children,
}: AdminPageShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const adminScope = getAdminScopeMeta(user)
  const isScrollTopVisible = useScrollTopVisibility({ enabled: showScrollTopButton })
  const currentPath = location.pathname
  const navSections = getAdminTabs()

  const navigateToSection = (nextSection: AdminTab) => {
    navigate(makeWorkspaceUrl(nextSection, currentPath))
  }

  return (
    <>
      <div className={`admin-page admin-page--${section}`}>
        {showScrollTopButton ? (
          <button
            type="button"
            id="scroll-top-btn"
            className={`scroll-top-btn${isScrollTopVisible ? ' show' : ''}`}
            onClick={() => scrollToTop()}
            aria-label="Back to top"
            title="Back to top"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        ) : null}
        <header className="header">
          <div className="header-content">
            <a
              href={makeWorkspaceUrl(section, currentPath)}
              className="logo"
              onClick={(event) => {
                event.preventDefault()
                navigate(makeWorkspaceUrl(section, currentPath))
              }}
            >
              ABC Foodbank
            </a>
            <nav aria-label="Admin navigation">
              <ul className="nav-links">
                {navSections.map((navSection) => (
                  <li key={navSection.key}>
                    <a
                      href={makeWorkspaceUrl(navSection.key, currentPath)}
                      className={section === navSection.key ? 'active' : ''}
                      onClick={(event) => {
                        event.preventDefault()
                        navigateToSection(navSection.key)
                      }}
                    >
                      {navSection.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="header-actions">
              <div className="admin-tag">{adminScope.roleLabel}</div>
              <AdminButton
                tone="secondary"
                className="header-auth-button"
                onClick={() => {
                  void signOut()
                  navigate('/home', { replace: true })
                }}
              >
                Sign Out
              </AdminButton>
            </div>
          </div>
        </header>
        <main>
          <section className="hero-section section" id="top">
            <div className="container">
              <div className="hero-text">
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              {features.length > 0 ? (
                <div className={featureClassName}>
                  {features.map((feature) => (
                    <div key={feature} className={featureItemClassName}>
                      {feature}
                    </div>
                  ))}
                </div>
              ) : null}
              {actions.length > 0 ? (
                <div className="hero-buttons">
                  {actions.map((action) =>
                    action.onClick ? (
                      <AdminButton
                        key={`${action.label}-${action.targetId ?? action.href ?? 'action'}`}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </AdminButton>
                    ) : (
                      <AdminLinkButton
                        key={`${action.label}-${action.targetId ?? action.href ?? 'link'}`}
                        href={action.href ?? `#${action.targetId ?? 'top'}`}
                      >
                        {action.label}
                      </AdminLinkButton>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </section>
          {children}
        </main>
      </div>
      <PublicSiteFooter />
    </>
  )
}

