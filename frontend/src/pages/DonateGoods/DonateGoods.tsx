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
import { donationsAPI, foodBanksAPI, statsAPI, type PublicImpactMetric } from '@/shared/lib/api'
import { buildFoodBankDisplayAddress } from '@/shared/lib/foodBankAddress'
import { isValidEmail } from '@/shared/lib/validation'
import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { getNearbyFoodbanks } from '@/utils/foodbankApi'
import {
  DONATE_GOODS_ACCEPTED_CATEGORIES,
  DONATE_GOODS_CONDITION_OPTIONS,
  DONATE_GOODS_FORM_STEPS,
  DONATE_GOODS_HERO_POINTS,
  DONATE_GOODS_JOURNEY_STAGES,
  DONATE_GOODS_LOCAL_HIGHLIGHTS,
  DONATE_GOODS_PRE_DONATION_NOTES,
  DONATE_GOODS_REJECTED_ITEMS,
  type DonateGoodsIconKey,
} from './donateGoods.content'
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

type InternalFoodBankRecord = {
  id: number
  name: string
  address: string
}

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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeMatchText(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

function findInternalFoodBankMatch(
  candidate: { name: string; address: string },
  internalBanks: InternalFoodBankRecord[],
) {
  const normalizedName = normalizeMatchText(candidate.name)
  const normalizedAddress = normalizeMatchText(candidate.address)

  return internalBanks.find((bank) => {
    const bankName = normalizeMatchText(bank.name)
    const bankAddress = normalizeMatchText(bank.address)

    return bankName === normalizedName
      || bankAddress === normalizedAddress
      || bankName.includes(normalizedName)
      || normalizedName.includes(bankName)
      || bankAddress.includes(normalizedAddress)
      || normalizedAddress.includes(bankAddress)
  }) ?? null
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
        <ImageWithFallback
          src={image}
          alt={title}
          className={styles.featureImage}
          centerFallback={false}
          fallbackContainerClassName=""
          fallbackContentClassName=""
        />
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

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description ? <p className={styles.sectionText}>{description}</p> : null}
    </div>
  )
}

function HeroBenefit({ text }: { text: string }) {
  return (
    <div className={styles.heroBenefit}>
      <Check className={styles.checkIcon} />
      <span>{text}</span>
    </div>
  )
}

function AcceptedGroupCard({
  category,
  items,
}: {
  category: string
  items: string[]
}) {
  return (
    <article className={styles.acceptedCard}>
      <h3 className={styles.acceptedCardTitle}>{category}</h3>
      <ul className={styles.acceptedList}>
        {items.map((item) => (
          <li key={item} className={styles.acceptedListItem}>
            <Check className={styles.acceptedListIcon} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function ProgressHeader({ step }: { step: number }) {
  return (
    <div className={styles.progressHeader}>
      <div className={styles.progressTrack}>
        {DONATE_GOODS_FORM_STEPS.map((flowStep, index) => (
          <div key={flowStep.id} style={{ display: 'contents' }}>
            <div
              className={`${styles.progressDot} ${
                step >= flowStep.id ? styles.progressDotActive : ''
              }`}
            >
              {flowStep.id}
            </div>
            {index < DONATE_GOODS_FORM_STEPS.length - 1 ? (
              <div
                className={`${styles.progressLine} ${
                  step >= flowStep.id + 1 ? styles.progressLineActive : ''
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className={styles.progressLabels}>
        {DONATE_GOODS_FORM_STEPS.map((flowStep) => (
          <span
            key={flowStep.id}
            className={step >= flowStep.id ? styles.progressLabelActive : ''}
          >
            {flowStep.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function BankResultCard({
  bank,
  onSelect,
}: {
  bank: FoodBankOption
  onSelect: (bank: FoodBankOption) => void
}) {
  return (
    <button
      type="button"
      className={styles.bankCard}
      onClick={() => onSelect(bank)}
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
  )
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className={styles.formField}>
      <label htmlFor={id} className={styles.formLabel}>
        {label}
      </label>
      {children}
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  )
}

function FeedbackBanner({
  feedback,
}: {
  feedback: { type: 'success' | 'error'; message: string }
}) {
  return (
    <div
      className={
        feedback.type === 'success'
          ? styles.feedbackSuccess
          : styles.feedbackError
      }
      role={feedback.type === 'error' ? 'alert' : 'status'}
    >
      {feedback.message}
    </div>
  )
}

function WhyListItem({ text }: { text: string }) {
  return (
    <li className={styles.whyListItem}>
      <span className={styles.whyListIcon}>
        <ArrowRight size={16} />
      </span>
      <span>{text}</span>
    </li>
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

function renderDonateGoodsIcon(icon: DonateGoodsIconKey, className: string): ReactNode {
  switch (icon) {
    case 'package':
      return <Package className={className} />
    case 'search':
      return <Search className={className} />
    case 'heart':
      return <Heart className={className} />
    case 'map-pin':
      return <MapPin className={className} />
    case 'users':
      return <Users className={className} />
  }
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
      const [nearbyFoodBanks, internalFoodBanksResponse] = await Promise.all([
        getNearbyFoodbanks(normalizedPostcode),
        foodBanksAPI.getFoodBanks().catch(() => null),
      ])
      const internalFoodBanks = Array.isArray(internalFoodBanksResponse?.items)
        ? internalFoodBanksResponse.items
            .filter((bank) => typeof bank.id === 'number')
            .map((bank) => ({
              id: bank.id,
              name: bank.name,
              address: bank.address,
            }))
        : []

      const rankedResults = nearbyFoodBanks
        .map((bank) => {
          const matchedInternalBank = findInternalFoodBankMatch(
            {
              name: bank.name,
              address: `${bank.address}, ${bank.postcode}`,
            },
            internalFoodBanks,
          )
          return {
            id: `${bank.name}-${bank.postcode}-${bank.lat}-${bank.lng}`,
            foodBankId: matchedInternalBank?.id,
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
                <h1 className={styles.heroTitle}>Donate Goods to a Local Food Bank</h1>
                <p className={styles.heroText}>
                  Choose a nearby food bank and send donation details to their local team before
                  collection or drop-off.
                </p>

                <div className={styles.heroBenefits}>
                  {DONATE_GOODS_HERO_POINTS.map((point) => (
                    <HeroBenefit key={point.id} text={point.text} />
                  ))}
                </div>

                <div className={styles.heroImageCard}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1738618141234-1ee52c6475a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBjYW5uZWQlMjBnb29kc3xlbnwxfHx8fDE3NzQ5Mzc1MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Food bank shelves with donations"
                  className={styles.heroImage}
                  centerFallback={false}
                  fallbackContainerClassName=""
                  fallbackContentClassName=""
                />
                  <div className={styles.heroImageOverlay}>
                    <p className={styles.heroQuote}>
                      Good donations help local teams respond faster.
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
            <SectionHeader title="How the goods donation flow works" />

            <div className={styles.featureGrid}>
              {DONATE_GOODS_JOURNEY_STAGES.map((stage) => (
                <FeatureCard
                  key={stage.id}
                  icon={renderDonateGoodsIcon(stage.icon, styles.featureIcon)}
                  title={`${stage.stepNumber}. ${stage.heading}`}
                  description={stage.detail}
                />
              ))}
            </div>

            <div className={styles.featureStoryGrid}>
              {DONATE_GOODS_LOCAL_HIGHLIGHTS.map((highlight) => (
                <FeatureCard
                  key={highlight.id}
                  icon={renderDonateGoodsIcon(highlight.icon, styles.featureImageIcon)}
                  title={highlight.title}
                  description={highlight.summary}
                  image={highlight.image}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="impact" className={styles.section}>
          <div className={styles.shell}>
            <SectionHeader
              title="Network goods support"
              description={
                impactStatsStatus === 'error'
                  ? 'Live impact data is temporarily unavailable. Please try again shortly.'
                  : impactStatsStatus === 'loading'
                    ? 'Loading live impact data from the dashboard.'
                    : 'These figures reflect goods support coordinated across our wider food bank network.'
              }
            />

            <div className={styles.impactGrid}>
              {impactStats.map((stat) => (
                <ImpactCard key={stat.label} number={stat.number} label={stat.label} trend={stat.trend} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.surfaceSection}>
          <div className={styles.shell}>
            <SectionHeader
              title="Items we accept"
              description="All items must be unopened, in original packaging, and within their best-before dates"
            />

            <div className={styles.acceptedGrid}>
              {DONATE_GOODS_ACCEPTED_CATEGORIES.map((group) => (
                <AcceptedGroupCard
                  key={group.id}
                  category={group.category}
                  items={group.items}
                />
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
                  {DONATE_GOODS_REJECTED_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="donate" className={styles.section}>
          <div className={styles.shell}>
            <SectionHeader
              title="Submit a donation request"
              description="Follow the steps below to choose a food bank and send your donation details."
            />

            <div className={styles.flowShell}>
              <ProgressHeader step={step} />

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
                            <BankResultCard
                              key={bank.id}
                              bank={bank}
                              onSelect={handleSelectBank}
                            />
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
                      <FormField id="donor-name" label="Full Name *" error={fieldErrors.name}>
                        <input
                          id="donor-name"
                          type="text"
                          value={details.name}
                          onChange={(event) => updateDetails('name', event.target.value)}
                          className={styles.formInput}
                        />
                      </FormField>

                      <FormField id="donor-email" label="Email Address *" error={fieldErrors.email}>
                        <input
                          id="donor-email"
                          type="email"
                          value={details.email}
                          onChange={(event) => updateDetails('email', event.target.value)}
                          className={styles.formInput}
                        />
                      </FormField>

                      <FormField id="donor-phone" label="Phone Number *" error={fieldErrors.phone}>
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
                      </FormField>

                      <FormField
                        id="pickup-date"
                        label="Preferred Collection or Drop-off Date *"
                        error={fieldErrors.pickupDate}
                      >
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
                      </FormField>
                    </div>

                    <FormField id="donation-items" label="What are you donating? *" error={fieldErrors.items}>
                      <textarea
                        id="donation-items"
                        value={details.items}
                        onChange={(event) => updateDetails('items', event.target.value)}
                        placeholder="Please describe the items you'd like to donate, for example canned vegetables, pasta, cereal, shampoo, or nappies."
                        className={styles.formTextarea}
                      />
                    </FormField>

                    <div className={styles.formGrid}>
                      <FormField id="item-condition" label="Item Condition *" error={fieldErrors.condition}>
                        <select
                          id="item-condition"
                          value={details.condition}
                          onChange={(event) => updateDetails('condition', event.target.value)}
                          className={styles.formSelect}
                        >
                          {DONATE_GOODS_CONDITION_OPTIONS.map((option) => (
                            <option key={option.value || 'empty'} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormField id="estimated-quantity" label="Estimated Quantity">
                        <input
                          id="estimated-quantity"
                          type="text"
                          value={details.quantity}
                          onChange={(event) => updateDetails('quantity', event.target.value)}
                          placeholder="For example 2 bags, 1 box"
                          className={styles.formInput}
                        />
                      </FormField>
                    </div>

                    <FormField id="special-notes" label="Special Instructions or Notes">
                      <textarea
                        id="special-notes"
                        value={details.notes}
                        onChange={(event) => updateDetails('notes', event.target.value)}
                        placeholder="Any pickup instructions, accessibility notes, or other details..."
                        className={styles.formTextareaSmall}
                      />
                    </FormField>

                    {submitFeedback ? (
                      <FeedbackBanner feedback={submitFeedback} />
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
                  Before you donate
                </h2>
                <p className={styles.whyText}>
                  Goods donations work best when the selected food bank can review what is being
                  offered and decide whether pickup or drop-off is the better option.
                  </p>

                <ul className={styles.whyList}>
                  {DONATE_GOODS_PRE_DONATION_NOTES.map((note) => (
                    <WhyListItem key={note} text={note} />
                  ))}
                </ul>
              </div>

              <div className={styles.whyImageWrap}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1656336654278-d98a754436ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Food bank delivery and logistics"
                  className={styles.whyImage}
                  centerFallback={false}
                  fallbackContainerClassName=""
                  fallbackContentClassName=""
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

