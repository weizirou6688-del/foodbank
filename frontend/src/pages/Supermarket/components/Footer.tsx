import { useNavigate } from 'react-router-dom'

export function Footer() {
  const navigate = useNavigate()

  return (
    <footer className="py-12" style={{ backgroundColor: '#1C2B2A' }}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 text-center">
          <h2 className="text-[28px] font-bold" style={{ color: '#FFFFFF' }}>
            ABC Foodbank
          </h2>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-6 md:gap-12">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[15px] transition-all hover:underline"
            style={{ color: '#5AADA0' }}
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => navigate('/find-foodbank')}
            className="text-[15px] transition-all hover:underline"
            style={{ color: '#5AADA0' }}
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[15px] transition-all hover:underline"
            style={{ color: '#5AADA0' }}
          >
            FAQs
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-[15px] transition-all hover:underline"
            style={{ color: '#5AADA0' }}
          >
            Privacy Policy
          </button>
        </div>

        <div className="text-center text-[14px]" style={{ color: '#6B7280' }}>
          Copyright 2026 ABC Community Food Bank. Registered Charity No. 1234567. All Rights
          Reserved.
        </div>
      </div>
    </footer>
  )
}
