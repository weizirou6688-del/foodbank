import { useNavigate } from 'react-router-dom'
import { scrollToElementById, useScrollToHash } from '@/shared/lib/scroll'
import { usePublicImpactMetrics } from '@/shared/lib/usePublicImpactMetrics'
import PublicPageShell from '@/shared/ui/PublicPageShell'

const pageSectionClass = 'mx-auto max-w-[1200px] px-6'
const outlineButtonClass = 'border border-[#121212] bg-white text-[#121212] hover:bg-[#F8F9FA]'
const primaryButtonClass = 'bg-[#FFB800] text-[#121212] hover:-translate-y-px hover:bg-[#FFA900]'
const featureCardClass = 'h-full rounded-[10px] border border-[#E5E5E5] bg-white px-6 py-7'

const workflowSteps = [
  { number: '01', title: 'Search & Locate', description: 'Enter a postcode to find nearby food banks, contact details, and opening information.', paths: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'] },
  { number: '02', title: 'Apply Online', description: 'Choose a location and complete the application or donation form that matches your situation.', paths: ['M9 12h6', 'm9 16h6', 'M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'] },
  { number: '03', title: 'Receive Support', description: 'The local team reviews the request, arranges collection or pickup, and records the outcome in the platform.', paths: ['M5 13l4 4L19 7'] },
] as const

const goodsCategories = [
  { title: 'Non-Perishable Food', items: ['Tinned vegetables & fruit', 'Rice, pasta & cereals', 'Tinned meat & fish', 'UHT milk & plant-based drinks', 'Cooking oil & sauces', 'Tea, coffee & long-life juice'] },
  { title: 'Hygiene Essentials', items: ['Shampoo & conditioner', 'Soap & body wash', 'Toothpaste & toothbrushes', 'Deodorant', 'Sanitary pads & tampons', 'Shaving foam & razors'] },
  { title: 'Baby & Child Care', items: ['Baby formula & baby food', 'Nappies & wet wipes', "Children's snacks & cereals", 'Baby toiletries', "Children's books & toys"] },
  { title: 'Household Items', items: ['Toilet roll & kitchen roll', 'Laundry detergent', 'Surface cleaner & disinfectant', 'Dishwashing liquid', 'Bin bags'] },
] as const

const goodsBannerBenefits = [
  'Search for a nearby food bank',
  'Send donation details to the selected team',
  'Arrange collection or drop-off locally',
  'Keep stock records aligned across the network',
] as const

const uniqueCards = [
  { title: 'Staples and Essentials', description: 'Food and household basics are grouped so local teams can respond quickly to common requests.', image: '/home-gallery/photo-1701914446310-8b63a547ab37' },
  { title: 'Less Waste', description: 'Clear reporting helps teams request what they need and move surplus stock across participating food banks before it sits unused.', image: '/home-gallery/photo-1603418735094-800d47a56ea1' },
  { title: 'Local Coordination', description: 'Food banks can compare stock, requests, and local demand across the wider network.', image: '/home-gallery/photo-1588822534638-028d5ddc07ac' },
  { title: 'Volunteer Support', description: 'Volunteers help sort, pack, and move donations so fewer requests are delayed.', image: '/home-gallery/photo-1758599668178-d9716bbda9d5' },
] as const

type DonationTier = {
  name: string
  amount: string
  description: string
  cta: string
  href: string
  features: string[]
  featured?: boolean
}

const donationTiers: DonationTier[] = [
  { name: 'Supporter', amount: '\u00A35', description: 'Helps cover a small urgent purchase or local transport cost', cta: 'Give \u00A35 Monthly', href: '/donate/cash?type=monthly&amount=5#donate-form', features: ['Email receipt', 'Monthly summary updates', 'Secure online payment'] },
  { name: 'Champion', amount: '\u00A315', description: 'Supports recurring gaps in food and household essentials', cta: 'Give \u00A315 Monthly', href: '/donate/cash?type=monthly&amount=15#donate-form', features: ['Email receipt', 'Monthly summary updates', 'Supports recurring essential purchases', 'Secure online payment'], featured: true },
  { name: 'Hero', amount: '\u00A330', description: 'Contributes to urgent purchases, transport, and coordination across participating food banks', cta: 'Give \u00A330 Monthly', href: '/donate/cash?type=monthly&amount=30#donate-form', features: ['Email receipt', 'Monthly summary updates', 'Supports network logistics and urgent purchasing', 'Secure online payment'] },
] as const

const trustItems = ['Secure Payment', 'Tax Deductible', 'Cancel Anytime'] as const

function TrendIcon({ positive = true }: { positive?: boolean }) {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={positive ? 'M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z' : 'M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 12.586V5a1 1 0 112 0v7.586l2.293-2.293a1 1 0 011.414 0z'}
      />
    </svg>
  )
}

function CheckIcon({ className = 'h-3.5 w-3.5 text-[#059669]' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BannerCheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#FFB800] text-[#121212]">
      <CheckIcon className="h-3 w-3 text-current" />
    </span>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-[#4CAF50]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
    </svg>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto mb-16 max-w-[640px] text-center">
      <h2 className="mb-4 text-[2.5rem] font-bold tracking-tight text-[#0D1117]">{title}</h2>
      {description ? <p className="text-[18px] leading-relaxed text-[#57606A]">{description}</p> : null}
    </div>
  )
}

function StepCard({ number, title, description, paths }: (typeof workflowSteps)[number]) {
  return (
    <div className="text-center">
      <div className="relative mb-6 inline-flex items-center justify-center">
        <div className="relative">
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-[#FFB800]/20 bg-[#FFF9E6] text-[#FFB800]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              {paths.map((path) => <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />)}
            </svg>
          </div>
          <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFB800] shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
            <span className="text-[14px] font-bold text-[#0D1117]">{number}</span>
          </div>
        </div>
      </div>
      <h3 className="mb-3 text-[1.5rem] font-semibold tracking-tight text-[#0D1117]">{title}</h3>
      <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-[#57606A]">{description}</p>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { impactMetrics } = usePublicImpactMetrics()

  useScrollToHash()

  const scrollTo = (id: string) => scrollToElementById(id)
  const heroActions = [
    { label: 'Find a Food Bank', onClick: () => navigate('/find-foodbank'), className: primaryButtonClass },
    { label: 'Donate Goods', onClick: () => scrollTo('donate-goods'), className: outlineButtonClass },
    { label: 'Donate Cash', onClick: () => scrollTo('donate-cash'), className: outlineButtonClass },
  ]

  return (
    <PublicPageShell>
      <div className="border-b border-[#E5E8ED] bg-white">
        <div className={`${pageSectionClass} py-20 md:py-32`}>
          <div className="grid items-center gap-12 md:grid-cols-12">
            <div className="md:col-span-7">
              <h1 className="mb-6 text-[3.5rem] font-bold leading-[1.1] tracking-tight text-[#0D1117] md:text-[4rem]">
                Find support. <span className="text-[#FFB800]">Coordinate donations.</span>
              </h1>
              <p className="mb-8 max-w-[560px] text-[1.25rem] leading-relaxed text-[#57606A]">
                Search local food banks, submit donation details, and manage food bank stock across the network from one place.
              </p>
              <div className="grid max-w-[360px] grid-cols-1 gap-4 md:grid-cols-2">
                {heroActions.map((action, index) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-[6px] px-4 py-[0.85rem] text-center text-[0.95rem] font-semibold transition-all duration-300 ${action.className} ${index === 0 ? 'md:col-span-2' : ''}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-5">
              <div className="overflow-hidden rounded-[8px] border border-[#E5E8ED] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <div className="relative h-[420px]">
                  <img src="/home-gallery/photo-1710092784814-4a6f158913b8" alt="Food bank operations" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="impact" className="bg-[#F8F9FA]">
        <div className={`${pageSectionClass} py-24`}>
          <SectionHeading title="Current network totals" description="These figures combine reporting from participating food banks and platform services." />
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {impactMetrics.map((metric) => (
              <div key={metric.label} className="rounded-[10px] bg-white px-6 py-7 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className={`mb-4 inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[0.8rem] font-semibold ${metric.positive === false ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#ECFDF5] text-[#059669]'}`}>
                  <TrendIcon positive={metric.positive} />
                  {metric.change}
                </div>
                <div className="mb-1 text-[2rem] font-bold tracking-[-0.02em] text-[#121212]">{metric.value}</div>
                <div className="mb-1 text-[1rem] font-semibold text-[#121212]">{metric.label}</div>
                <div className="text-[0.85rem] text-[#4B4B4B]">{metric.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-[0.75rem] text-[#4B4B4B]">Uses current reporting when available and refreshes automatically.</div>
        </div>
      </div>

      <div id="how-it-works" className="bg-white">
        <div className={`${pageSectionClass} py-40`}>
          <SectionHeading title="How it works" description="Search for a nearby location, review what it offers, and follow the next step online." />
          <div className="relative">
            <div className="absolute left-[calc(16.66%)] right-[calc(16.66%)] top-[60px] hidden h-[2px] bg-[#E5E8ED] md:block">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFB800] to-transparent opacity-20" />
            </div>
            <div className="relative grid gap-12 md:grid-cols-3">
              {workflowSteps.map((step) => <StepCard key={step.number} {...step} />)}
            </div>
          </div>
        </div>
      </div>

      <div id="about" className="bg-[#F6F8FA]">
        <div className={`${pageSectionClass} py-32`}>
          <SectionHeading title="How the network helps" />
          <div className="grid gap-8 md:grid-cols-4">
            {uniqueCards.map((card) => (
              <div key={card.title} className="group">
                <div className="relative mb-6 overflow-hidden rounded-[8px] border border-[#E5E8ED] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                  <div className="relative h-[240px] overflow-hidden">
                    <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                </div>
                <h3 className="mb-3 text-[1.25rem] font-bold tracking-tight text-[#0D1117]">{card.title}</h3>
                <p className="text-[15px] leading-relaxed text-[#57606A]">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="donate-goods" className="bg-white">
        <div className={`${pageSectionClass} py-32`}>
          <SectionHeading title="Donate Goods" description="Choose a nearby food bank and send donation details before drop-off or collection. The local team can then follow up with the next step." />
          <div className="mb-10 grid grid-cols-1 gap-5 min-[576px]:grid-cols-2 min-[992px]:grid-cols-4">
            {goodsCategories.map((category) => (
              <div key={category.title} className={featureCardClass}>
                <h3 className="mb-3 text-[1.25rem] font-semibold tracking-tight text-[#0D1117]">{category.title}</h3>
                <ul className="list-none text-[15px] leading-relaxed text-[#57606A]">
                  {category.items.map((item) => (
                    <li key={item} className="relative mb-[0.35rem] pl-4 last:mb-0">
                      <span className="absolute left-0 top-[0.1rem]" aria-hidden="true"><CheckIcon /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 rounded-[10px] bg-[#FFF3CD] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="mb-3 text-[1.25rem] font-semibold tracking-tight text-[#0D1117]">Donate Through a Local Food Bank</h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 min-[576px]:grid-cols-2">
                {goodsBannerBenefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-[15px] text-[#57606A]">
                    <BannerCheckIcon />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => navigate('/donate/goods')} className={`inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] px-5 py-[0.55rem] text-center text-[0.85rem] font-semibold transition-all duration-300 ${primaryButtonClass}`}>
              Open Donation Form
            </button>
          </div>
        </div>
      </div>

      <div id="donate-cash" className="bg-[#F6F8FA]">
        <div className={`${pageSectionClass} py-32`}>
          <SectionHeading title="Support urgent purchases and food bank operations" description="Cash donations help cover urgent purchases, transport, and coordination across participating food banks where local supply is short." />
          <div className="mb-10 grid gap-6 md:grid-cols-3">
            {donationTiers.map((tier) => (
              <div key={tier.name} className={tier.featured ? 'relative rounded-[10px] border-2 border-[#FFB800] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(255,184,0,0.15)]' : 'relative rounded-[10px] border border-[#E5E5E5] bg-white px-6 py-8'}>
                {tier.featured ? (
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex rounded-full bg-[#FFB800] px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#121212] shadow-[0_4px_12px_rgba(255,184,0,0.3)]">
                      Most Popular
                    </span>
                  </div>
                ) : null}
                <div className="text-[13px] font-semibold uppercase tracking-wide text-[#57606A]">{tier.name}</div>
                <div className="mt-3 text-[3rem] font-bold leading-none tracking-tight text-[#121212]">
                  {tier.amount}
                  <span className="ml-1 text-[1rem] font-medium text-[#57606A]">/ month</span>
                </div>
                <div className="mt-3 text-[15px] leading-relaxed text-[#57606A]">{tier.description}</div>
                <button type="button" onClick={() => navigate(tier.href)} className={`mt-6 inline-flex w-full items-center justify-center rounded-[6px] px-4 py-3 text-[15px] font-semibold transition-all duration-300 ${tier.featured ? primaryButtonClass : outlineButtonClass}`}>
                  {tier.cta}
                </button>
                <ul className="mt-6 space-y-3 border-t border-[#E5E8ED] pt-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[15px] leading-relaxed text-[#57606A]">
                      <span className="mt-[0.1rem]" aria-hidden="true"><CheckIcon /></span>
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
                <p className="text-[1.25rem] font-semibold tracking-tight text-[#0D1117]">Prefer a one-off donation?</p>
                <p className="mt-1 text-[15px] leading-relaxed text-[#57606A]">Use the same form to make a single contribution of any amount.</p>
              </div>
              <button type="button" onClick={() => navigate('/donate/cash?type=onetime#donate-form')} className="inline-flex items-center justify-center whitespace-nowrap rounded-[6px] bg-[#121212] px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-300 hover:bg-[#2A2A2A]">
                One-Time Donation
              </button>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[15px] font-medium text-[#57606A]">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <ShieldIcon />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicPageShell>
  )
}
