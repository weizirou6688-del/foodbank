import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginModal from '@/features/auth/components/LoginModal'

interface ImpactMetric {
  change: string
  value: string
  label: string
  note: string
  positive?: boolean
}

interface UniqueCard {
  title: string
  description: string
  image: string
}

interface DonationTier {
  name: string
  amount: string
  description: string
  cta: string
  features: string[]
  featured?: boolean
}

const impactMetrics: ImpactMetric[] = [
  { change: '+18%', value: '2.4M', label: 'Meals Delivered', note: 'This year', positive: true },
  { change: '+7%', value: '8,450', label: 'Active Volunteers', note: 'This month', positive: true },
  {
    change: '+2.3%',
    value: '98.7%',
    label: 'Satisfaction Rate',
    note: 'From beneficiaries',
    positive: true,
  },
  { change: '-15%', value: '<2hrs', label: 'Response Time', note: 'Average', positive: true },
]

const uniqueCards: UniqueCard[] = [
  {
    title: 'Filling Essential Gaps',
    description:
      'We provide essential ingredients to encourage nutritious home cooking. We supply everyday toiletries, cleaning and personal hygiene products.',
    image: '/figma-home/photo-1701914446310-8b63a547ab37',
  },
  {
    title: 'Reducing Food Waste',
    description:
      'We communicate weekly with our food banks, sending them an option sheet and providing only what they need. This way nothing is wasted.',
    image: '/figma-home/photo-1603418735094-800d47a56ea1',
  },
  {
    title: 'Connecting Food Banks',
    description:
      'We link our food bank managers to create a network where they can share expertise. This network is also used to redistribute excess items and offload fresh goods.',
    image: '/figma-home/photo-1588822534638-028d5ddc07ac',
  },
  {
    title: 'Community Volunteering',
    description:
      'We are a volunteer led organisation utilising our local community to pack, distribute and deliver food to the food banks.',
    image: '/figma-home/photo-1758599668178-d9716bbda9d5',
  },
]

const donationTiers: DonationTier[] = [
  {
    name: 'Supporter',
    amount: '£25',
    description: 'Feeds a family of 4 for one week',
    cta: 'Donate £25',
    features: ['Monthly impact updates', 'Digital certificate', 'Community newsletter'],
  },
  {
    name: 'Champion',
    amount: '£75',
    description: 'Supports 3 families for one week',
    cta: 'Donate £75',
    features: [
      'Everything in Supporter',
      'Quarterly impact calls',
      'Early program access',
      'Tax-efficient giving',
    ],
    featured: true,
  },
  {
    name: 'Hero',
    amount: '£200',
    description: 'Feeds 8 families for one week',
    cta: 'Donate £200',
    features: [
      'Everything in Champion',
      'Annual site visits',
      'Donor wall recognition',
      'Direct community link',
    ],
  },
]

function ArrowTrend({ positive = true }: { positive?: boolean }) {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      {positive ? (
        <path
          fillRule="evenodd"
          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 12.586V5a1 1 0 112 0v7.586l2.293-2.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      )}
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-[#4CAF50] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div className="home-figma-font min-h-screen bg-white">
        <nav className="bg-white border-b border-[#E5E8ED]">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex items-center justify-between h-[72px]">
              <div className="flex items-center">
                <span className="text-xl font-bold text-[#0D1117] tracking-tight">ABC Foodbank</span>
              </div>

              <div className="hidden md:flex items-center gap-8">
                <button type="button" onClick={() => navigate('/donate/cash')} className="text-[#57606A] hover:text-[#0D1117] transition-colors text-[15px] font-medium">
                  Donate Cash
                </button>
                <button type="button" onClick={() => navigate('/donate/goods')} className="text-[#57606A] hover:text-[#0D1117] transition-colors text-[15px] font-medium">
                  Donate Goods
                </button>
                <button type="button" onClick={() => navigate('/find-foodbank')} className="text-[#57606A] hover:text-[#0D1117] transition-colors text-[15px] font-medium">
                  Get Supports
                </button>
                <button type="button" onClick={() => scrollTo('about')} className="text-[#57606A] hover:text-[#0D1117] transition-colors text-[15px] font-medium">
                  Volunteering
                </button>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <button type="button" onClick={() => navigate('/find-foodbank')} className="px-5 py-2 bg-[#FFB800] text-[#0D1117] hover:bg-[#E5A600] transition-colors rounded-[4px] text-[15px] font-semibold">
                  Public
                </button>
                <button type="button" onClick={() => setLoginModal({ open: true, tab: 'signin' })} className="px-4 py-2 text-[#0D1117] hover:bg-[#F4F7FA] transition-colors rounded-[4px] text-[15px] font-medium border border-[#0D1117]">
                  Sign In
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLoginModal({ open: true, tab: 'signin' })}
                className="md:hidden text-[#0D1117] p-2"
                aria-label="Sign in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        <main>
          <div className="bg-white border-b border-[#E5E8ED]">
            <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-32">
              <div className="grid md:grid-cols-12 gap-12 items-center">
                <div className="md:col-span-7">
                  <h1 className="text-[3.5rem] md:text-[4rem] leading-[1.1] font-bold text-[#0D1117] mb-6 tracking-tight">
                    Food security, <span className="text-[#FFB800]">engineered</span>
                  </h1>
                  <p className="text-[1.25rem] leading-relaxed text-[#57606A] mb-8 max-w-[560px]">
                    Modern infrastructure connecting communities with essential resources. Real-time
                    food bank locations, transparent operations, dignified access.
                  </p>
                  <div className="flex flex-wrap gap-4 md:ml-4">
                    <button type="button" onClick={() => navigate('/find-foodbank')} className="px-6 py-3 bg-[#FFB800] text-[#0D1117] hover:bg-[#E5A600] transition-all rounded-[4px] text-[15px] font-semibold shadow-[0_4px_12px_rgba(255,184,0,0.2)]">
                      Find Food Bank Now
                    </button>
                    <button type="button" onClick={() => scrollTo('donate')} className="px-6 py-3 border border-[#E5E8ED] text-[#0D1117] hover:bg-[#F4F7FA] transition-colors rounded-[4px] text-[15px] font-semibold">
                      Donate
                    </button>
                  </div>
                </div>

                <div className="md:col-span-5">
                  <div className="relative">
                    <div className="relative bg-white rounded-[8px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E5E8ED]">
                      <div className="relative h-[420px]">
                        <img src="/figma-home/photo-1710092784814-4a6f158913b8" alt="Food bank operations" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="impact" className="bg-[#F6F8FA]">
            <div className="max-w-[1200px] mx-auto px-6 py-24">
              <div className="text-center max-w-[640px] mx-auto mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E5E8ED] rounded-full mb-4">
                  <span className="text-[13px] font-semibold text-[#57606A] uppercase tracking-wide">IMPACT METRICS</span>
                </div>
                <h2 className="text-[2.5rem] font-bold text-[#0D1117] mb-4 tracking-tight">Real-time impact data</h2>
                <p className="text-[17px] text-[#57606A] leading-relaxed">
                  Every number represents real people and communities. Updated live from our
                  operations network.
                </p>
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                {impactMetrics.map((metric) => (
                  <div key={metric.label} className="bg-white rounded-[8px] p-6 border border-[#E5E8ED] hover:border-[#FFB800] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[12px] font-semibold bg-[#E8F5E9] text-[#2E7D32]">
                        <ArrowTrend positive={metric.positive} />
                        {metric.change}
                      </span>
                    </div>
                    <div className="text-[3rem] font-bold text-[#0D1117] leading-none mb-2">{metric.value}</div>
                    <div className="text-[15px] font-semibold text-[#0D1117] mb-1">{metric.label}</div>
                    <div className="text-[13px] text-[#57606A]">{metric.note}</div>
                  </div>
                ))}
              </div>

              <div className="text-center mt-8">
                <p className="text-[13px] text-[#57606A]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full animate-pulse" />
                    Live data • Updated every 15 minutes
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div id="how-it-works" className="bg-white">
            <div className="max-w-[1200px] mx-auto px-6 py-40">
              <div className="text-center max-w-[640px] mx-auto mb-20">
                <h2 className="text-[2.5rem] font-bold text-[#0D1117] mb-4 tracking-tight">How it works</h2>
                <p className="text-[18px] text-[#57606A] leading-relaxed">
                  A streamlined, dignified process built on modern infrastructure. From search to
                  support in three simple steps.
                </p>
              </div>

              <div className="relative">
                <div className="hidden md:block absolute top-[60px] left-[calc(16.66%)] right-[calc(16.66%)] h-[2px] bg-[#E5E8ED]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFB800] to-transparent opacity-20" />
                </div>

                <div className="grid md:grid-cols-3 gap-12 relative">
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center mb-6">
                      <div className="relative">
                        <div className="w-[120px] h-[120px] bg-[#FFF9E6] rounded-full flex items-center justify-center border-2 border-[#FFB800]/20">
                          <div className="text-[#FFB800]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#FFB800] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                          <span className="text-[14px] font-bold text-[#0D1117]">01</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-[1.5rem] font-semibold text-[#0D1117] mb-3 tracking-tight">Search &amp; Locate</h3>
                    <p className="text-[15px] text-[#57606A] leading-relaxed max-w-[280px] mx-auto">
                      Enter your postcode to instantly find nearby food banks. Our platform shows
                      real-time availability and operating hours.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center mb-6">
                      <div className="relative">
                        <div className="w-[120px] h-[120px] bg-[#FFF9E6] rounded-full flex items-center justify-center border-2 border-[#FFB800]/20">
                          <div className="text-[#FFB800]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#FFB800] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                          <span className="text-[14px] font-bold text-[#0D1117]">02</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-[1.5rem] font-semibold text-[#0D1117] mb-3 tracking-tight">Apply Online</h3>
                    <p className="text-[15px] text-[#57606A] leading-relaxed max-w-[280px] mx-auto">
                      Complete a simple digital application. No paperwork, no waiting. Receive
                      instant confirmation and next steps.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center mb-6">
                      <div className="relative">
                        <div className="w-[120px] h-[120px] bg-[#FFF9E6] rounded-full flex items-center justify-center border-2 border-[#FFB800]/20">
                          <div className="text-[#FFB800]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#FFB800] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                          <span className="text-[14px] font-bold text-[#0D1117]">03</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-[1.5rem] font-semibold text-[#0D1117] mb-3 tracking-tight">Receive Support</h3>
                    <p className="text-[15px] text-[#57606A] leading-relaxed max-w-[280px] mx-auto">
                      Visit your chosen location with digital confirmation. Track your support
                      history and access resources through your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="about" className="bg-[#F6F8FA]">
            <div className="max-w-[1200px] mx-auto px-6 py-32">
              <div className="text-center max-w-[680px] mx-auto mb-16">
                <h2 className="text-[2.75rem] font-bold text-[#0D1117] mb-4 tracking-tight">
                  What makes Food Bank Aid unique?
                </h2>
              </div>

              <div className="grid md:grid-cols-4 gap-8">
                {uniqueCards.map((card) => (
                  <div key={card.title} className="group">
                    <div className="relative mb-6 overflow-hidden rounded-[8px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#E5E8ED]">
                      <div className="relative h-[240px] overflow-hidden">
                        <img src={card.image} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    </div>
                    <h3 className="text-[1.25rem] font-bold text-[#0D1117] mb-3 tracking-tight">{card.title}</h3>
                    <p className="text-[15px] text-[#57606A] leading-relaxed">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="donate" className="bg-white">
            <div className="max-w-[1200px] mx-auto px-6 py-32">
              <div className="text-center max-w-[680px] mx-auto mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFF9E6] border border-[#FFB800]/20 rounded-full mb-4">
                  <span className="text-[13px] font-semibold text-[#B8860B] uppercase tracking-wide">MAKE AN IMPACT</span>
                </div>
                <h2 className="text-[2.75rem] font-bold text-[#0D1117] mb-4 tracking-tight">Support our mission</h2>
                <p className="text-[17px] text-[#57606A] leading-relaxed">
                  Every contribution directly funds food distribution and community support. Choose
                  your impact level.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {donationTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={
                      tier.featured
                        ? 'relative bg-white rounded-[24px] p-8 transition-all border-2 border-[#FFB800] shadow-[0_8px_30px_rgba(255,184,0,0.15)]'
                        : 'relative bg-white rounded-[24px] p-8 transition-all border border-[#E5E8ED] hover:border-[#FFB800] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]'
                    }
                  >
                    {tier.featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-block px-4 py-1.5 bg-[#FFB800] text-[#0D1117] rounded-full text-[12px] font-bold uppercase tracking-wide shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                          Most Popular
                        </span>
                      </div>
                    )}
                    <div className="text-[13px] font-semibold text-[#57606A] uppercase tracking-wide mb-2">{tier.name}</div>
                    <div className="mb-4">
                      <span className="text-[3.5rem] font-bold text-[#0D1117] leading-none">{tier.amount}</span>
                      <span className="text-[17px] text-[#57606A] ml-1">/month</span>
                    </div>
                    <p className="text-[15px] font-semibold text-[#FFB800] mb-6">{tier.description}</p>
                    <button
                      type="button"
                      onClick={() => navigate('/donate/cash')}
                      className={
                        tier.featured
                          ? 'w-full py-3 rounded-[4px] text-[15px] font-semibold transition-all mb-6 bg-[#FFB800] text-[#0D1117] hover:bg-[#E5A600] shadow-[0_4px_12px_rgba(255,184,0,0.2)]'
                          : 'w-full py-3 rounded-[4px] text-[15px] font-semibold transition-all mb-6 bg-[#F4F7FA] text-[#0D1117] hover:bg-[#E5E8ED]'
                      }
                    >
                      {tier.cta}
                    </button>
                    <div className="space-y-3 pt-6 border-t border-[#E5E8ED]">
                      {tier.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <CheckIcon />
                          <span className="text-[14px] text-[#57606A]">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#F6F8FA] rounded-[8px] p-8 border border-[#E5E8ED]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-[1.25rem] font-bold text-[#0D1117] mb-2">Prefer a one-time donation?</h3>
                    <p className="text-[15px] text-[#57606A]">Every contribution makes a difference. Make a single donation of any amount.</p>
                  </div>
                  <button type="button" onClick={() => navigate('/donate/cash')} className="px-6 py-3 bg-[#0D1117] text-white hover:bg-[#24292F] transition-colors rounded-[4px] text-[15px] font-semibold whitespace-nowrap">
                    One-Time Donation
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
                {['Secure Payment', 'Tax Deductible', 'Cancel Anytime'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[#57606A]">
                    <svg className="w-5 h-5 text-[#4CAF50]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-[14px] font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#0D1117] text-white border-t border-[#1F2937]">
          <div className="max-w-[1200px] mx-auto px-6 py-16">
            <div className="grid md:grid-cols-12 gap-12 mb-12">
              <div className="md:col-span-6">
                <h3 className="text-[1.25rem] font-bold mb-3 text-white">ABC Foodbank</h3>
                <p className="text-[15px] text-[#8B949E] leading-relaxed mb-6 max-w-[480px]">
                  Building the infrastructure for food security. A transparent platform connecting
                  communities with local resources.
                </p>
                <div className="mb-6">
                  <div className="text-[13px] font-semibold uppercase tracking-wide mb-2 text-[#ffffff]">Contact Office</div>
                  <div className="text-[15px] text-white">Penglais, Aberystwyth SY23 3FL</div>
                </div>
                <div className="flex items-center gap-3">
                  <a href="#twitter" className="w-9 h-9 bg-[#21262D] hover:bg-[#FFB800] rounded-[4px] flex items-center justify-center transition-all group" aria-label="Twitter">
                    <svg className="w-4 h-4 text-[#8B949E] group-hover:text-[#0D1117]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a href="#linkedin" className="w-9 h-9 bg-[#21262D] hover:bg-[#FFB800] rounded-[4px] flex items-center justify-center transition-all group" aria-label="LinkedIn">
                    <svg className="w-4 h-4 text-[#8B949E] group-hover:text-[#0D1117]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a href="#instagram" className="w-9 h-9 bg-[#21262D] hover:bg-[#FFB800] rounded-[4px] flex items-center justify-center transition-all group" aria-label="Instagram">
                    <svg className="w-4 h-4 text-[#8B949E] group-hover:text-[#0D1117]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="md:col-span-2">
                <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-wide text-[#8B949E]">Platform</h4>
                <ul className="space-y-3">
                  <li><button type="button" onClick={() => scrollTo('about')} className="text-[15px] text-white hover:text-[#FFB800] transition-colors">About Us</button></li>
                  <li><button type="button" onClick={() => navigate('/donate/cash')} className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Donate Cash</button></li>
                  <li><button type="button" onClick={() => navigate('/donate/goods')} className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Donate Goods</button></li>
                  <li><button type="button" onClick={() => navigate('/find-foodbank')} className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Find Food Bank</button></li>
                </ul>
              </div>

              <div className="md:col-span-2">
                <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-wide text-[#8B949E]">Resources</h4>
                <ul className="space-y-3">
                  <li><button type="button" onClick={() => setLoginModal({ open: true, tab: 'signin' })} className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Sign In</button></li>
                  <li><a href="#volunteer" className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Volunteer</a></li>
                  <li><a href="#support" className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Support</a></li>
                </ul>
              </div>

              <div className="md:col-span-2">
                <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-wide text-[#8B949E]">Legal</h4>
                <ul className="space-y-3">
                  <li><a href="#privacy" className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Privacy</a></li>
                  <li><a href="#security" className="text-[15px] text-white hover:text-[#FFB800] transition-colors">Security</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-[#21262D]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-[13px] text-[#8B949E]">© 2026 ABC Foodbank. All rights reserved.</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#48C774] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
