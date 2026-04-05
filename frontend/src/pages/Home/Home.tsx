import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { statsAPI } from '@/shared/lib/api'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

interface ImpactMetric {
  change: string
  value: string
  label: string
  note: string
  positive?: boolean
}

interface DonationCategory {
  title: string
  items: string[]
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
  href: string
  features: string[]
  featured?: boolean
}

const defaultImpactMetrics: ImpactMetric[] = [
  { change: '+18%', value: '28,600', label: 'Network Food Units Distributed', note: 'Platform Total', positive: true },
  { change: '+8.2%', value: '1,240+', label: 'Households Supported Across the Network', note: 'Platform Total', positive: true },
  {
    change: '+2.3%',
    value: '98.2%',
    label: 'Aid Redemption Success Rate Across the Network',
    note: 'This Month',
    positive: true,
  },
  { change: '+15%', value: '12,500', label: 'Goods Donation Units Coordinated', note: 'This Year', positive: true },
]

const goodsCategories: DonationCategory[] = [
  {
    title: 'Non-Perishable Food',
    items: [
      'Tinned vegetables & fruit',
      'Rice, pasta & cereals',
      'Tinned meat & fish',
      'UHT milk & plant-based drinks',
      'Cooking oil & sauces',
      'Tea, coffee & long-life juice',
    ],
  },
  {
    title: 'Hygiene Essentials',
    items: [
      'Shampoo & conditioner',
      'Soap & body wash',
      'Toothpaste & toothbrushes',
      'Deodorant',
      'Sanitary pads & tampons',
      'Shaving foam & razors',
    ],
  },
  {
    title: 'Baby & Child Care',
    items: [
      'Baby formula & baby food',
      'Nappies & wet wipes',
      "Children's snacks & cereals",
      'Baby toiletries',
      "Children's books & toys",
    ],
  },
  {
    title: 'Household Items',
    items: [
      'Toilet roll & kitchen roll',
      'Laundry detergent',
      'Surface cleaner & disinfectant',
      'Dishwashing liquid',
      'Bin bags',
    ],
  },
]

const goodsBannerBenefits = [
  'Search for a nearby food bank',
  'Your request is sent to the selected team',
  'Collection or drop-off is arranged locally',
  'Platform support across the wider network',
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
      'We connect partner food banks so teams can share expertise, coordinate requests, and move surplus stock where it is needed most.',
    image: '/figma-home/photo-1588822534638-028d5ddc07ac',
  },
  {
    title: 'Community Volunteering',
    description:
      'Our volunteer network helps sort, pack, and move donations so local food banks can respond quickly and consistently.',
    image: '/figma-home/photo-1758599668178-d9716bbda9d5',
  },
]

const donationTiers: DonationTier[] = [
  {
    name: 'Supporter',
    amount: '\u00A35',
    description: 'Monthly gift that helps cover essential goods across the network',
    cta: 'Donate \u00A35 Monthly',
    href: '/donate/cash?type=monthly&amount=5#donate-form',
    features: ['Monthly impact updates', 'Digital donation certificate', 'Community newsletter'],
  },
  {
    name: 'Champion',
    amount: '\u00A315',
    description: 'Monthly gift that helps fund urgent support where demand is highest',
    cta: 'Donate \u00A315 Monthly',
    href: '/donate/cash?type=monthly&amount=15#donate-form',
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
    amount: '\u00A330',
    description: 'Monthly gift that strengthens food purchasing and coordination across multiple sites',
    cta: 'Donate \u00A330 Monthly',
    href: '/donate/cash?type=monthly&amount=30#donate-form',
    features: [
      'Everything in Champion',
      'Annual site visits',
      'Donor wall recognition',
      'Network impact updates',
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

function ListCheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-[#059669]" fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BannerCheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#FFB800] text-[#121212]">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5l3 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function TrustShieldIcon() {
  return (
    <svg className="h-5 w-5 text-[#4CAF50]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetric[]>(defaultImpactMetrics)

  useEffect(() => {
    let active = true

    statsAPI
      .getPublicImpact('month')
      .then((response) => {
        if (!active || !Array.isArray(response.impactMetrics) || response.impactMetrics.length === 0) {
          return
        }

        setImpactMetrics(
          response.impactMetrics.map((metric) => ({
            change: metric.change,
            value: metric.value,
            label: metric.label,
            note: metric.note,
            positive: metric.positive,
          })),
        )
      })
      .catch(() => {
        // Keep the homepage stable with fallback metrics when the API is unavailable.
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!location.hash) {
      return
    }

    const targetId = location.hash.slice(1)
    const timeoutHandle = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)

    return () => window.clearTimeout(timeoutHandle)
  }, [location.hash])

  // Some homepage navigation stays on the same page and scrolls to sections
  // instead of pushing the user onto a new route.
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div className="home-figma-font min-h-screen bg-white">
        <PrimaryNavbar variant="public" />

        <main>
          <div className="bg-white border-b border-[#E5E8ED]">
            <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-32">
              <div className="grid md:grid-cols-12 gap-12 items-center">
                <div className="md:col-span-7">
                  <h1 className="text-[3.5rem] md:text-[4rem] leading-[1.1] font-bold text-[#0D1117] mb-6 tracking-tight">
                    Food security, <span className="text-[#FFB800]">engineered</span>
                  </h1>
                  <p className="text-[1.25rem] leading-relaxed text-[#57606A] mb-8 max-w-[560px]">
                    Modern infrastructure supporting food banks across our network. Real-time
                    locations, coordinated operations, and dignified access to support.
                  </p>
                  <div className="flex max-w-[360px] flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => navigate('/find-foodbank')}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] bg-[#FFB800] px-4 py-[0.85rem] text-center text-[0.95rem] font-semibold text-[#121212] transition-all duration-300 hover:-translate-y-px hover:bg-[#FFA900]"
                    >
                      Find Foodbank Now
                    </button>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => scrollTo('donate-goods')}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] border border-[#121212] bg-white px-4 py-[0.85rem] text-center text-[0.95rem] font-semibold text-[#121212] transition-colors duration-300 hover:bg-[#F8F9FA]"
                      >
                        Donate Goods
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollTo('donate-cash')}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] border border-[#121212] bg-white px-4 py-[0.85rem] text-center text-[0.95rem] font-semibold text-[#121212] transition-colors duration-300 hover:bg-[#F8F9FA]"
                      >
                        Donate Cash
                      </button>
                    </div>
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

          <div id="impact" className="bg-[#F8F9FA]">
            <div className="max-w-[1200px] mx-auto px-6 py-24">
              <div className="text-center max-w-[640px] mx-auto mb-16">
                <h2 className="text-[2.5rem] font-bold text-[#0D1117] mb-4 tracking-tight">
                  Platform-wide impact
                </h2>
                <p className="text-[18px] text-[#57606A] leading-relaxed">
                  These figures reflect support coordinated across our food bank network, not a
                  single local site. Updated from live platform reporting.
                </p>
              </div>

              <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                {impactMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="bg-white rounded-[10px] px-6 py-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  >
                    <div className="mb-4 inline-flex items-center gap-1 rounded-[4px] bg-[#ECFDF5] px-2 py-1 text-[0.8rem] font-semibold text-[#059669]">
                      <ArrowTrend positive={metric.positive} />
                      {metric.change}
                    </div>
                    <div className="mb-1 text-[2rem] font-bold tracking-[-0.02em] text-[#121212]">
                      {metric.value}
                    </div>
                    <div className="mb-1 text-[1rem] font-semibold text-[#121212]">{metric.label}</div>
                    <div className="text-[0.85rem] text-[#4B4B4B]">{metric.note}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[0.75rem] text-[#4B4B4B]">
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#059669]" />
                <span>Live data</span>
                <span aria-hidden="true">&bull;</span>
                <span>Updated every 15 minutes</span>
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
              <div className="text-center max-w-[640px] mx-auto mb-16">
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

          <div id="donate-goods" className="bg-white">
            <div className="max-w-[1200px] mx-auto px-6 py-32">
              <div className="text-center max-w-[640px] mx-auto mb-16">
                <h2 className="text-[2.5rem] font-bold text-[#0D1117] mb-4 tracking-tight">
                  Donate Goods
                </h2>
                <p className="text-[18px] text-[#57606A] leading-relaxed">
                  Choose a food bank near you and submit a donation request for their local team.
                  We record the request through the platform and help coordinate next steps.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 min-[576px]:grid-cols-2 min-[992px]:grid-cols-4 mb-10">
                {goodsCategories.map((category) => (
                  <div
                    key={category.title}
                    className="h-full rounded-[10px] border border-[#E5E5E5] bg-white px-6 py-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FFB800] hover:shadow-[0_4px_12px_rgba(255,184,0,0.08)]"
                  >
                    <h3 className="text-[1.25rem] font-semibold text-[#0D1117] mb-3 tracking-tight">{category.title}</h3>
                    <ul className="list-none text-[15px] leading-relaxed text-[#57606A]">
                      {category.items.map((item) => (
                        <li key={item} className="relative mb-[0.35rem] pl-4 last:mb-0">
                          <span className="absolute left-0 top-[0.1rem]" aria-hidden="true">
                            <ListCheckIcon />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="rounded-[10px] bg-[#FFF3CD] px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[1.25rem] font-semibold text-[#0D1117] mb-3 tracking-tight">
                    Donate Goods Through a Local Food Bank
                  </h3>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2 min-[576px]:grid-cols-2">
                    {goodsBannerBenefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 text-[15px] text-[#57606A]">
                        <BannerCheckIcon />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/donate/goods')}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] bg-[#FFB800] px-5 py-[0.55rem] text-center text-[0.85rem] font-semibold text-[#121212] transition-all duration-300 hover:-translate-y-px hover:bg-[#FFA900]"
                  >
                    View Full Donation Guide
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="donate-cash" className="bg-[#F6F8FA]">
            <div className="max-w-[1200px] mx-auto px-6 py-32">
              <div className="text-center max-w-[640px] mx-auto mb-16">

                <h2 className="text-[2.5rem] font-bold text-[#0D1117] mb-4 tracking-tight">
                  Support the wider network
                </h2>
                <p className="text-[18px] text-[#57606A] leading-relaxed">
                  Cash donations are received and coordinated by the platform team to support food
                  purchasing, urgent needs, and network-wide operations.
                </p>
              </div>

              <div className="mb-10 grid gap-6 md:grid-cols-3">
                {donationTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={
                      tier.featured
                        ? 'relative rounded-[10px] border-2 border-[#FFB800] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(255,184,0,0.15)]'
                        : 'relative rounded-[10px] border border-[#E5E5E5] bg-white px-6 py-8'
                    }
                  >
                    {tier.featured && (
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                        <span className="inline-flex rounded-full bg-[#FFB800] px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#121212] shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-[13px] font-semibold uppercase tracking-wide text-[#57606A]">{tier.name}</div>
                    <div className="mt-3 text-[3rem] font-bold leading-none tracking-tight text-[#121212]">
                      {tier.amount}
                      <span className="ml-1 text-[1rem] font-medium text-[#57606A]">/ month</span>
                    </div>
                    <div className="mt-3 text-[15px] leading-relaxed text-[#57606A]">{tier.description}</div>
                    <button
                      type="button"
                      onClick={() => navigate(tier.href)}
                      className={
                        tier.featured
                          ? 'mt-6 inline-flex w-full items-center justify-center rounded-[6px] bg-[#FFB800] px-4 py-3 text-[15px] font-semibold text-[#121212] transition-all duration-300 hover:-translate-y-px hover:bg-[#FFA900]'
                          : 'mt-6 inline-flex w-full items-center justify-center rounded-[6px] border border-[#121212] bg-white px-4 py-3 text-[15px] font-semibold text-[#121212] transition-colors duration-300 hover:bg-[#F8F9FA]'
                      }
                    >
                      {tier.cta}
                    </button>
                    <ul className="mt-6 space-y-3 border-t border-[#E5E8ED] pt-6">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[15px] leading-relaxed text-[#57606A]">
                          <span className="mt-[0.1rem]" aria-hidden="true">
                            <ListCheckIcon />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="rounded-[10px] border border-[#E5E8ED] bg-white px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-center md:text-left">
                    <p className="text-[1.25rem] font-semibold text-[#0D1117] tracking-tight">Prefer a one-time donation?</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#57606A]">
                      Make a one-time platform donation of any amount in the same Donate Cash form.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/donate/cash?type=onetime#donate-form')}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] bg-[#121212] px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-300 hover:bg-[#2A2A2A]"
                  >
                    One-Time Donation
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[15px] font-medium text-[#57606A]">
                {['Secure Payment', 'Tax Deductible', 'Cancel Anytime'].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <TrustShieldIcon />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
        <PublicSiteFooter />
      </div>
    </>
  )
}

