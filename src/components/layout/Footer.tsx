export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-white/70 py-16 text-center mt-auto shrink-0">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-2xl font-bold tracking-wide mb-10 text-white">
          ABC <span className="text-[#F7DC6F]">Foodbank</span>
        </div>
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 mb-12 text-sm md:text-base">
          <a href="#" className="hover:text-white transition-colors text-white/70 no-underline">About Us</a>
          <a href="#" className="hover:text-white transition-colors text-white/70 no-underline">Contact</a>
          <a href="#" className="hover:text-white transition-colors text-white/70 no-underline">FAQs</a>
          <a href="#" className="hover:text-white transition-colors text-white/70 no-underline">Privacy Policy</a>
        </div>
        <div className="text-xs md:text-sm tracking-wide text-white/50">
          © 2026 ABC Community Food Bank. Registered Charity No. 1234567. All Rights Reserved.
        </div>
      </div>
    </footer>
  )
}
