import { useState, type FormEvent } from 'react'
import { Check, X } from '@/shared/ui/InlineIcons'
import { donationsAPI } from '@/shared/lib/api/donations'
import { foodBanksAPI } from '@/shared/lib/api/foodBanks'
import { normalizeWhitespace } from '@/shared/lib/foodBankAddress'
import { scrollToElementById } from '@/shared/lib/scroll'
import PublicPageShell from '@/shared/ui/PublicPageShell'
import {
  BACKEND_API_UNAVAILABLE_MESSAGE,
  getCoordinatesFromPostcode,
  getFoodBankLookupErrorMessage,
  getNearbyFoodbanks,
} from '@/utils/foodbankApi'
import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import { FEATURE_STORIES, STEP_FEATURES } from './donateGoods.content'
import {
  ACCEPTED_ITEMS,
  FLOW_PROGRESS_LABELS,
  HERO_BENEFITS,
  INITIAL_DETAILS,
  LOCAL_SEARCH_RADIUS_KM,
  REJECTED_ITEMS,
  UK_POSTCODE_PATTERN,
} from './donateGoods.constants'
import {
  buildRankedFoodBankOptions,
  estimateQuantity,
  getPhoneError,
  getPickupDateError,
  parsePickupDate,
  validateDonationDetails,
} from './donateGoods.helpers'
import { FeatureCard } from './components/FeatureCard'
import { SearchLocationStep, SelectFoodBankStep, DonationDetailsStep } from './components/DonateGoodsFlowSteps'
import type { DonationDetails, FeedbackState, FieldErrors, FoodBankOption } from './donateGoods.types'
import { styles } from './donateGoodsStyles'

export default function DonateGoods() {
  const [step, setStep] = useState(1)
  const [postcode, setPostcode] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [searchResults, setSearchResults] = useState<FoodBankOption[]>([])
  const [selectedBank, setSelectedBank] = useState<FoodBankOption | null>(null)
  const [details, setDetails] = useState<DonationDetails>(INITIAL_DETAILS)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitFeedback, setSubmitFeedback] = useState<FeedbackState | null>(null)
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const scrollToSection = (sectionId: string) => {
    scrollToElementById(sectionId)
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
      const [userCoords, internalBanksResponse, nearbyBanks] = await Promise.all([
        getCoordinatesFromPostcode(normalizedPostcode),
        foodBanksAPI.getFoodBanks(),
        getNearbyFoodbanks(normalizedPostcode),
      ])

      const rankedResults = buildRankedFoodBankOptions({
        userCoords,
        internalBanks: internalBanksResponse.items ?? [],
        nearbyBanks,
        localSearchRadiusKm: LOCAL_SEARCH_RADIUS_KM,
      })

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
        getFoodBankLookupErrorMessage(
          error,
          BACKEND_API_UNAVAILABLE_MESSAGE,
        ),
      )
    } finally {
      setSearching(false)
    }
  }

  const handleSelectBank = (bank: FoodBankOption) => {
    setSelectedBank(bank)
    setStep(3)
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

  const normalizePickupDateField = () => {
    const parsedPickupDate = parsePickupDate(details.pickupDate)
    if (parsedPickupDate && details.pickupDate !== parsedPickupDate.ukDate) {
      updateDetails('pickupDate', parsedPickupDate.ukDate)
    }
  }

  const validateDetails = () => {
    const nextErrors = validateDonationDetails(details)
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

    if (!validateDetails()) {
      return
    }

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
        food_bank_email: selectedBank.foodBankEmail?.trim() || undefined,
        food_bank_name: selectedBank.name,
        food_bank_address: selectedBank.address,
        donor_name: details.name.trim(),
        donor_email: details.email.trim(),
        donor_phone: details.phone.trim(),
        postcode: postcode.trim().toUpperCase(),
        pickup_date: parsedPickupDate.isoDate,
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
        if (/at least 3 characters/i.test(error.message)) {
          setFieldErrors((current) => ({
            ...current,
            phone: 'Phone number must be at least 3 characters.',
          }))
          return
        }

        if (
          /pickup date on or after today/i.test(error.message)
          || /valid date/i.test(error.message)
        ) {
          setFieldErrors((current) => ({
            ...current,
            pickupDate: getPickupDateError(details.pickupDate) || 'Please enter a valid date on or after today.',
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
    <PublicPageShell mainClassName={`${styles.page} flex-1`}>
      <section id="home" className={styles.heroSection}>
        <div className={styles.shell}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>Your Unwanted Goods, Their Utilities</h1>
            <p className={styles.heroText}>
              Choose a food bank near you and submit a goods donation request to their local
              team. We record the request through the platform and help coordinate the handover.
            </p>

            <div className={styles.heroBenefits}>
              {HERO_BENEFITS.map((benefit) => (
                <div key={benefit} className={styles.heroBenefit}>
                  <Check className={styles.checkIcon} />
                  <span>{benefit}</span>
                </div>
              ))}
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
            <h2 className={styles.sectionTitle}>Simple Steps to Give Back</h2>
          </div>

          <div className={styles.featureGrid}>
            {STEP_FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>

          <div className={styles.featureStoryGrid}>
            {FEATURE_STORIES.map((story) => (
              <FeatureCard
                key={story.title}
                title={story.title}
                description={story.description}
                image={story.image}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.surfaceSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Items We Gladly Accept</h2>
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
            <h2 className={styles.sectionTitle}>Ready to Make a Difference?</h2>
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
                {FLOW_PROGRESS_LABELS.map((label, index) => (
                  <span key={label} className={step >= index + 1 ? styles.progressLabelActive : ''}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {step === 1 ? (
              <SearchLocationStep
                postcode={postcode}
                postcodeError={postcodeError}
                searching={searching}
                onSearch={handleSearch}
                onPostcodeChange={setPostcode}
                onClearPostcodeError={() => setPostcodeError('')}
                onClearSearchFeedback={() => setSearchFeedback(null)}
              />
            ) : null}

            {step === 2 ? (
              <SelectFoodBankStep
                searchFeedback={searchFeedback}
                searchResults={searchResults}
                onBack={() => setStep(1)}
                onSelectBank={handleSelectBank}
              />
            ) : null}

            {step === 3 && selectedBank ? (
              <DonationDetailsStep
                selectedBank={selectedBank}
                details={details}
                fieldErrors={fieldErrors}
                submitFeedback={submitFeedback}
                submitting={submitting}
                onBack={() => setStep(2)}
                onSubmit={handleSubmitDonation}
                onUpdateDetails={updateDetails}
                onNormalizePickupDateField={normalizePickupDateField}
              />
            ) : null}
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
