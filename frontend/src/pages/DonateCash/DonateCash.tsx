import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { donationsAPI } from '@/shared/lib/api/donations'
import { foodBanksAPI } from '@/shared/lib/api/foodBanks'
import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import { Check } from '@/shared/ui/InlineIcons'
import { scrollToId, useHashScroll } from '@/shared/lib/scroll'
import { getEnglishInputValidationProps } from '@/shared/lib/nativeValidation'
import {
  formatCardNumber,
  formatExpiryDate,
  getCashDonationValidationMessage,
} from '@/shared/lib/validation'
import PublicPageShell from '@/shared/ui/PublicPageShell'
import type { FoodBank } from '@/shared/types/foodBanks'
import { copyByMode, galleryCards, gbp, helpCards, heroChecks, presetAmounts } from './copy'
import { ui } from './ui'
import type { CardForm, FormNotice, GallerySlide, GivingMode, InfoCardCopy } from './model'

const createEmptyFormData = (): CardForm => ({ email: '', donorName: '', cardNumber: '', expiryDate: '', securityCode: '' })
// 旧版 CTA 仍以 `type=onetime` 深链跳转,而 page model 和 API 内部使用规范化的 `one_time` 值。
const getGivingMode = (search: string): GivingMode => new URLSearchParams(search).get('type')?.toLowerCase() === 'monthly' ? 'monthly' : 'one_time'
const scrollToSection = (id: string) => scrollToId(id)
const cardholderValidationProps = getEnglishInputValidationProps('Cardholder Name')
const emailValidationProps = getEnglishInputValidationProps('Email Address')
const customAmountValidationProps = getEnglishInputValidationProps('Custom Amount')
const cardNumberValidationProps = getEnglishInputValidationProps('Card Number')
const expiryDateValidationProps = getEnglishInputValidationProps('Expiry Date')
const securityCodeValidationProps = getEnglishInputValidationProps('CVV')
const formatNextChargeDate = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

function SectionIntro({ title, description, descriptionExtraLine }: { title: string; description: string; descriptionExtraLine?: string }) {
  return <div className={ui.sectionIntro}><h2 className={ui.sectionTitle}>{title}</h2><p className={ui.sectionDescription}>{description}{descriptionExtraLine ? <span className={ui.sectionDescriptionLine}>{descriptionExtraLine}</span> : null}</p></div>
}
function CheckListItem({ text }: { text: string }) {
  return (
    <div className={ui.checkItem}>
      <Check className={ui.checkIcon} strokeWidth={3} />
      <span className={ui.checkText}>{text}</span>
    </div>
  )
}
function HelpItemCard({ item }: { item: InfoCardCopy }) { return <div className={ui.helpItem}><div className={ui.helpIconBox}><Check className={ui.helpIcon} strokeWidth={3} /></div><div><h3 className={ui.helpItemTitle}>{item.title}</h3><p className={ui.helpItemText}>{item.description}</p></div></div> }
function GalleryCard({ item }: { item: GallerySlide }) { return <div className={ui.galleryCard}><ImageWithFallback src={item.image} alt={item.alt} className={ui.galleryImage} draggable={false} /><div className={ui.galleryOverlay}><p className={ui.galleryTitle}>{item.title}</p></div></div> }
function FormField({ id, label, required = false, children }: { id: string; label: string; required?: boolean; children: ReactNode }) { return <div><label htmlFor={id} className={ui.label}>{label}{required ? <span className={ui.required}>*</span> : null}</label>{children}</div> }
function FeedbackBanner({ feedback }: { feedback: FormNotice }) { return <div className={`${ui.feedback} ${feedback.type === 'success' ? ui.feedbackSuccess : ui.feedbackError}`} role={feedback.type === 'error' ? 'alert' : 'status'} aria-live="polite">{feedback.message}</div> }

export default function DonateCash() {
  const navigate = useNavigate()
  const location = useLocation()
  const donationMode = getGivingMode(location.search)
  const isMonthlyDonation = donationMode === 'monthly'
  const formCopy = copyByMode[donationMode]
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [foodBanks, setFoodBanks] = useState<FoodBank[]>([])
  const [selectedFoodBankId, setSelectedFoodBankId] = useState('')
  const [foodBankLoadError, setFoodBankLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitFeedback, setFormNotice] = useState<FormNotice | null>(null)
  const [formData, setFormData] = useState<CardForm>(createEmptyFormData)

  useHashScroll({ enabled: location.hash === '#donate-form' })

  useEffect(() => {
    // 首页和支持页的 CTA 可在落地前通过查询字符串预选金额和通知路由。
    const searchParams = new URLSearchParams(location.search)
    const amountParam = searchParams.get('amount')
    const parsedAmount = amountParam ? Number.parseFloat(amountParam) : Number.NaN
    const foodBankIdParam = searchParams.get('foodBankId')
    const parsedFoodBankId = foodBankIdParam ? Number.parseInt(foodBankIdParam, 10) : Number.NaN

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSelectedAmount(null)
      setCustomAmount('')
    } else if (presetAmounts.includes(parsedAmount)) {
      setSelectedAmount(parsedAmount)
      setCustomAmount('')
    } else {
      setSelectedAmount(null)
      setCustomAmount(parsedAmount.toString())
    }

    if (Number.isInteger(parsedFoodBankId) && parsedFoodBankId > 0) {
      setSelectedFoodBankId(String(parsedFoodBankId))
    }
  }, [location.search])

  useEffect(() => {
    let isCancelled = false

    const loadFoodBanks = async () => {
      try {
        const response = await foodBanksAPI.getFoodBanks()
        if (isCancelled) return
        setFoodBanks(
          [...(response.items ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })),
        )
        setFoodBankLoadError('')
      } catch {
        if (isCancelled) return
        // 选择器仅决定哪个团队接收通知邮件,
        // 因此加载失败时捐款仍会回退到平台默认路由。
        setFoodBankLoadError('We could not load food bank contacts right now. Your donation will still be submitted to the platform team.')
      }
    }

    void loadFoodBanks()

    return () => { isCancelled = true }
  }, [])

  const updateFormField = <K extends keyof CardForm>(field: K, value: CardForm[K]) => setFormData((current) => ({ ...current, [field]: value }))
  const updateGivingMode = (nextMode: GivingMode) => {
    if (nextMode === donationMode) return
    const searchParams = new URLSearchParams(location.search)
    searchParams.set('type', nextMode === 'monthly' ? 'monthly' : 'onetime')
    const query = searchParams.toString()
    navigate({ pathname: location.pathname, search: query ? `?${query}` : '', hash: '#donate-form' }, { replace: false })
  }
  const resetForm = () => { setSelectedAmount(null); setCustomAmount(''); setFormData(createEmptyFormData()) }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormNotice(null)
    const finalAmount = selectedAmount ?? Number.parseFloat(customAmount)
    const validationMessage = getCashDonationValidationMessage(finalAmount, formData)
    if (validationMessage) return void setFormNotice({ type: 'error', message: validationMessage })

    setIsSubmitting(true)
    try {
      const donation = await donationsAPI.donateCash({
        donor_name: formData.donorName.trim(),
        donor_email: formData.email.trim(),
        food_bank_id: selectedFoodBankId ? Number(selectedFoodBankId) : undefined,
        amount_pence: Math.round(finalAmount * 100),
        donation_frequency: donationMode,
        card_last4: formData.cardNumber.replace(/\D/g, '').slice(-4),
      })
      const amountLabel = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(finalAmount)
      const referenceLine = donation.payment_reference ? ` Payment reference: ${donation.payment_reference}.` : ''
      const subscriptionLine = donation.subscription_reference ? ` Subscription reference: ${donation.subscription_reference}.` : ''
      const nextChargeLine = donation.next_charge_date ? ` Next charge date: ${formatNextChargeDate(donation.next_charge_date)}.` : ''
      resetForm()
      setFormNotice({
        type: 'success',
        message: isMonthlyDonation
          ? `Your monthly donation of ${amountLabel} has been set up.${subscriptionLine}${referenceLine}${nextChargeLine}`
          : `Thank you for your one-time donation of ${amountLabel}.${referenceLine}`,
      })
    } catch (error) {
      setFormNotice({ type: 'error', message: error instanceof Error ? error.message : 'Failed to submit donation. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicPageShell mainClassName={ui.main}>
      <div className={ui.page}>
        <section className={ui.section}>
          <div className={`${ui.sectionInner} ${ui.heroInner}`}>
            <h1 className={ui.heroTitle}>Support a local food bank</h1>
            <p className={ui.heroText}>Choose a one-off or monthly amount. Pick which food bank receives the donation, or leave it as the platform team for the central queue.</p>
            <div className={ui.checkList}>
              {heroChecks.map((benefit) => <CheckListItem key={benefit} text={benefit} />)}
            </div>
            <div className={ui.heroImageWrap}><ImageWithFallback src="https://images.unsplash.com/photo-1738618141224-815f18b8e469?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwYmFuayUyMHNoZWx2ZXMlMjBvcmdhbml6ZWQlMjBkb25hdGlvbnN8ZW58MXx8fHwxNzc0OTQwMDk4fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Food bank donation" className={ui.heroImage} /></div>
            <button type="button" onClick={() => scrollToSection('donate-form')} className={ui.primaryButton}>Donate Cash</button>
          </div>
        </section>

        <section className={`${ui.section} ${ui.sectionMuted}`}>
          <div className={ui.sectionInner}>
            <SectionIntro title="Where your donation goes" description="Cash donations are recorded by the platform and routed to a food bank of your choice." />
            <div className={ui.helpPanel}><div className={ui.helpGrid}>{helpCards.map((item) => <HelpItemCard key={item.title} item={item} />)}</div></div>
            <div className={ui.galleryGrid}>{galleryCards.map((item) => <GalleryCard key={item.title} item={item} />)}</div>
          </div>
        </section>

        <section id="donate-form" className={ui.section}>
          <div className={ui.formInner}>
            <div className={`${ui.sectionIntro} ${ui.formSectionIntro}`}>
              <h2 className={ui.sectionTitle}>{formCopy.heading}</h2>
              <div className={ui.modeSwitch} role="tablist" aria-label="Donation type">
                {[
                  { mode: 'monthly' as const, label: 'Monthly Giving', selected: isMonthlyDonation },
                  { mode: 'one_time' as const, label: 'One-Time Gift', selected: !isMonthlyDonation },
                ].map(({ mode, label, selected }) => (
                  <button key={mode} type="button" role="tab" aria-selected={selected} className={`${ui.modeButton} ${selected ? ui.modeButtonActive : ''}`} onClick={() => updateGivingMode(mode)}>{label}</button>
                ))}
              </div>
              <p className={ui.formSubtext}>{formCopy.subtext}</p>
            </div>
            <div className={ui.formCard}>
              <form onSubmit={handleSubmit} className={ui.formStack}>
                <div className={ui.formBlock}>
                  <FormField id="foodBank" label="Notification Route">
                    <>
                      <select id="foodBank" value={selectedFoodBankId} onChange={(event) => setSelectedFoodBankId(event.target.value)} className={ui.input}>
                        <option value="">Platform Team (default)</option>
                        {foodBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                      </select>
                      <p className={foodBankLoadError ? ui.fieldHintError : ui.fieldHint}>
                        {foodBankLoadError || 'Optional: choose a food bank if you want the donation notification email routed to that local team.'}
                      </p>
                    </>
                  </FormField>
                  <div className={ui.formGrid}>
                    <FormField id="donorName" label="Cardholder Name " required><input id="donorName" type="text" value={formData.donorName} onChange={(event) => updateFormField('donorName', event.target.value)} required className={ui.input} {...cardholderValidationProps} /></FormField>
                    <FormField id="email" label="Email Address " required><input id="email" type="email" value={formData.email} onChange={(event) => updateFormField('email', event.target.value)} required className={ui.input} {...emailValidationProps} /></FormField>
                  </div>
                </div>
                <div className={ui.formBlock}>
                  <div>
                    <label className={ui.label}>Donation Amount <span className={ui.required}>*</span></label>
                    <div className={ui.amountGrid}>
                      {presetAmounts.map((amount) => (
                        <button key={amount} type="button" onClick={() => { setSelectedAmount(amount); setCustomAmount('') }} className={`${ui.amountButton} ${selectedAmount === amount ? ui.amountButtonActive : ''}`}>
                          {gbp}{amount}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FormField id="customAmount" label={`Custom Amount (${gbp})`}><input id="customAmount" type="number" placeholder="Enter amount" value={customAmount} onChange={(event) => { setCustomAmount(event.target.value); setSelectedAmount(null) }} className={ui.input} {...customAmountValidationProps} /></FormField>
                </div>
                <div className={ui.formBlock}>
                  <FormField id="cardNumber" label="Card Number " required><input id="cardNumber" type="text" placeholder="1234 5678 9012 3456" value={formData.cardNumber} onChange={(event) => updateFormField('cardNumber', formatCardNumber(event.target.value))} required className={ui.input} {...cardNumberValidationProps} /></FormField>
                  <div className={ui.formGrid}>
                    <FormField id="expiryDate" label="Expiry Date " required><input id="expiryDate" type="text" placeholder="MM/YY" value={formData.expiryDate} onChange={(event) => updateFormField('expiryDate', formatExpiryDate(event.target.value))} required className={ui.input} {...expiryDateValidationProps} /></FormField>
                    <FormField id="securityCode" label="CVV " required><input id="securityCode" type="text" placeholder="123" value={formData.securityCode} onChange={(event) => updateFormField('securityCode', event.target.value.replace(/\D/g, '').slice(0, 4))} required className={ui.input} {...securityCodeValidationProps} /></FormField>
                  </div>
                </div>
                {submitFeedback ? <FeedbackBanner feedback={submitFeedback} /> : null}
                <button type="submit" disabled={isSubmitting} className={ui.submitButton}>{isSubmitting ? 'Submitting...' : formCopy.submitLabel}</button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  )
}
