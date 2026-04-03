import { useLocation, useNavigate } from 'react-router-dom'

export default function Footer() {
  const location = useLocation()
  const navigate = useNavigate()
  const isHomePage = location.pathname === '/'
  const isFindFoodBankPage = location.pathname === '/find-foodbank'
  const isAdminPreviewPage = location.pathname === '/admin'
  const isStandalonePreviewPage =
    location.pathname === '/food-management-preview' ||
    location.pathname === '/data-dashboard-preview'

  if (isHomePage || isFindFoodBankPage || isAdminPreviewPage || isStandalonePreviewPage) {
    return null
  }

  return (
    <footer className="mt-auto shrink-0 border-t-2 border-[#F4C542] bg-[#FFF8DD] py-14 text-center text-[#2B4A5A]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-2xl font-bold tracking-wide text-[#1E1E1E]">
          ABC <span className="text-[#F4C542]">Foodbank</span>
        </div>
        <div className="mb-10 flex flex-wrap justify-center gap-8 text-sm md:gap-12 md:text-base">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[#2B4A5A] no-underline transition-colors hover:text-[#F4C542]"
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => navigate('/find-foodbank')}
            className="text-[#2B4A5A] no-underline transition-colors hover:text-[#F4C542]"
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[#2B4A5A] no-underline transition-colors hover:text-[#F4C542]"
          >
            FAQs
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[#2B4A5A] no-underline transition-colors hover:text-[#F4C542]"
          >
            Privacy Policy
          </button>
        </div>
        <div className="text-xs tracking-wide text-[#2B4A5A]/60 md:text-sm">
          Copyright 2026 ABC Community Food Bank. Registered Charity No. 1234567. All Rights
          Reserved.
        </div>
      </div>
    </footer>
  )
}
