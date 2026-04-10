import { useEffect, useState, type FormEvent } from 'react'
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
import { ImageWithFallback } from './components/media/ImageWithFallback'
import styles from './DonateCash.module.css'

const DONATION_AMOUNTS = [10, 20, 50, 100]
const POUND_SYMBOL = '\u00A3'

export default function DonateCash() {
  const location = useLocation()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    securityCode: '',
  })

  const scrollToDonateForm = () => {
    document.getElementById('donate-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

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
      document.getElementById('donate-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)

    return () => window.clearTimeout(timeoutHandle)
  }, [location.hash])

  const resetForm = () => {
    setSelectedAmount(null)
    setCustomAmount('')
    setFormData({
      email: '',
      cardholderName: '',
      cardNumber: '',
      expiryDate: '',
      securityCode: '',
    })
  }

  const hasValidFutureExpiryDate = (value: string) => {
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

  const donationType = new URLSearchParams(location.search).get('type')
  const isMonthlyDonation = donationType === 'monthly'
  const isOneTimeDonation = donationType === 'onetime' || donationType === 'one-time'
  const formHeading = isMonthlyDonation
    ? 'Monthly Donation'
    : isOneTimeDonation
      ? 'One-Off Donation'
      : 'Donate'
  const formSubtext = isMonthlyDonation
    ? 'Set up a recurring donation using the form below.'
    : isOneTimeDonation
      ? 'Make a single donation using the form below.'
      : 'Use the form below to submit a cash donation.'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitFeedback(null)

    const finalAmount = selectedAmount ?? Number.parseFloat(customAmount)
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please select or enter a valid donation amount.',
      })
      return
    }

    if (!formData.cardholderName.trim()) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please enter the cardholder name.',
      })
      return
    }

    if (!isValidEmail(formData.email.trim())) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please enter a valid email address.',
      })
      return
    }

    if (!isValidCardNumber(formData.cardNumber)) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please enter a valid 16-digit card number.',
      })
      return
    }

    if (!hasValidFutureExpiryDate(formData.expiryDate)) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please enter a valid future expiry date in MM/YY format.',
      })
      return
    }

    if (!/^\d{3,4}$/.test(formData.securityCode)) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please enter a valid CVV.',
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
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit donation. Please try again.'
      setSubmitFeedback({
        type: 'error',
        message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

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
                <div className={styles.checkItem}>
                  <Check className={styles.checkIcon} strokeWidth={3} />
                  <span className={styles.checkText}>
                    {POUND_SYMBOL}
                    10 can help cover a small urgent top-up
                  </span>
                </div>
                <div className={styles.checkItem}>
                  <Check className={styles.checkIcon} strokeWidth={3} />
                  <span className={styles.checkText}>
                    {POUND_SYMBOL}
                    20 can support food and household essentials
                  </span>
                </div>
                <div className={styles.checkItem}>
                  <Check className={styles.checkIcon} strokeWidth={3} />
                  <span className={styles.checkText}>Donations are recorded and tracked through the platform</span>
                </div>
              </div>

              <div className={styles.heroImageWrap}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1738618141224-815f18b8e469?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBvcmdhbml6ZWQlMjBkb25hdGlvbnN8ZW58MXx8fHwxNzc0OTQwMDk4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Food bank donation"
                  className={styles.heroImage}
                />
              </div>

              <button type="button" onClick={scrollToDonateForm} className={styles.primaryButton}>
                Donate Cash
              </button>
            </div>
          </section>

        <section className={`${styles.section} ${styles.sectionMuted}`}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionIntro}>
              <h2 className={styles.sectionTitle}>Where Donations Go</h2>
              <p className={styles.sectionDescription}>
                Donations are used across the network where a local team needs extra support.
              </p>
            </div>

            <div className={styles.helpPanel}>
              <div className={styles.helpGrid}>
                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>Urgent Top-Ups</h3>
                    <p className={styles.helpItemText}>
                      Helps cover food, toiletries, and other essentials when a local food bank
                      needs a quick restock.
                    </p>
                  </div>
                </div>

                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>Local Response</h3>
                    <p className={styles.helpItemText}>
                      Supports practical response work such as purchasing, packing, and local
                      distribution.
                    </p>
                  </div>
                </div>

                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>Tracked Support</h3>
                    <p className={styles.helpItemText}>
                      Donations are logged through the platform so teams can track what was
                      received and where it was used.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.galleryGrid}>
              <div className={styles.galleryCard}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1593113630400-ea4288922497?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHZvbHVudGVlcnMlMjBkaXN0cmlidXRpbmd8ZW58MXx8fHwxNzc0OTI4OTU3fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Volunteers distributing food"
                  className={styles.galleryImage}
                />
                <div className={styles.galleryOverlay}>
                  <p className={styles.galleryTitle}>Community Distribution</p>
                </div>
              </div>

              <div className={styles.galleryCard}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1584614207146-a64524f5806a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBoZWxwaW5nJTIwZ3JvY2VyaWVzfGVufDF8fHx8MTc3NDkyODk1OHww&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Community helping with groceries"
                  className={styles.galleryImage}
                />
                <div className={styles.galleryOverlay}>
                  <p className={styles.galleryTitle}>Food Collection</p>
                </div>
              </div>

              <div className={styles.galleryCard}>
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1648090229186-6188eaefcc6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBmb29kJTIwZG9uYXRpb258ZW58MXx8fHwxNzc0OTI4OTU4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Fresh vegetables for donation"
                  className={styles.galleryImage}
                />
                <div className={styles.galleryOverlay}>
                  <p className={styles.galleryTitle}>Fresh Produce</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionIntro}>
              <h2 className={styles.sectionTitle}>A Typical Support Case</h2>
              <p className={styles.sectionDescription}>
                A short gap in income can quickly turn into a food emergency. Donations help local
                teams bridge that gap while a household gets back on its feet.
                <span className={styles.sectionDescriptionLine}>
                  Food banks often use flexible funds to cover the essentials that are missing
                  that week.
                </span>
              </p>
            </div>

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
            <div className={styles.sectionIntro}>
              <h2 className={styles.sectionTitle}>Why People Give Regularly</h2>
              <p className={styles.sectionDescription}>
                Regular donors usually mention the same three reasons: it is easy to budget, it
                helps teams plan ahead, and it supports urgent local gaps.
                <span className={styles.sectionDescriptionLine}>
                  The comments below reflect the kind of feedback teams hear most often.
                </span>
              </p>
            </div>

            <div className={styles.testimonialList}>
              <div className={styles.testimonialCard}>
                <div className={styles.testimonialHeader}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1623594675959-02360202d4d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Monthly donor"
                    className={styles.testimonialAvatar}
                  />
                  <div>
                    <h3 className={styles.testimonialName}>Monthly donor</h3>
                    <p className={styles.testimonialMeta}>Regular supporter</p>
                  </div>
                </div>
                <blockquote className={styles.testimonialQuote}>
                  Monthly giving is easy to plan for and helps local teams respond without waiting
                  for a separate fundraising push.
                </blockquote>
              </div>

              <div className={styles.testimonialCard}>
                <div className={styles.testimonialHeader}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1769636930047-4478f12cf430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBwb3J0cmFpdCUyMGNvbmZpZGVudHxlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Long-term supporter"
                    className={styles.testimonialAvatar}
                  />
                  <div>
                    <h3 className={styles.testimonialName}>Long-term supporter</h3>
                    <p className={styles.testimonialMeta}>Recurring donor</p>
                  </div>
                </div>
                <blockquote className={styles.testimonialQuote}>
                  Clear reporting and a simple donation flow make it easier to keep supporting the
                  work over time.
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        <section id="donate-form" className={styles.section}>
          <div className={styles.formInner}>
            <div className={`${styles.sectionIntro} ${styles.formSectionIntro}`}>
              <h2 className={styles.sectionTitle}>{formHeading}</h2>
              <p className={styles.formSubtext}>{formSubtext}</p>
            </div>

            <div className={styles.formCard}>
              <form onSubmit={handleSubmit} className={styles.formStack}>
                <div className={styles.formBlock}>
                  <div className={styles.formGrid}>
                    <div>
                      <label htmlFor="email" className={styles.label}>
                        Email Address <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(event) =>
                          setFormData({ ...formData, email: event.target.value })
                        }
                        required
                        className={styles.input}
                      />
                    </div>
                    <div>
                      <label htmlFor="cardholderName" className={styles.label}>
                        Cardholder Name <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="cardholderName"
                        type="text"
                        value={formData.cardholderName}
                        onChange={(event) =>
                          setFormData({ ...formData, cardholderName: event.target.value })
                        }
                        required
                        className={styles.input}
                      />
                    </div>
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

                  <div>
                    <label htmlFor="customAmount" className={styles.label}>
                      Custom Amount ({POUND_SYMBOL})
                    </label>
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
                  </div>
                </div>

                <div className={styles.formBlock}>
                  <div>
                    <label htmlFor="cardNumber" className={styles.label}>
                      Card Number <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="cardNumber"
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={formData.cardNumber}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          cardNumber: formatCardNumber(event.target.value),
                        })
                      }
                      required
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGrid}>
                    <div>
                      <label htmlFor="expiryDate" className={styles.label}>
                        Expiry Date <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="expiryDate"
                        type="text"
                        placeholder="MM/YY"
                        value={formData.expiryDate}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            expiryDate: formatExpiryDate(event.target.value),
                          })
                        }
                        required
                        className={styles.input}
                      />
                    </div>
                    <div>
                      <label htmlFor="securityCode" className={styles.label}>
                        CVV <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="securityCode"
                        type="text"
                        placeholder="123"
                        value={formData.securityCode}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            securityCode: event.target.value.replace(/\D/g, '').slice(0, 4),
                          })
                        }
                        required
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>

                {submitFeedback && (
                  <div
                    className={`${styles.feedback} ${
                      submitFeedback.type === 'success'
                        ? styles.feedbackSuccess
                        : styles.feedbackError
                    }`}
                    role={submitFeedback.type === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                  >
                    {submitFeedback.message}
                  </div>
                )}

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

