import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { Check, Instagram, Linkedin, Twitter } from 'lucide-react'
import { donationsAPI } from '@/shared/lib/api'
import {
  formatCardNumber,
  formatExpiryDate,
  isValidCardNumber,
  isValidEmail,
  isValidExpiry,
} from '@/shared/lib/validation'
import LoginModal from '@/features/auth/components/LoginModal'
import { ImageWithFallback } from './components/figma/ImageWithFallback'
import styles from './DonateCash.module.css'

const DONATION_AMOUNTS = [10, 20, 50, 100]
const POUND_SYMBOL = '\u00A3'
const HERO_EM_DASH = '\u2014'

export default function DonateCash() {
  const navigate = useNavigate()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })
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
    <div className={styles.page}>
      <PrimaryNavbar variant="public" />

      <main className={styles.main}>
        <section className={styles.section}>
          <div className={`${styles.sectionInner} ${styles.heroInner}`}>
            <h1 className={styles.heroTitle}>Your Gift Feeds Families</h1>
            <p className={styles.heroText}>
              Every pound donated goes directly to purchasing food for local families in need. No{' '}
              <span className={styles.heroTextLine}>
                admin fees {HERO_EM_DASH} 100% impact.
              </span>
            </p>

            <div className={styles.checkList}>
              <div className={styles.checkItem}>
                <Check className={styles.checkIcon} strokeWidth={3} />
                <span className={styles.checkText}>
                  {POUND_SYMBOL}
                  10 = 1 full food package
                </span>
              </div>
              <div className={styles.checkItem}>
                <Check className={styles.checkIcon} strokeWidth={3} />
                <span className={styles.checkText}>
                  {POUND_SYMBOL}
                  20 = Feeds a family for a week
                </span>
              </div>
              <div className={styles.checkItem}>
                <Check className={styles.checkIcon} strokeWidth={3} />
                <span className={styles.checkText}>100% goes directly to people in need</span>
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
              <h2 className={styles.sectionTitle}>How We Help</h2>
              <p className={styles.sectionDescription}>
                Every donation makes a real difference. Here's how your contribution directly{' '}
                <span className={styles.sectionDescriptionLine}>supports families in need.</span>
              </p>
            </div>

            <div className={styles.helpPanel}>
              <div className={styles.helpGrid}>
                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>Emergency Food Parcels</h3>
                    <p className={styles.helpItemText}>
                      Nutritionally balanced packages containing fresh produce, tinned goods, and
                      essentials.
                    </p>
                  </div>
                </div>

                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>No Questions Asked</h3>
                    <p className={styles.helpItemText}>
                      We believe everyone deserves dignity. No forms, no judgement - just support.
                    </p>
                  </div>
                </div>

                <div className={styles.helpItem}>
                  <div className={styles.helpIconBox}>
                    <Check className={styles.helpIcon} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className={styles.helpItemTitle}>100% Transparency</h3>
                    <p className={styles.helpItemText}>
                      Every penny goes directly to purchasing food. Zero administration costs.
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
              <h2 className={styles.sectionTitle}>Stories Of Change</h2>
              <p className={styles.sectionDescription}>
                Your donation doesn't just fill fridges - it restores dignity, stability, and hope{' '}
                <span className={styles.sectionDescriptionLine}>
                  for families across the UK. These are the real stories of people your gift has
                  helped.
                </span>
              </p>
            </div>

            <div className={styles.storyCard}>
              <div className={styles.storyCardBody}>
                <div className={styles.storyImageWrap}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1667354436356-a6264939ff27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW5nbGUlMjBtb3RoZXIlMjBjaGlsZHJlbiUyMGZhbWlseSUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDkyODQwN3ww&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Sarah and her children"
                    className={styles.storyImage}
                  />
                </div>

                <blockquote className={styles.storyQuote}>
                  "I didn't have to choose between feeding my kids and paying the electricity bill
                  anymore."
                </blockquote>

                <p className={styles.storyText}>
                  Sarah is a single mum to two young boys, aged 4 and 6. After losing her job when
                  the nursery she worked at closed, she found herself stuck between a shrinking
                  universal credit payment and rising living costs. For months, she skipped meals to
                  make sure her boys had enough to eat, and struggled to afford even basic
                  essentials like milk and bread.
                </p>

                <div className={styles.storyBadge}>
                  <span className={styles.storyBadgeText}>
                    This story was made possible by a {POUND_SYMBOL}20 monthly donation
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionMuted}`}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionIntro}>
              <h2 className={styles.sectionTitle}>Join Our Community Of Givers</h2>
              <p className={styles.sectionDescription}>
                Thousands of people across the UK are standing with us to end local food poverty.{' '}
                <span className={styles.sectionDescriptionLine}>
                  Here's what some of our monthly donors have to say.
                </span>
              </p>
            </div>

            <div className={styles.testimonialList}>
              <div className={styles.testimonialCard}>
                <div className={styles.testimonialHeader}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1623594675959-02360202d4d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Emma L."
                    className={styles.testimonialAvatar}
                  />
                  <div>
                    <h3 className={styles.testimonialName}>Emma L.</h3>
                    <p className={styles.testimonialMeta}>Monthly donor for 18 months</p>
                  </div>
                </div>
                <blockquote className={styles.testimonialQuote}>
                  "I've been donating {POUND_SYMBOL}20 a month for over a year now, and it's the
                  best thing I do each month. I love that I get a simple update every month,
                  showing exactly how my donation has helped local families."
                </blockquote>
              </div>

              <div className={styles.testimonialCard}>
                <div className={styles.testimonialHeader}>
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1769636930047-4478f12cf430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBwb3J0cmFpdCUyMGNvbmZpZGVudHxlbnwxfHx8fDE3NzQ5MzAzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Mark T."
                    className={styles.testimonialAvatar}
                  />
                  <div>
                    <h3 className={styles.testimonialName}>Mark T.</h3>
                    <p className={styles.testimonialMeta}>Monthly donor for 8 months</p>
                  </div>
                </div>
                <blockquote className={styles.testimonialQuote}>
                  "I grew up in a family that used a food bank when I was a kid, so I know exactly
                  what a difference this makes. The transparency here is amazing - I never have to
                  wonder where my money is going."
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        <section id="donate-form" className={styles.section}>
          <div className={styles.formInner}>
            <div className={styles.sectionIntro}>
              <h2 className={styles.sectionTitle}>Donate Now</h2>
              <p className={styles.formSubtext}>All fields are required.</p>
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

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <h3 className={styles.footerBrandTitle}>ABC Foodbank</h3>
              <p className={styles.footerDescription}>
                Building the infrastructure for food security. A transparent platform connecting
                communities with local resources.
              </p>
              <div className={styles.footerOffice}>
                <h4 className={styles.footerHeading}>Contact Office</h4>
                <p className={styles.footerOfficeText}>Penglais, Aberystwyth SY23 3FL</p>
              </div>
              <div className={styles.socialLinks}>
                <a href="#" className={styles.socialLink} aria-label="Twitter">
                  <Twitter className={styles.socialIcon} />
                </a>
                <a href="#" className={styles.socialLink} aria-label="LinkedIn">
                  <Linkedin className={styles.socialIcon} />
                </a>
                <a href="#" className={styles.socialLink} aria-label="Instagram">
                  <Instagram className={styles.socialIcon} />
                </a>
              </div>
            </div>

            <div>
              <h4 className={styles.footerHeading}>Platform</h4>
              <ul className={styles.footerList}>
                <li>
                  <button type="button" onClick={() => navigate('/home')} className={styles.footerLink}>
                    About Us
                  </button>
                </li>
                <li>
                  <button type="button" onClick={scrollToDonateForm} className={styles.footerLink}>
                    Donate Cash
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/donate/goods')}
                    className={styles.footerLink}
                  >
                    Donate Goods
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/find-foodbank')}
                    className={styles.footerLink}
                  >
                    Find Food Bank
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className={styles.footerHeading}>Resources</h4>
              <ul className={styles.footerList}>
                <li>
                  <button
                    type="button"
                    onClick={() => setLoginModal({ open: true, tab: 'signin' })}
                    className={styles.footerLink}
                  >
                    Sign In
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/home')} className={styles.footerLink}>
                    Volunteer
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/find-foodbank')}
                    className={styles.footerLink}
                  >
                    Support
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className={styles.footerHeading}>Legal</h4>
              <ul className={styles.footerList}>
                <li>
                  <a href="#" className={styles.footerLink}>
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className={styles.footerLink}>
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopyright}>
              Copyright 2026 ABC Foodbank. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </div>
  )
}

