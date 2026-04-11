import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { Check } from 'lucide-react'
import { donationsAPI } from '@/shared/lib/api'
import {
  formatCardNumber,
  formatExpiryDate,
  isValidCardNumber,
  isValidEmail,
  isValidExpiry,
} from '@/shared/lib/validation'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import styles from './DonateCash.module.css'

type SubmitFeedback = {
  type: 'success' | 'error'
  message: string
}

type CashFormData = {
  email: string
  cardholderName: string
  cardNumber: string
  expiryDate: string
  securityCode: string
}

type SimpleCopyBlock = {
  title: string
  description: string
}

type GalleryItem = {
  image: string
  alt: string
  title: string
}

type Testimonial = {
  image: string
  alt: string
  name: string
  meta: string
  quote: string
}

const DONATION_AMOUNTS = [10, 20, 50, 100]
const POUND_SYMBOL = '\u00A3'

const HERO_BENEFITS = [
  `${POUND_SYMBOL}10 can help cover a small urgent top-up`,
  `${POUND_SYMBOL}20 can support food and household essentials`,
  'Donations are recorded and tracked through the platform',
]

const HELP_ITEMS: SimpleCopyBlock[] = [
  {
    title: 'Urgent Top-Ups',
    description:
      'Helps cover food, toiletries, and other essentials when a local food bank needs a quick restock.',
  },
  {
    title: 'Local Response',
    description:
      'Supports practical response work such as purchasing, packing, and local distribution.',
  },
  {
    title: 'Tracked Support',
    description:
      'Donations are logged through the platform so teams can track what was received and where it was used.',
  },
]

const GALLERY_ITEMS: GalleryItem[] = [
  {
    image:
      'https://images.unsplash.com/photo-1593113630400-ea4288922497?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHZvbHVudGVlcnMlMjBkaXN0cmlidXRpbmd8ZW58MXx8fHwxNzc0OTI4OTU3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Volunteers distributing food',
    title: 'Community Distribution',
  },
  {
    image:
      'https://images.unsplash.com/photo-1584614207146-a64524f5806a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBoZWxwaW5nJTIwZ3JvY2VyaWVzfGVufDF8fHx8MTc3NDkyODk1OHww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Community helping with groceries',
    title: 'Food Collection',
  },
  {
    image:
      'https://images.unsplash.com/photo-1648090229186-6188eaefcc6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBmb29kJTIwZG9uYXRpb258ZW58MXx8fHwxNzc0OTI4OTU4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Fresh vegetables for donation',
    title: 'Fresh Produce',
  },
]

const TESTIMONIALS: Testimonial[] = [
  {
    image:
      'https://images.unsplash.com/photo-1623594675959-02360202d4d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Monthly donor',
    name: 'Monthly donor',
    meta: 'Regular supporter',
    quote:
      'Monthly giving is easy to plan for and helps local teams respond without waiting for a separate fundraising push.',
  },
  {
    image:
      'https://images.unsplash.com/photo-1769636930047-4478f12cf430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBwb3J0cmFpdCUyMGNvbmZpZGVudHxlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: 'Long-term supporter',
    name: 'Long-term supporter',
    meta: 'Recurring donor',
    quote:
      'Clear reporting and a simple donation flow make it easier to keep supporting the work over time.',
  },
]

function createEmptyFormData(): CashFormData {
  return {
    email: '',
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    securityCode: '',
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function getDonationCopy(donationType: string | null) {
  const isMonthlyDonation = donationType === 'monthly'
  const isOneTimeDonation = donationType === 'onetime' || donationType === 'one-time'

  return {
    heading: isMonthlyDonation
      ? 'Monthly Donation'
      : isOneTimeDonation
        ? 'One-Off Donation'
        : 'Donate',
    subtext: isMonthlyDonation
      ? 'Set up a recurring donation using the form below.'
      : isOneTimeDonation
        ? 'Make a single donation using the form below.'
        : 'Use the form below to submit a cash donation.',
  }
}

function hasValidFutureExpiryDate(value: string) {
  if (!isValidExpiry(value)) {
    return false
  }

  const [monthString, yearString] = value.split('/')
  const month = Number.parseInt(monthString, 10)
  const year = Number.parseInt(yearString, 10)

  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return false
  }

  const now = new Date()
  const currentYear = now.getFullYear() % 100
  const currentMonth = now.getMonth() + 1

  return year > currentYear || (year === currentYear && month >= currentMonth)
}

function getDonationValidationMessage(amount: number, formData: CashFormData) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Please select or enter a valid donation amount.'
  }
  if (!formData.cardholderName.trim()) {
    return 'Please enter the cardholder name.'
  }
  if (!isValidEmail(formData.email.trim())) {
    return 'Please enter a valid email address.'
  }
  if (!isValidCardNumber(formData.cardNumber)) {
    return 'Please enter a valid 16-digit card number.'
  }
  if (!hasValidFutureExpiryDate(formData.expiryDate)) {
    return 'Please enter a valid future expiry date in MM/YY format.'
  }
  if (!/^\d{3,4}$/.test(formData.securityCode)) {
    return 'Please enter a valid CVV.'
  }
  return null
}

function SectionIntro({
  title,
  description,
  descriptionExtraLine,
}: {
  title: string
  description: string
  descriptionExtraLine?: string
}) {
  return (
    <div className={styles.sectionIntro}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDescription}>
        {description}
        {descriptionExtraLine ? (
          <span className={styles.sectionDescriptionLine}>{descriptionExtraLine}</span>
        ) : null}
      </p>
    </div>
  )
}

function CheckListItem({ text }: { text: string }) {
  return (
    <div className={styles.checkItem}>
      <Check className={styles.checkIcon} strokeWidth={3} />
      <span className={styles.checkText}>{text}</span>
    </div>
  )
}

function HelpItemCard({ item }: { item: SimpleCopyBlock }) {
  return (
    <div className={styles.helpItem}>
      <div className={styles.helpIconBox}>
        <Check className={styles.helpIcon} strokeWidth={3} />
      </div>
      <div>
        <h3 className={styles.helpItemTitle}>{item.title}</h3>
        <p className={styles.helpItemText}>{item.description}</p>
      </div>
    </div>
  )
}

function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <div className={styles.galleryCard}>
      <ImageWithFallback src={item.image} alt={item.alt} className={styles.galleryImage} />
      <div className={styles.galleryOverlay}>
        <p className={styles.galleryTitle}>{item.title}</p>
      </div>
    </div>
  )
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className={styles.testimonialCard}>
      <div className={styles.testimonialHeader}>
        <ImageWithFallback
          src={testimonial.image}
          alt={testimonial.alt}
          className={styles.testimonialAvatar}
        />
        <div>
          <h3 className={styles.testimonialName}>{testimonial.name}</h3>
          <p className={styles.testimonialMeta}>{testimonial.meta}</p>
        </div>
      </div>
      <blockquote className={styles.testimonialQuote}>{testimonial.quote}</blockquote>
    </div>
  )
}

function FormField({
  id,
  label,
  required = false,
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
      </label>
      {children}
    </div>
  )
}

function FeedbackBanner({ feedback }: { feedback: SubmitFeedback }) {
  return (
    <div
      className={`${styles.feedback} ${
        feedback.type === 'success'
          ? styles.feedbackSuccess
          : styles.feedbackError
      }`}
      role={feedback.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {feedback.message}
    </div>
  )
}

export default function DonateCash() {
  const location = useLocation()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null)
  const [formData, setFormData] = useState<CashFormData>(createEmptyFormData)

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const amountParam = searchParams.get('amount')
    const parsedAmount = amountParam ? Number.parseFloat(amountParam) : Number.NaN

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSelectedAmount(null)
      setCustomAmount('')
      return
    }

    if (DONATION_AMOUNTS.includes(parsedAmount)) {
      setSelectedAmount(parsedAmount)
      setCustomAmount('')
      return
    }

    setSelectedAmount(null)
    setCustomAmount(parsedAmount.toString())
  }, [location.search])

  useEffect(() => {
    if (location.hash !== '#donate-form') {
      return
    }

    const timeoutHandle = window.setTimeout(() => {
      scrollToSection('donate-form')
    }, 50)

    return () => window.clearTimeout(timeoutHandle)
  }, [location.hash])

  const updateFormField = <K extends keyof CashFormData>(field: K, value: CashFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const resetForm = () => {
    setSelectedAmount(null)
    setCustomAmount('')
    setFormData(createEmptyFormData())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitFeedback(null)

    const finalAmount = selectedAmount ?? Number.parseFloat(customAmount)
    const validationMessage = getDonationValidationMessage(finalAmount, formData)
    if (validationMessage) {
      setSubmitFeedback({
        type: 'error',
        message: validationMessage,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const donation = await donationsAPI.donateCash({
        donor_name: formData.cardholderName.trim(),
        donor_email: formData.email.trim(),
        amount_pence: Math.round(finalAmount * 100),
      })

      const amountLabel = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(finalAmount)
      const referenceLine = donation.payment_reference
        ? ` Reference: ${donation.payment_reference}.`
        : ''

      resetForm()
      setSubmitFeedback({
        type: 'success',
        message: `Thank you for your donation of ${amountLabel}.${referenceLine}`,
      })
    } catch (error) {
      setSubmitFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit donation. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const donationType = new URLSearchParams(location.search).get('type')
  const formCopy = getDonationCopy(donationType)

  return (
    <>
      <PrimaryNavbar variant="public" />

      <div className={styles.page}>
        <main className={styles.main}>
          <section className={styles.section}>
            <div className={`${styles.sectionInner} ${styles.heroInner}`}>
              <h1 className={styles.heroTitle}>Support Food Banks Across the Network</h1>
              <p className={styles.heroText}>
                Cash donations help cover urgent purchases, transport, and coordination
                across participating food banks when local stock is short.
              </p>

              <div className={styles.checkList}>
                {HERO_BENEFITS.map((benefit) => (
                  <CheckListItem key={benefit} text={benefit} />
                ))}
              </div>

              <div className={styles.heroImageWrap}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1738618141224-815f18b8e469?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBvcmdhbml6ZWQlMjBkb25hdGlvbnN8ZW58MXx8fHwxNzc0OTQwMDk4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Food bank donation"
                  className={styles.heroImage}
                />
              </div>

              <button
                type="button"
                onClick={() => scrollToSection('donate-form')}
                className={styles.primaryButton}
              >
                Donate Cash
              </button>
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionMuted}`}>
            <div className={styles.sectionInner}>
              <SectionIntro
                title="Where Donations Go"
                description="Donations are used across the network where a local team needs extra support."
              />

              <div className={styles.helpPanel}>
                <div className={styles.helpGrid}>
                  {HELP_ITEMS.map((item) => (
                    <HelpItemCard key={item.title} item={item} />
                  ))}
                </div>
              </div>

              <div className={styles.galleryGrid}>
                {GALLERY_ITEMS.map((item) => (
                  <GalleryCard key={item.title} item={item} />
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionInner}>
              <SectionIntro
                title="A Typical Support Case"
                description="A short gap in income can quickly turn into a food emergency. Donations help local teams bridge that gap while a household gets back on its feet."
                descriptionExtraLine="Food banks often use flexible funds to cover the essentials that are missing that week."
              />

              <div className={styles.storyCard}>
                <div className={styles.storyCardBody}>
                  <div className={styles.storyImageWrap}>
                    <ImageWithFallback
                      src="https://images.unsplash.com/photo-1667354436356-a6264939ff27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW5nbGUlMjBtb3RoZXIlMjBjaGlsZHJlbiUyMGZhbWlseSUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDkyODQwN3ww&ixlib=rb-4.1.0&q=80&w=1080"
                      alt="Household receiving support"
                      className={styles.storyImage}
                    />
                  </div>

                  <blockquote className={styles.storyQuote}>
                    A few missed shifts or an unexpected bill can be enough to put a household under
                    immediate pressure.
                  </blockquote>

                  <p className={styles.storyText}>
                    In cases like this, a food bank may need to buy a short list of missing items,
                    cover transport, or prepare an emergency parcel quickly. Regular cash donations
                    make that response easier because the team does not need to wait for the exact
                    items to arrive first.
                  </p>

                  <div className={styles.storyBadge}>
                    <span className={styles.storyBadgeText}>
                      Monthly giving helps teams respond faster when demand changes week to week.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionMuted}`}>
            <div className={styles.sectionInner}>
              <SectionIntro
                title="Why People Give Regularly"
                description="Regular donors usually mention the same three reasons: it is easy to budget, it helps teams plan ahead, and it supports urgent local gaps."
                descriptionExtraLine="The comments below reflect the kind of feedback teams hear most often."
              />

              <div className={styles.testimonialList}>
                {TESTIMONIALS.map((testimonial) => (
                  <TestimonialCard key={testimonial.name} testimonial={testimonial} />
                ))}
              </div>
            </div>
          </section>

          <section id="donate-form" className={styles.section}>
            <div className={styles.formInner}>
              <div className={`${styles.sectionIntro} ${styles.formSectionIntro}`}>
                <h2 className={styles.sectionTitle}>{formCopy.heading}</h2>
                <p className={styles.formSubtext}>{formCopy.subtext}</p>
              </div>

              <div className={styles.formCard}>
                <form onSubmit={handleSubmit} className={styles.formStack}>
                  <div className={styles.formBlock}>
                    <div className={styles.formGrid}>
                      <FormField id="email" label="Email Address " required>
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(event) => updateFormField('email', event.target.value)}
                          required
                          className={styles.input}
                        />
                      </FormField>
                      <FormField id="cardholderName" label="Cardholder Name " required>
                        <input
                          id="cardholderName"
                          type="text"
                          value={formData.cardholderName}
                          onChange={(event) => updateFormField('cardholderName', event.target.value)}
                          required
                          className={styles.input}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className={styles.formBlock}>
                    <div>
                      <label className={styles.label}>
                        Donation Amount <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.amountGrid}>
                        {DONATION_AMOUNTS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => {
                              setSelectedAmount(amount)
                              setCustomAmount('')
                            }}
                            className={`${styles.amountButton} ${
                              selectedAmount === amount ? styles.amountButtonActive : ''
                            }`}
                          >
                            {POUND_SYMBOL}
                            {amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormField id="customAmount" label={`Custom Amount (${POUND_SYMBOL})`}>
                      <input
                        id="customAmount"
                        type="number"
                        placeholder="Enter amount"
                        value={customAmount}
                        onChange={(event) => {
                          setCustomAmount(event.target.value)
                          setSelectedAmount(null)
                        }}
                        className={styles.input}
                      />
                    </FormField>
                  </div>

                  <div className={styles.formBlock}>
                    <FormField id="cardNumber" label="Card Number " required>
                      <input
                        id="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={formData.cardNumber}
                        onChange={(event) => updateFormField('cardNumber', formatCardNumber(event.target.value))}
                        required
                        className={styles.input}
                      />
                    </FormField>

                    <div className={styles.formGrid}>
                      <FormField id="expiryDate" label="Expiry Date " required>
                        <input
                          id="expiryDate"
                          type="text"
                          placeholder="MM/YY"
                          value={formData.expiryDate}
                          onChange={(event) => updateFormField('expiryDate', formatExpiryDate(event.target.value))}
                          required
                          className={styles.input}
                        />
                      </FormField>
                      <FormField id="securityCode" label="CVV " required>
                        <input
                          id="securityCode"
                          type="text"
                          placeholder="123"
                          value={formData.securityCode}
                          onChange={(event) =>
                            updateFormField(
                              'securityCode',
                              event.target.value.replace(/\D/g, '').slice(0, 4),
                            )
                          }
                          required
                          className={styles.input}
                        />
                      </FormField>
                    </div>
                  </div>

                  {submitFeedback ? <FeedbackBanner feedback={submitFeedback} /> : null}

                  <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
                    Submit Donation Request
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>
        <PublicSiteFooter />
      </div>
    </>
  )
}
