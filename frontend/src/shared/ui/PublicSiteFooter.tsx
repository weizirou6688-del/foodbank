import { useState, type CSSProperties, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'

type RestrictedRole = 'admin' | 'supermarket'

type FooterLink = {
  label: string
  path: string
  requiredRole?: RestrictedRole
}

type FooterSection = {
  title: string
  links: FooterLink[]
}

const footerSections: FooterSection[] = [
  {
    title: 'Community',
    links: [
      { label: 'About Us', path: '/home#about' },
      { label: 'Get Support', path: '/find-foodbank' },
      { label: 'Donate Cash', path: '/donate/cash' },
      { label: 'Donate Goods', path: '/donate/goods' },
    ],
  },
  {
    title: 'Admin Tools',
    links: [
      { label: 'Inventory Management', path: '/admin?section=food', requiredRole: 'admin' },
      { label: 'Data Dashboard', path: '/admin?section=statistics', requiredRole: 'admin' },
    ],
  },
  {
    title: 'Partner Access',
    links: [{ label: 'Supermarket Restock', path: '/supermarket', requiredRole: 'supermarket' }],
  },
]

const FOOTER_FONT_FAMILY = 'Inter, system-ui, sans-serif'
const footerBaseTextStyle: CSSProperties = {
  fontFamily: FOOTER_FONT_FAMILY,
  letterSpacing: 'normal',
  textAlign: 'start',
}
const footerBrandStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '20px',
  lineHeight: '30px',
  fontWeight: 700,
  marginBottom: '12px',
}
const footerDescriptionStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '15px',
  lineHeight: '24.375px',
  fontWeight: 400,
  marginBottom: '24px',
}
const footerEyebrowStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '13px',
  lineHeight: '19.5px',
  fontWeight: 600,
  letterSpacing: '0.325px',
  textTransform: 'uppercase',
  marginBottom: '8px',
}
const footerBodyStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '15px',
  lineHeight: '22.5px',
  fontWeight: 400,
}
const footerSectionTitleStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '13px',
  lineHeight: '19.5px',
  fontWeight: 600,
  letterSpacing: '0.325px',
  textTransform: 'uppercase',
  marginBottom: '16px',
}
const footerLinkStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '15px',
  lineHeight: '22.5px',
  fontWeight: 400,
}
const footerCopyrightStyle: CSSProperties = {
  ...footerBaseTextStyle,
  fontSize: '13px',
  lineHeight: '19.5px',
  fontWeight: 400,
}

export default function PublicSiteFooter() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [loginModal, setLoginModal] = useState<{
    open: boolean
    redirectTo: string | null
    requiredRole: RestrictedRole | null
  }>({
    open: false,
    redirectTo: null,
    requiredRole: null,
  })

  const handleFooterLinkClick = (event: MouseEvent<HTMLAnchorElement>, link: FooterLink) => {
    event.preventDefault()

    if (link.requiredRole && !isAuthenticated) {
      setLoginModal({
        open: true,
        redirectTo: link.path,
        requiredRole: link.requiredRole,
      })
      return
    }

    navigate(link.path)
  }

  const closeLoginModal = () => {
    setLoginModal({
      open: false,
      redirectTo: null,
      requiredRole: null,
    })
  }

  return (
    <>
      <footer className="bg-[#0D1117] border-t border-[#1F2937] text-white" style={footerBaseTextStyle}>
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div className="mb-12 grid gap-12 md:grid-cols-12">
            <div className="md:col-span-6">
              <h3 style={footerBrandStyle} className="text-white">
                ABC Foodbank
              </h3>
              <p style={footerDescriptionStyle} className="max-w-[480px] text-[#8B949E]">
                Building the infrastructure for food security. A transparent platform connecting
                communities with local resources.
              </p>
              <div className="mb-6">
                <div style={footerEyebrowStyle} className="text-[#ffffff]">
                  Contact Office
                </div>
                <div style={footerBodyStyle} className="text-white">
                  Penglais, Aberystwyth SY23 3FL
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="#twitter"
                  className="group flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#21262D] transition-all hover:bg-[#FFB800]"
                  aria-label="Twitter"
                >
                  <svg
                    className="h-4 w-4 text-[#8B949E] group-hover:text-[#0D1117]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a
                  href="#linkedin"
                  className="group flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#21262D] transition-all hover:bg-[#FFB800]"
                  aria-label="LinkedIn"
                >
                  <svg
                    className="h-4 w-4 text-[#8B949E] group-hover:text-[#0D1117]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href="#instagram"
                  className="group flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#21262D] transition-all hover:bg-[#FFB800]"
                  aria-label="Instagram"
                >
                  <svg
                    className="h-4 w-4 text-[#8B949E] group-hover:text-[#0D1117]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>
            </div>

            {footerSections.map((section) => (
              <div key={section.title} className="md:col-span-2">
                <h4 style={footerSectionTitleStyle} className="text-[#8B949E]">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.path}>
                      <a
                        href={link.path}
                        onClick={(event) => handleFooterLinkClick(event, link)}
                        style={footerLinkStyle}
                        className="text-white transition-colors hover:text-[#FFB800]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[#21262D] pt-8">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p style={footerCopyrightStyle} className="text-[#8B949E]">
                Copyright 2026 ABC Foodbank. All rights reserved.
              </p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#48C774]" />
              </div>
            </div>
          </div>
        </div>
      </footer>

      <LoginModal
        isOpen={loginModal.open}
        onClose={closeLoginModal}
        initialTab="signin"
        redirectTo={loginModal.redirectTo}
        requiredRole={loginModal.requiredRole}
      />
    </>
  )
}
