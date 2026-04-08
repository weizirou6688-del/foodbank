import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  MapPin,
  Package,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { donationsAPI, statsAPI, type PublicImpactMetric } from '@/shared/lib/api'
import { isValidEmail } from '@/shared/lib/validation'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { getNearbyFoodbanks } from '@/utils/foodbankApi'
import { ImageWithFallback } from './components/figma/ImageWithFallback'
import styles from './DonateGoods.module.css'

type FeatureCardProps = {
  icon: ReactNode
  title: string
  description: string
  image?: string
}

type ImpactCardProps = {
  number: string
  label: string
  trend?: string
}

type FoodBankOption = {
  id: string
  foodBankId?: number | null
  name: string
  address: string
  postcode: string
  distance: string
  distanceMiles: number
}

type DonationDetails = {
  name: string
  email: string
  phone: string
  pickupDate: string
  items: string
  condition: string
  quantity: string
  notes: string
}

const STEP_FEATURES = [
  {
    icon: <Package className={styles.featureIcon} />,
    title: '1. Choose Items',
    description: 'Select gently used items you no longer need',
  },
  {
    icon: <Heart className={styles.featureIcon} />,
    title: '2. Fill Form',
    description: 'Tell us about your donation request through our simple form',
  },
  {
    icon: <Users className={styles.featureIcon} />,
    title: '3. Local Team Follows Up',
    description: 'The selected food bank reviews your request and contacts you directly',
  },
  {
    icon: <TrendingUp className={styles.featureIcon} />,
    title: '4. Complete The Donation',
    description: 'Arrange pickup or drop-off with the local food bank team',
  },
]

const FEATURE_STORIES = [
  {
    icon: <Package className={styles.featureImageIcon} />,
    title: 'Coordinated Local Collection',
    description:
      'The platform records your request and passes it to the selected food bank so their local team can review what is needed and arrange the next step with you.',
    image:
      'https://images.unsplash.com/photo-1765744893064-dce3184289ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBib3hlcyUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NzQ5MzU0OTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    icon: <Heart className={styles.featureImageIcon} />,
    title: 'Community Support',
    description:
      "Join a wider network of donors supporting local food banks. Together, we're helping communities respond with the right goods in the right place.",
    image:
      'https://images.unsplash.com/photo-1617080090911-91409e3496ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBzdXBwb3J0JTIwaGFuZHN8ZW58MXx8fHwxNzc0OTM1NDk1fDA&ixlib=rb-4.1.0&q=80&w=1080',
  },
]

const INITIAL_IMPACT_STATS: ImpactCardProps[] = [
  { number: '--', label: 'Items Donated This Month' },
  { number: '--', label: 'Families Helped' },
  { number: '--', label: 'Partner Organizations' },
]

function mapImpactStats(metrics: PublicImpactMetric[]): ImpactCardProps[] {
  const metricsByKey = new Map(metrics.map((metric) => [metric.key, metric]))

  return [
    {
      number: metricsByKey.get('goods_units_current_period')?.value ?? '--',
      label: metricsByKey.get('goods_units_current_period')?.label ?? INITIAL_IMPACT_STATS[0].label,
      trend: metricsByKey.get('goods_units_current_period')?.change || undefined,
    },
    {
      number: metricsByKey.get('families_supported')?.value ?? '--',
      label: metricsByKey.get('families_supported')?.label ?? INITIAL_IMPACT_STATS[1].label,
      trend: metricsByKey.get('families_supported')?.change || undefined,
    },
    {
      number: metricsByKey.get('partner_organizations')?.value ?? '--',
      label: metricsByKey.get('partner_organizations')?.label ?? INITIAL_IMPACT_STATS[2].label,
    },
  ]
}

const ACCEPTED_ITEMS = [
  {
    category: 'Non-Perishable Food',
    items: [
      'Canned proteins: tuna, chicken, salmon, corned beef, spam',
      'Canned vegetables: tomatoes, carrots, peas, sweetcorn, mixed vegetables',
      'Canned fruit: peaches, pears, pineapple, fruit cocktail in juice',
      'Pantry staples: pasta, rice, noodles, pasta sauce, cooking sauce',
      'Breakfast foods: cereal, oatmeal, porridge oats, granola bars',
    ],
  },
  {
    category: 'Personal Care & Hygiene',
    items: [
      'Toiletries: shampoo, conditioner, body wash, hand soap, deodorant',
      'Oral care: toothbrushes, toothpaste',
      'Shaving: razors, shaving foam or gel',
      'Feminine hygiene: sanitary pads, tampons',
      'Baby care: nappies, baby wipes, baby food when unopened',
    ],
  },
  {
    category: 'Household & Cleaning',
    items: [
      'Cleaning supplies: washing powder, washing-up liquid, household cleaner',
      'Kitchen essentials: dish soap, sponges, bin bags',
      'Laundry items: fabric softener, stain remover, laundry detergent',
      'Paper products: toilet paper, tissues, paper towels',
      'Air care: air fresheners, disinfectant spray',
    ],
  },
]

const REJECTED_ITEMS = [
  'Homemade foods',
  'Opened or damaged packages',
  'Dented or bulging cans',
  'Expired items',
  'Perishable foods requiring refrigeration',
  'Glass jars where possible',
]

const INITIAL_DETAILS: DonationDetails = {
  name: '',
  email: '',
  phone: '',
  pickupDate: '',
  items: '',
  condition: '',
  quantity: '',
  notes: '',
}

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
const LOCAL_SEARCH_RADIUS_KM = 5

function normalizePostcodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 8)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function buildFoodBankDisplayAddress(address: string, postcode: string) {
  const normalizedAddress = normalizeWhitespace(address)
  const normalizedPostcode = normalizeWhitespace(postcode).toUpperCase()

  if (!normalizedAddress) {
    return normalizedPostcode
  }

  if (!normalizedPostcode) {
    return normalizedAddress
  }

  const postcodePattern = new RegExp(
    escapeRegExp(normalizedPostcode).replace(/\s+/g, '\\s*'),
    'gi',
  )

  const addressWithoutPostcode = normalizedAddress
    .replace(postcodePattern, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '')

  return addressWithoutPostcode ? `${addressWithoutPostcode}, ${normalizedPostcode}` : normalizedPostcode
}

function sanitizePickupDateInput(value: string) {
  return value.replace(/[^\d/-]/g, '').slice(0, 10)
}

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function formatUkDate(date: Date) {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear().toString().padStart(4, '0')
  return `${day}/${month}/${year}`
}

function parsePickupDate(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  let day: number
  let month: number
  let year: number

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmedValue)) {
    ;[year, month, day] = trimmedValue.split('-').map(Number)
  } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmedValue)) {
    const normalizedValue = trimmedValue.replace(/-/g, '/')
    ;[day, month, year] = normalizedValue.split('/').map(Number)
  } else if (/^\d{8}$/.test(trimmedValue)) {
    day = Number(trimmedValue.slice(0, 2))
    month = Number(trimmedValue.slice(2, 4))
    year = Number(trimmedValue.slice(4))
  } else {
    return null
  }

  const parsedDate = new Date(year, month - 1, day)

  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return null
  }

  return {
    date: parsedDate,
    isoDate: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    ukDate: formatUkDate(parsedDate),
  }
}

function getStartOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function getPickupDateError(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return 'Preferred collection or drop-off date is required.'
  }

  const parsedPickupDate = parsePickupDate(trimmedValue)
  if (!parsedPickupDate) {
    return 'Please enter a valid date in DD/MM/YYYY format.'
  }

  if (parsedPickupDate.date < getStartOfToday()) {
    return 'Please enter a valid date on or after today.'
  }

  return ''
}

function getPhoneError(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) {
    return 'Phone number is required and must contain 11 digits.'
  }

  if (digitsOnly.length !== 11) {
    return 'Phone number must be exactly 11 digits.'
  }

  return ''
}

function FeatureCard({ icon, title, description, image }: FeatureCardProps) {
  if (image) {
    return (
      <article className={styles.featureImageCard}>
        <ImageWithFallback src={image} alt={title} className={styles.featureImage} />
        <div className={styles.featureImageOverlay}>
          <div className={styles.featureImageContent}>
            <div className={styles.featureImageIconWrap}>{icon}</div>
            <h3 className={styles.featureImageTitle}>{title}</h3>
            <p className={styles.featureImageText}>{description}</p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.featureCard}>
      <div className={styles.featureCardIconWrap}>{icon}</div>
      <h3 className={styles.featureCardTitle}>{title}</h3>
      <p className={styles.featureCardText}>{description}</p>
    </article>
  )
}

function ImpactCard({ number, label, trend }: ImpactCardProps) {
  return (
    <article className={styles.impactCard}>
      <div className={styles.impactCardTop}>
        <div className={styles.impactNumber}>{number}</div>
        {trend ? (
          <div className={styles.impactTrend}>
            <TrendingUp size={20} />
            <span>{trend}</span>
          </div>
        ) : null}
      </div>
      <p className={styles.impactLabel}>{label}</p>
    </article>
  )
}

function estimateQuantity(value: string) {
  const numbers = value.match(/\d+/g)
  if (!numbers) return 1
  const total = numbers.reduce((sum, current) => sum + Number(current), 0)
  return total > 0 ? total : 1
}

function formatDistanceMiles(distanceKm: number) {
  const distanceMiles = distanceKm * 0.621371
  return `${distanceMiles.toFixed(1)} miles`
}

export default function DonateGoods() {
  const [impactStats, setImpactStats] = useState<ImpactCardProps[]>(INITIAL_IMPACT_STATS)
  const [impactStatsStatus, setImpactStatsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [step, setStep] = useState(1)
  const [postcode, setPostcode] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [searchResults, setSearchResults] = useState<FoodBankOption[]>([])
  const [selectedBank, setSelectedBank] = useState<FoodBankOption | null>(null)
  const [details, setDetails] = useState<DonationDetails>(INITIAL_DETAILS)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    statsAPI
      .getPublicGoodsImpact('month')
      .then((response) => {
        if (!active) {
          return
        }

        if (!Array.isArray(response.impactMetrics) || response.impactMetrics.length === 0) {
          setImpactStatsStatus('error')
          return
        }

        setImpactStats(mapImpactStats(response.impactMetrics))
        setImpactStatsStatus('ready')
      })
      .catch(() => {
        if (!active) {
          return
        }

        setImpactStats(INITIAL_IMPACT_STATS)
        setImpactStatsStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitFeedback(null)
    setSearchFeedback(null)

    const normalizedPostcode = normalizeWhitespace(postcode).toUpperCase()

    if (!UK_POSTCODE_PATTERN.test(normalizedPostcode)) {
      setPostcodeError('Please enter a valid postcode, for example SY23 3AN.')
      return
    }

    setPostcodeError('')
    setPostcode(normalizedPostcode)
    setSelectedBank(null)
    setSearching(true)

    try {
      const rankedResults = (await getNearbyFoodbanks(normalizedPostcode))
        .map((bank) => {
          return {
            id: `${bank.name}-${bank.postcode}-${bank.lat}-${bank.lng}`,
            name: bank.name,
            address: buildFoodBankDisplayAddress(bank.address, bank.postcode),
            postcode: bank.postcode,
            distance: formatDistanceMiles(bank.distance),
            distanceMiles: bank.distance * 0.621371,
          } satisfies FoodBankOption
        })
        .sort((left, right) => left.distanceMiles - right.distanceMiles)

      setSearchResults(rankedResults)
      setSearchFeedback(
        rankedResults.length === 0
          ? `We could not find any food banks within ${LOCAL_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`
          : `Showing food banks within ${LOCAL_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`,
      )
      setStep(2)
    } catch (error) {
      setSearchResults([])
      setStep(1)
      setPostcodeError(
        error instanceof Error
          ? error.message
          : 'Unable to look up nearby foodbanks right now. Please try again.',
      )
    } finally {
      setSearching(false)
    }
  }

  const handleSelectBank = (bank: FoodBankOption) => {
    setSelectedBank(bank)
    setStep(3)
  }

  const normalizePickupDateField = () => {
    const parsedPickupDate = parsePickupDate(details.pickupDate)
    if (parsedPickupDate && details.pickupDate !== parsedPickupDate.ukDate) {
      updateDetails('pickupDate', parsedPickupDate.ukDate)
    }
  }

  const updateDetails = (field: keyof DonationDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      const nextErrors = { ...current }

      if (field === 'pickupDate') {
        const pickupDateError = getPickupDateError(value)
        if (pickupDateError) {
          nextErrors[field] = pickupDateError
        } else {
          delete nextErrors[field]
        }
        return nextErrors
      }

      if (field === 'phone') {
        const phoneError = getPhoneError(value)
        if (phoneError) {
          nextErrors[field] = phoneError
        } else {
          delete nextErrors[field]
        }
        return nextErrors
      }

      if (!current[field]) {
        return current
      }

      delete nextErrors[field]
      return nextErrors
    })
  }

  const validateDetails = () => {
    const nextErrors: Record<string, string> = {}

    if (!details.name.trim()) {
      nextErrors.name = 'Full name is required.'
    }
    if (!isValidEmail(details.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    const phoneError = getPhoneError(details.phone)
    if (phoneError) {
      nextErrors.phone = phoneError
    }
    const pickupDateError = getPickupDateError(details.pickupDate)
    if (pickupDateError) {
      nextErrors.pickupDate = pickupDateError
    }
    if (!details.items.trim()) {
      nextErrors.items = 'Please describe the items you are donating.'
    }
    if (!details.condition) {
      nextErrors.condition = 'Please select the item condition.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmitDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitFeedback(null)

    if (!selectedBank) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please choose a food bank before submitting your donation details.',
      })
      return
    }

    if (!validateDetails()) return

    const parsedPickupDate = parsePickupDate(details.pickupDate)
    if (!parsedPickupDate) {
      setFieldErrors((current) => ({
        ...current,
        pickupDate: 'Please enter a valid date in DD/MM/YYYY format.',
      }))
      return
    }

    setSubmitting(true)
    try {
      await donationsAPI.donateGoods({
        food_bank_id: selectedBank.foodBankId ?? undefined,
        food_bank_name: selectedBank.name,
        food_bank_address: selectedBank.address,
        donor_name: details.name.trim(),
        donor_email: details.email.trim(),
        donor_phone: details.phone.trim(),
        postcode: postcode.trim().toUpperCase(),
        pickup_date: parsedPickupDate.ukDate,
        item_condition: details.condition,
        estimated_quantity: details.quantity.trim() || undefined,
        notes: details.notes.trim() || undefined,
        items: [
          {
            item_name: details.items.trim(),
            quantity: estimateQuantity(details.quantity),
          },
        ],
      })

      setFieldErrors({})
      setDetails(INITIAL_DETAILS)
      setSubmitFeedback({
        type: 'success',
        message: `Thanks, ${details.name.trim()}. Your donation request has been sent to ${selectedBank.name}. Their team will contact you at ${details.email.trim()} to arrange collection or drop-off.`,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (/11 digits/i.test(error.message)) {
          setFieldErrors((current) => ({
            ...current,
            phone: 'Phone number must be exactly 11 digits.',
          }))
          return
        }

        if (
          /pickup date on or after today/i.test(error.message)
          || /valid date/i.test(error.message)
        ) {
          setFieldErrors((current) => ({
            ...current,
            pickupDate:
              getPickupDateError(details.pickupDate) || 'Please enter a valid date on or after today.',
          }))
          return
        }
      }

      setSubmitFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to submit your donation right now. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PrimaryNavbar variant="public" />

      <div className={styles.page}>
        <main>
          <section id="home" className={styles.heroSection}>
            <div className={styles.shell}>
              <div className={styles.heroInner}>
                <h1 className={styles.heroTitle}>Your Unwanted Goods, Their Utilities</h1>
                <p className={styles.heroText}>
                  Choose a food bank near you and submit a goods donation request to their local
                  team. We record the request through the platform and help coordinate the handover.
                </p>

                <div className={styles.heroBenefits}>
                  <div className={styles.heroBenefit}>
                    <Check className={styles.checkIcon} />
                    <span>Find and choose a nearby food bank</span>
                  </div>
                  <div className={styles.heroBenefit}>
                    <Check className={styles.checkIcon} />
                    <span>Your request is sent to the selected team</span>
                  </div>
                  <div className={styles.heroBenefit}>
                    <Check className={styles.checkIcon} />
                    <span>Pickup or drop-off is arranged locally</span>
                  </div>
                </div>

                <div className={styles.heroImageCard}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1738618141234-1ee52c6475a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBjYW5uZWQlMjBnb29kc3xlbnwxfHx8fDE3NzQ5Mzc1MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Food bank shelves with donations"
                    className={styles.heroImage}
                  />
                  <div className={styles.heroImageOverlay}>
                    <p className={styles.heroQuote}>
                      Every item donated is a step towards building a stronger, more caring community.
                    </p>
                  </div>
                </div>

                <button type="button" onClick={() => scrollToSection('donate')} className={styles.heroCta}>
                  Donate Goods
                </button>
              </div>
            </div>
          </section>

        <section id="how-it-works" className={styles.surfaceSection}>
          <div className={styles.shell}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Simple Steps to <span className={styles.highlight}>Give Back</span>
              </h2>
            </div>

            <div className={styles.featureGrid}>
              {STEP_FEATURES.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>

            <div className={styles.featureStoryGrid}>
              {FEATURE_STORIES.map((story) => (
                <FeatureCard
                  key={story.title}
                  icon={story.icon}
                  title={story.title}
                  description={story.description}
                  image={story.image}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="impact" className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Making a <span className={styles.highlight}>Difference</span> Together
              </h2>
              <p className={styles.sectionText}>
                {impactStatsStatus === 'error'
                  ? 'Live impact data is temporarily unavailable. Please try again shortly.'
                  : impactStatsStatus === 'loading'
                    ? 'Loading live impact data from the dashboard.'
                    : 'These figures reflect goods support coordinated across our wider food bank network.'}
              </p>
            </div>

            <div className={styles.impactGrid}>
              {impactStats.map((stat) => (
                <ImpactCard key={stat.label} number={stat.number} label={stat.label} trend={stat.trend} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.surfaceSection}>
          <div className={styles.shell}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Items We <span className={styles.highlight}>Gladly Accept</span>
              </h2>
              <p className={styles.sectionText}>
                All items must be unopened, in original packaging, and within their best-before
                dates
              </p>
            </div>

            <div className={styles.acceptedGrid}>
              {ACCEPTED_ITEMS.map((group) => (
                <article key={group.category} className={styles.acceptedCard}>
                  <h3 className={styles.acceptedCardTitle}>{group.category}</h3>
                  <ul className={styles.acceptedList}>
                    {group.items.map((item) => (
                      <li key={item} className={styles.acceptedListItem}>
                        <Check className={styles.acceptedListIcon} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className={styles.noticeCardPrimary}>
              <Check className={styles.noticeIconSuccess} />
              <div>
                <p className={styles.noticeText}>
                  <strong>Please note:</strong> All items must be unopened, in their original
                  packaging, and within their best-before or use-by dates.
                </p>
              </div>
            </div>

            <div className={styles.noticeCardNeutral}>
              <X className={styles.noticeIconDanger} />
              <div>
                <p className={styles.noticeTitle}>
                  <strong>We cannot accept:</strong>
                </p>
                <ul className={styles.rejectedList}>
                  {REJECTED_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="donate" className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Ready to <span className={styles.highlight}>Make a Difference?</span>
              </h2>
              <p className={styles.sectionText}>
                Follow these steps to submit your request to the food bank you want to support
              </p>
            </div>

            <div className={styles.flowShell}>
              <div className={styles.progressHeader}>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressDot} ${step >= 1 ? styles.progressDotActive : ''}`}
                  >
                    1
                  </div>
                  <div
                    className={`${styles.progressLine} ${step >= 2 ? styles.progressLineActive : ''}`}
                  />
                  <div
                    className={`${styles.progressDot} ${step >= 2 ? styles.progressDotActive : ''}`}
                  >
                    2
                  </div>
                  <div
                    className={`${styles.progressLine} ${step >= 3 ? styles.progressLineActive : ''}`}
                  />
                  <div
                    className={`${styles.progressDot} ${step >= 3 ? styles.progressDotActive : ''}`}
                  >
                    3
                  </div>
                </div>
                <div className={styles.progressLabels}>
                  <span className={step >= 1 ? styles.progressLabelActive : ''}>Search Location</span>
                  <span className={step >= 2 ? styles.progressLabelActive : ''}>Select Food Bank</span>
                  <span className={step >= 3 ? styles.progressLabelActive : ''}>Donation Details</span>
                </div>
              </div>

              {step === 1 ? (
                <div className={styles.flowCard}>
                  <div className={styles.flowCardHeader}>
                    <h3 className={styles.flowTitle}>
                      Find a <span className={styles.highlight}>Food Bank</span> Near You
                    </h3>
                    <p className={styles.flowText}>
                      Enter your postcode to search for food banks within 5 km
                    </p>
                  </div>

                  <form onSubmit={handleSearch}>
                    <div className={styles.searchRow}>
                      <div className={styles.searchInputWrap}>
                        <Search className={styles.searchIcon} size={20} />
                        <input
                          type="text"
                          placeholder="Enter Postcode"
                          value={postcode}
                          onChange={(event) => {
                            setPostcode(normalizePostcodeInput(event.target.value))
                            setPostcodeError('')
                            setSearchFeedback(null)
                          }}
                          maxLength={8}
                          className={styles.searchInput}
                        />
                      </div>
                      <button type="submit" className={styles.primaryActionButton} disabled={searching}>
                        {searching ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {postcodeError ? <p className={styles.fieldError}>{postcodeError}</p> : null}
                  </form>
                </div>
              ) : null}

              {step === 2 ? (
                <div className={styles.flowStepStack}>
                  <button type="button" onClick={() => setStep(1)} className={styles.ghostActionButton}>
                    Change Location
                  </button>

                    <div className={styles.flowCard}>
                      <div className={styles.flowCardHeaderLeft}>
                        <h3 className={styles.flowTitle}>
                        Select a <span className={styles.highlight}>Food Bank</span>
                        </h3>
                      </div>

                      {searchFeedback && searchResults.length > 0 ? (
                        <p className={styles.flowTextLeft}>{searchFeedback}</p>
                      ) : null}

                      <div className={styles.bankList}>
                        {searchResults.length === 0 ? (
                        <p className={styles.flowTextLeft}>
                          {searchFeedback ?? 'Try another postcode to load nearby foodbanks.'}
                        </p>
                      ) : (
                        searchResults.map((bank) => (
                          <button
                            key={bank.id}
                            type="button"
                            className={styles.bankCard}
                            onClick={() => handleSelectBank(bank)}
                          >
                            <div className={styles.bankCardTop}>
                              <div>
                                <h4 className={styles.bankName}>{bank.name}</h4>
                                <div className={styles.bankAddress}>
                                  <MapPin size={16} />
                                  <span>{bank.address}</span>
                                </div>
                                <span className={styles.bankDistance}>{bank.distance} away</span>
                              </div>
                              <ChevronRight className={styles.bankArrow} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 && selectedBank ? (
                <div className={styles.flowStepStack}>
                  <button type="button" onClick={() => setStep(2)} className={styles.ghostActionButton}>
                    Choose Different Food Bank
                  </button>

                  <div className={styles.selectedBankCard}>
                    <div className={styles.selectedBankHeader}>
                      <div className={styles.selectedBankBadge}>
                        <Check size={22} />
                      </div>
                      <div>
                        <p className={styles.selectedBankLabel}>Donating to:</p>
                        <h3 className={styles.selectedBankName}>{selectedBank.name}</h3>
                        <p className={styles.selectedBankAddress}>{selectedBank.address}</p>
                        <p className={styles.flowTextLeft}>
                          Your donation request will be sent to this food bank. Their team will
                          contact you to arrange collection or drop-off.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitDonation} className={styles.flowCard}>
                    <div className={styles.flowCardHeaderCentered}>
                      <h3 className={styles.flowTitle}>
                        Your <span className={styles.highlight}>Donation Details</span>
                      </h3>
                      <p className={styles.flowTextLeft}>
                        Please provide the details the selected food bank team will need to follow up
                      </p>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formField}>
                        <label htmlFor="donor-name" className={styles.formLabel}>
                          Full Name *
                        </label>
                        <input
                          id="donor-name"
                          type="text"
                          value={details.name}
                          onChange={(event) => updateDetails('name', event.target.value)}
                          className={styles.formInput}
                        />
                        {fieldErrors.name ? <p className={styles.fieldError}>{fieldErrors.name}</p> : null}
                      </div>

                      <div className={styles.formField}>
                        <label htmlFor="donor-email" className={styles.formLabel}>
                          Email Address *
                        </label>
                        <input
                          id="donor-email"
                          type="email"
                          value={details.email}
                          onChange={(event) => updateDetails('email', event.target.value)}
                          className={styles.formInput}
                        />
                        {fieldErrors.email ? <p className={styles.fieldError}>{fieldErrors.email}</p> : null}
                      </div>

                      <div className={styles.formField}>
                        <label htmlFor="donor-phone" className={styles.formLabel}>
                          Phone Number *
                        </label>
                        <input
                          id="donor-phone"
                          type="tel"
                          value={details.phone}
                          onChange={(event) => updateDetails('phone', sanitizePhoneInput(event.target.value))}
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="07123456789"
                          className={styles.formInput}
                        />
                        {fieldErrors.phone ? <p className={styles.fieldError}>{fieldErrors.phone}</p> : null}
                      </div>

                      <div className={styles.formField}>
                        <label htmlFor="pickup-date" className={styles.formLabel}>
                          Preferred Collection or Drop-off Date *
                        </label>
                        <input
                          id="pickup-date"
                          type="text"
                          value={details.pickupDate}
                          onChange={(event) => updateDetails('pickupDate', sanitizePickupDateInput(event.target.value))}
                          onBlur={normalizePickupDateField}
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="DD/MM/YYYY"
                          className={styles.formInput}
                        />
                        {fieldErrors.pickupDate ? (
                          <p className={styles.fieldError}>{fieldErrors.pickupDate}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className={styles.formField}>
                      <label htmlFor="donation-items" className={styles.formLabel}>
                        What are you donating? *
                      </label>
                      <textarea
                        id="donation-items"
                        value={details.items}
                        onChange={(event) => updateDetails('items', event.target.value)}
                        placeholder="Please describe the items you'd like to donate, for example canned vegetables, pasta, cereal, shampoo, or nappies."
                        className={styles.formTextarea}
                      />
                      {fieldErrors.items ? <p className={styles.fieldError}>{fieldErrors.items}</p> : null}
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formField}>
                        <label htmlFor="item-condition" className={styles.formLabel}>
                          Item Condition *
                        </label>
                        <select
                          id="item-condition"
                          value={details.condition}
                          onChange={(event) => updateDetails('condition', event.target.value)}
                          className={styles.formSelect}
                        >
                          <option value="">Select condition</option>
                          <option value="New or unopened">New or unopened</option>
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                        </select>
                        {fieldErrors.condition ? (
                          <p className={styles.fieldError}>{fieldErrors.condition}</p>
                        ) : null}
                      </div>

                      <div className={styles.formField}>
                        <label htmlFor="estimated-quantity" className={styles.formLabel}>
                          Estimated Quantity
                        </label>
                        <input
                          id="estimated-quantity"
                          type="text"
                          value={details.quantity}
                          onChange={(event) => updateDetails('quantity', event.target.value)}
                          placeholder="For example 2 bags, 1 box"
                          className={styles.formInput}
                        />
                      </div>
                    </div>

                    <div className={styles.formField}>
                      <label htmlFor="special-notes" className={styles.formLabel}>
                        Special Instructions or Notes
                      </label>
                      <textarea
                        id="special-notes"
                        value={details.notes}
                        onChange={(event) => updateDetails('notes', event.target.value)}
                        placeholder="Any pickup instructions, accessibility notes, or other details..."
                        className={styles.formTextareaSmall}
                      />
                    </div>

                    {submitFeedback ? (
                      <div
                        className={
                          submitFeedback.type === 'success'
                            ? styles.feedbackSuccess
                            : styles.feedbackError
                        }
                        role={submitFeedback.type === 'error' ? 'alert' : 'status'}
                      >
                        {submitFeedback.message}
                      </div>
                    ) : null}

                    <button type="submit" disabled={submitting} className={styles.primaryActionWide}>
                      {submitting ? 'Submitting Donation...' : 'Send Donation Request'}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section id="about" className={styles.surfaceSection}>
          <div className={styles.shell}>
            <div className={styles.whyGrid}>
              <div className={styles.whyTextColumn}>
                <h2 className={styles.whyTitle}>
                  We&apos;re <span className={styles.highlight}>Good</span>, Ship the{' '}
                  <span className={styles.highlight}>Boxes</span>
                </h2>
                <p className={styles.whyText}>
                  Our mission is simple: redirect quality goods from landfills into the food bank
                  network. Every request helps the selected food bank review what is available and
                  arrange the right next step with you.
                </p>

                <ul className={styles.whyList}>
                  {[
                    'Pickup or drop-off options depend on the selected food bank',
                    'Tax-deductible donations with receipt provided',
                    'The selected food bank team follows up directly',
                    'Environmentally responsible recycling',
                  ].map((item) => (
                    <li key={item} className={styles.whyListItem}>
                      <span className={styles.whyListIcon}>
                        <ArrowRight size={16} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.whyImageWrap}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1656336654278-d98a754436ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMGRlbGl2ZXJ5JTIwdHJ1Y2slMjBsb2dpc3RpY3N8ZW58MXx8fHwxNzc0OTM5ODMwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Food bank delivery and logistics"
                  className={styles.whyImage}
                />
              </div>
            </div>
          </div>
        </section>
        </main>
        <PublicSiteFooter />
      </div>
    </>
  )
}

