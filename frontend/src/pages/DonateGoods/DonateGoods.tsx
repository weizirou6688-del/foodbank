import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, ChevronRight, MapPin, Search, X } from 'lucide-react'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { donationsAPI, foodBanksAPI } from '@/shared/lib/api'
import {
  buildFoodBankDisplayAddress,
  findInternalFoodBankMatch,
  normalizeWhitespace,
} from '@/shared/lib/foodBankAddress'
import {
  isValidEmail,
  normalizePostcodeInput,
  parseUkDateValue,
  sanitizeDateTextInput,
  sanitizePhoneInput,
} from '@/shared/lib/validation'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { getNearbyFoodbanks } from '@/utils/foodbankApi'
import {
  DONATE_GOODS_ACCEPTED_CATEGORIES,
  DONATE_GOODS_CONDITION_OPTIONS,
  DONATE_GOODS_FORM_STEPS,
  DONATE_GOODS_HERO_POINTS,
  DONATE_GOODS_PRE_DONATION_NOTES,
  DONATE_GOODS_REJECTED_ITEMS,
} from './donateGoods.content'
import styles from './DonateGoods.module.css'

type FoodBankOption = {
  id: string
  foodBankId?: number | null
  name: string
  address: string
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

type FeedbackState = {
  type: 'success' | 'error'
  message: string
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

function parsePickupDate(value: string) {
  return parseUkDateValue(value)
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

function estimateQuantity(value: string) {
  const numbers = value.match(/\d+/g)
  if (!numbers) {
    return 1
  }

  const total = numbers.reduce((sum, current) => sum + Number(current), 0)
  return total > 0 ? total : 1
}

function formatDistanceMiles(distanceKm: number) {
  const distanceMiles = distanceKm * 0.621371
  return `${distanceMiles.toFixed(1)} miles`
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
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

function HeroPoint({ text }: { text: string }) {
  return (
    <li className={styles.heroPoint}>
      <span className={styles.heroPointIcon}>
        <Check size={18} />
      </span>
      <span>{text}</span>
    </li>
  )
}

function AcceptedCategoryCard({
  category,
  items,
}: {
  category: string
  items: string[]
}) {
  return (
    <article className={styles.categoryCard}>
      <h3 className={styles.categoryTitle}>{category}</h3>
      <ul className={styles.acceptedList}>
        {items.map((item) => (
          <li key={item} className={styles.acceptedItem}>
            <Check className={styles.acceptedItemIcon} size={16} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function ProgressHeader({ step }: { step: number }) {
  return (
    <aside className={styles.progressCard}>
      <p className={styles.progressEyebrow}>Donation flow</p>
      <ol className={styles.progressList}>
        {DONATE_GOODS_FORM_STEPS.map((flowStep) => {
          const stateClassName =
            step === flowStep.id
              ? styles.progressItemActive
              : step > flowStep.id
                ? styles.progressItemComplete
                : ''

          return (
            <li
              key={flowStep.id}
              className={`${styles.progressItem} ${stateClassName}`}
            >
              <div className={styles.progressBadge}>{flowStep.id}</div>
              <div>
                <p className={styles.progressLabel}>{flowStep.label}</p>
                <p className={styles.progressDescription}>{flowStep.description}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className={styles.progressHelp}>
        The request only goes to the food bank you select.
      </p>
    </aside>
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
      className={styles.resultCard}
      onClick={() => onSelect(bank)}
    >
      <div className={styles.resultHeader}>
        <div>
          <h4 className={styles.resultName}>{bank.name}</h4>
          <div className={styles.resultAddress}>
            <MapPin size={16} />
            <span>{bank.address}</span>
          </div>
          <p className={styles.resultMeta}>{bank.distance} away</p>
        </div>
        <ChevronRight className={styles.resultArrow} size={18} />
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

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  return (
    <div
      className={`${styles.feedback} ${
        feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
      }`}
      role={feedback.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {feedback.message}
    </div>
  )
}

export default function DonateGoods() {
  const [step, setStep] = useState(1)
  const [postcode, setPostcode] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [searchResults, setSearchResults] = useState<FoodBankOption[]>([])
  const [selectedBank, setSelectedBank] = useState<FoodBankOption | null>(null)
  const [details, setDetails] = useState<DonationDetails>(INITIAL_DETAILS)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitFeedback, setSubmitFeedback] = useState<FeedbackState | null>(null)
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
            distance: formatDistanceMiles(bank.distance),
            distanceMiles: bank.distance * 0.621371,
          } satisfies FoodBankOption
        })
        .sort((left, right) => left.distanceMiles - right.distanceMiles)

      setSearchResults(rankedResults)
      setSearchFeedback(
        rankedResults.length === 0
          ? `No food banks were found within ${LOCAL_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`
          : `Showing food banks within ${LOCAL_SEARCH_RADIUS_KM} km of ${normalizedPostcode}.`,
      )
      setStep(2)
    } catch (error) {
      setSearchResults([])
      setStep(1)
      setPostcodeError(
        error instanceof Error
          ? error.message
          : 'Unable to look up nearby food banks right now. Please try again.',
      )
    } finally {
      setSearching(false)
    }
  }

  const handleSelectBank = (bank: FoodBankOption) => {
    setSelectedBank(bank)
    setSubmitFeedback(null)
    setStep(3)
  }

  const goToSearchStep = () => {
    setSelectedBank(null)
    setSubmitFeedback(null)
    setStep(1)
  }

  const goToResultsStep = () => {
    setSelectedBank(null)
    setSubmitFeedback(null)
    setStep(2)
  }

  const normalizePickupDateField = () => {
    const parsedPickupDate = parsePickupDate(details.pickupDate)
    if (parsedPickupDate && details.pickupDate !== parsedPickupDate.ukDate) {
      updateDetails('pickupDate', parsedPickupDate.ukDate)
    }
  }

  const updateDetails = (field: keyof DonationDetails, value: string) => {
    setSubmitFeedback(null)
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

        if (/pickup date on or after today/i.test(error.message) || /valid date/i.test(error.message)) {
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
        <main className={styles.main}>
          <section className={styles.heroSection}>
            <div className={styles.container}>
              <div className={styles.heroBlock}>
                <p className={styles.eyebrow}>Goods donation</p>
                <h1 className={styles.heroTitle}>Donate goods to a local food bank</h1>
                <p className={styles.heroText}>
                  Search by postcode, choose the right team, and send the details they need before
                  any drop-off or collection is arranged.
                </p>
                <ul className={styles.heroPoints}>
                  {DONATE_GOODS_HERO_POINTS.map((point) => (
                    <HeroPoint key={point.id} text={point.text} />
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => scrollToSection('donate-flow')}
                >
                  Start donation request
                  <ArrowRight className={styles.buttonIcon} size={18} />
                </button>
              </div>
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionMuted}`}>
            <div className={styles.container}>
              <SectionHeader
                title="Check the basics before you submit"
                description="A short, clear request is easier for the local team to review and respond to."
              />
              <div className={styles.guidanceLayout}>
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Commonly accepted goods</h3>
                  <div className={styles.categoryGrid}>
                    {DONATE_GOODS_ACCEPTED_CATEGORIES.map((group) => (
                      <AcceptedCategoryCard
                        key={group.id}
                        category={group.category}
                        items={group.items}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.sidePanel}>
                  <div className={`${styles.noticeCard} ${styles.noticeCardSuccess}`}>
                    <Check className={styles.noticeIcon} size={18} />
                    <p>
                      All items should be unopened, in original packaging, and within their
                      best-before or use-by dates.
                    </p>
                  </div>

                  <div className={styles.sideCard}>
                    <h3 className={styles.panelTitle}>Before you submit</h3>
                    <ul className={styles.noteList}>
                      {DONATE_GOODS_PRE_DONATION_NOTES.map((note) => (
                        <li key={note} className={styles.noteItem}>
                          <ArrowRight className={styles.noteItemIcon} size={16} />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`${styles.sideCard} ${styles.sideCardDanger}`}>
                    <div className={styles.noticeCard}>
                      <X className={styles.noticeIcon} size={18} />
                      <p>Please do not include items that the food bank cannot safely store or use.</p>
                    </div>
                    <ul className={styles.rejectedList}>
                      {DONATE_GOODS_REJECTED_ITEMS.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="donate-flow" className={styles.section}>
            <div className={styles.container}>
              <SectionHeader
                title="Submit a goods donation request"
                description="Search nearby food banks, choose the right team, and share the details they need to reply."
              />
              <div className={styles.flowLayout}>
                <ProgressHeader step={step} />

                <div className={styles.flowStage}>
                  {step === 1 ? (
                    <form onSubmit={handleSearch} className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <h3 className={styles.stepTitle}>Search by postcode</h3>
                        <p className={styles.stepText}>
                          Enter a UK postcode to find food banks within {LOCAL_SEARCH_RADIUS_KM} km.
                        </p>
                      </div>

                      <div className={styles.searchRow}>
                        <div className={styles.searchInputWrap}>
                          <Search className={styles.searchIcon} size={18} />
                          <input
                            type="text"
                            placeholder="e.g. SW1A 1AA"
                            value={postcode}
                            onChange={(event) => {
                              setPostcode(normalizePostcodeInput(event.target.value))
                              setPostcodeError('')
                              setSearchFeedback(null)
                              setSubmitFeedback(null)
                            }}
                            maxLength={8}
                            className={`${styles.textInput} ${styles.searchInput}`}
                          />
                        </div>
                        <button
                          type="submit"
                          className={styles.primaryButton}
                          disabled={searching}
                        >
                          {searching ? 'Searching...' : 'Find food banks'}
                        </button>
                      </div>

                      {postcodeError ? <p className={styles.fieldError}>{postcodeError}</p> : null}
                    </form>
                  ) : null}

                  {step === 2 ? (
                    <div className={styles.flowStack}>
                      <div className={styles.inlineActions}>
                        <button
                          type="button"
                          onClick={goToSearchStep}
                          className={styles.ghostButton}
                        >
                          Change postcode
                        </button>
                      </div>

                      <div className={styles.stepCard}>
                        <div className={styles.stepHeader}>
                          <h3 className={styles.stepTitle}>Choose a food bank</h3>
                          <p className={styles.stepText}>
                            {searchFeedback ?? 'Select the local team that should review this request.'}
                          </p>
                        </div>

                        {searchResults.length === 0 ? (
                          <div className={styles.emptyState}>
                            {searchFeedback ?? 'Try another postcode to load nearby food banks.'}
                          </div>
                        ) : (
                          <div className={styles.resultList}>
                            {searchResults.map((bank) => (
                              <BankResultCard
                                key={bank.id}
                                bank={bank}
                                onSelect={handleSelectBank}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {step === 3 && selectedBank ? (
                    <div className={styles.flowStack}>
                      <div className={styles.inlineActions}>
                        <button
                          type="button"
                          onClick={goToResultsStep}
                          className={styles.ghostButton}
                        >
                          Choose a different food bank
                        </button>
                        <button
                          type="button"
                          onClick={goToSearchStep}
                          className={styles.ghostButton}
                        >
                          Search another postcode
                        </button>
                      </div>

                      <div className={styles.selectedBankCard}>
                        <p className={styles.selectedBankLabel}>Sending request to</p>
                        <h3 className={styles.selectedBankName}>{selectedBank.name}</h3>
                        <p className={styles.selectedBankAddress}>{selectedBank.address}</p>
                        <p className={styles.selectedBankMeta}>{selectedBank.distance} from {postcode}</p>
                      </div>

                      <form onSubmit={handleSubmitDonation} className={styles.stepCard}>
                        <div className={styles.stepHeader}>
                          <h3 className={styles.stepTitle}>Donation details</h3>
                          <p className={styles.stepText}>
                            Share what you have and how the food bank can contact you.
                          </p>
                        </div>

                        <div className={styles.formGrid}>
                          <FormField id="donor-name" label="Full name *" error={fieldErrors.name}>
                            <input
                              id="donor-name"
                              type="text"
                              value={details.name}
                              onChange={(event) => updateDetails('name', event.target.value)}
                              className={styles.textInput}
                            />
                          </FormField>

                          <FormField id="donor-email" label="Email address *" error={fieldErrors.email}>
                            <input
                              id="donor-email"
                              type="email"
                              value={details.email}
                              onChange={(event) => updateDetails('email', event.target.value)}
                              className={styles.textInput}
                            />
                          </FormField>

                          <FormField id="donor-phone" label="Phone number *" error={fieldErrors.phone}>
                            <input
                              id="donor-phone"
                              type="tel"
                              value={details.phone}
                              onChange={(event) =>
                                updateDetails('phone', sanitizePhoneInput(event.target.value))
                              }
                              inputMode="numeric"
                              maxLength={11}
                              placeholder="07123456789"
                              className={styles.textInput}
                            />
                          </FormField>

                          <FormField
                            id="pickup-date"
                            label="Preferred collection or drop-off date *"
                            error={fieldErrors.pickupDate}
                          >
                            <input
                              id="pickup-date"
                              type="text"
                              value={details.pickupDate}
                              onChange={(event) =>
                                updateDetails(
                                  'pickupDate',
                                  sanitizeDateTextInput(event.target.value),
                                )
                              }
                              onBlur={normalizePickupDateField}
                              inputMode="numeric"
                              maxLength={10}
                              placeholder="DD/MM/YYYY"
                              className={styles.textInput}
                            />
                          </FormField>
                        </div>

                        <FormField
                          id="donation-items"
                          label="What are you donating? *"
                          error={fieldErrors.items}
                        >
                          <textarea
                            id="donation-items"
                            value={details.items}
                            onChange={(event) => updateDetails('items', event.target.value)}
                            placeholder="e.g. canned vegetables, pasta, cereal, shampoo, or nappies"
                            className={styles.textareaInput}
                          />
                        </FormField>

                        <div className={styles.formGrid}>
                          <FormField
                            id="item-condition"
                            label="Item condition *"
                            error={fieldErrors.condition}
                          >
                            <select
                              id="item-condition"
                              value={details.condition}
                              onChange={(event) => updateDetails('condition', event.target.value)}
                              className={styles.selectInput}
                            >
                              {DONATE_GOODS_CONDITION_OPTIONS.map((option) => (
                                <option key={option.value || 'empty'} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          <FormField id="estimated-quantity" label="Estimated quantity">
                            <input
                              id="estimated-quantity"
                              type="text"
                              value={details.quantity}
                              onChange={(event) => updateDetails('quantity', event.target.value)}
                              placeholder="e.g. 2 bags, 1 box"
                              className={styles.textInput}
                            />
                          </FormField>
                        </div>

                        <FormField id="special-notes" label="Special instructions or notes">
                          <textarea
                            id="special-notes"
                            value={details.notes}
                            onChange={(event) => updateDetails('notes', event.target.value)}
                            placeholder="Access instructions, parking details, or when someone will be in"
                            className={`${styles.textareaInput} ${styles.textareaSmall}`}
                          />
                        </FormField>

                        {submitFeedback ? <FeedbackBanner feedback={submitFeedback} /> : null}

                        <button
                          type="submit"
                          disabled={submitting}
                          className={styles.submitButton}
                        >
                          {submitting ? 'Sending request...' : 'Send donation request'}
                        </button>
                      </form>
                    </div>
                  ) : null}
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
