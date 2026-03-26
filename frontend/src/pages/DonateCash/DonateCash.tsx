import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { isValidEmail, isValidCardNumber, isValidExpiry, formatCardNumber, formatExpiryDate } from '@/utils/validation'
import type { CashDonationForm, FormErrors } from '@/types'
import styles from './DonateCash.module.css'

const PRESET_AMOUNTS = [10, 20, 50, 100]

export default function DonateCash() {
  const navigate = useNavigate()
  const [form, setForm] = useState<CashDonationForm>({
    email: '', amount: '', cardholderName: '', cardNumber: '', expiryDate: '', cvv: '',
  })
  const [errors, setErrors] = useState<FormErrors<CashDonationForm>>({})
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)

  const set = (field: keyof CashDonationForm, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }))

  const validate = (): boolean => {
    const e: FormErrors<CashDonationForm> = {}
    if (!isValidEmail(form.email)) e.email = 'Please enter a valid email address.'
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Please enter a valid donation amount.'
    if (!form.cardholderName.trim()) e.cardholderName = 'Cardholder name is required.'
    if (!isValidCardNumber(form.cardNumber)) e.cardNumber = 'Card number must be 16 digits.'
    if (!isValidExpiry(form.expiryDate)) e.expiryDate = 'Format must be MM/YY.'
    if (form.cvv.length < 3) e.cvv = 'CVV must be 3–4 digits.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setSuccessModal(true)
  }

  return (
    <div className={styles.pageWrap}>
      {/* Left panel */}
      <div className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <span className={styles.leftTag}>Make a Difference</span>
          <h1 className={styles.leftTitle}>
            Your Gift <span>Feeds Families</span>
          </h1>
          <p className={styles.leftDesc}>
            Every pound donated goes directly to purchasing food for local families in need.
            No admin fees — 100% impact.
          </p>
          <ul className={styles.impactList}>
            <li>£10 provides a full food package for one person</li>
            <li>£20 feeds a family for a week</li>
            <li>£50 helps stock a food bank for a day</li>
          </ul>
        </div>
      </div>

      {/* Right panel - form */}
      <div className={styles.rightPanel}>
        <h2 className={styles.formTitle}>Donate Now</h2>
        <p className={styles.formSub}>All fields are required.</p>

        {/* Email */}
        <section className={styles.formSection}>
          <div className={styles.sectionLabel}>Your Details</div>
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            error={errors.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </section>

        {/* Amount */}
        <section className={styles.formSection}>
          <div className={styles.sectionLabel}>Donation Amount</div>
          <div className={styles.amountGrid}>
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                className={`${styles.amountChip} ${form.amount === a ? styles.amountChipActive : ''}`}
                onClick={() => set('amount', a)}
              >
                £{a}
              </button>
            ))}
          </div>
          <Input
            label="Custom Amount (£)"
            type="number"
            placeholder="Enter amount"
            value={form.amount === '' ? '' : String(form.amount)}
            error={errors.amount}
            onChange={(e) => set('amount', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </section>

        {/* Payment */}
        <section className={styles.formSection}>
          <div className={styles.sectionLabel}>Payment Details</div>
          <div className={styles.fieldStack}>
            <Input
              label="Cardholder Name"
              placeholder="Name on card"
              value={form.cardholderName}
              error={errors.cardholderName}
              onChange={(e) => set('cardholderName', e.target.value)}
            />
            <div className={styles.cardInputWrap}>
              <Input
                label="Card Number"
                placeholder="1234 5678 9012 3456"
                value={form.cardNumber}
                error={errors.cardNumber}
                onChange={(e) => set('cardNumber', formatCardNumber(e.target.value))}
                maxLength={19}
              />
              <span className={styles.cardIcon}></span>
            </div>
            <div className={styles.formRow}>
              <Input
                label="Expiry Date (MM/YY)"
                placeholder="MM/YY"
                value={form.expiryDate}
                error={errors.expiryDate}
                onChange={(e) => set('expiryDate', formatExpiryDate(e.target.value))}
                maxLength={5}
              />
              <Input
                label="Security Code (CVV)"
                type="password"
                placeholder="CVV"
                value={form.cvv}
                error={errors.cvv}
                onChange={(e) => set('cvv', e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
        </section>

        <Button
          fullWidth
          size="lg"
          variant="amber"
          loading={loading}
          onClick={handleSubmit}
          className="mt-2"
        >
          {loading ? 'Processing…' : form.amount ? `Donate £${form.amount}` : 'Donate'}
        </Button>
        <p className={styles.secureNote}>Secured by 256-bit SSL encryption</p>
      </div>

      {/* Success modal */}
      <Modal isOpen={successModal} onClose={() => { setSuccessModal(false); navigate('/') }}>
        <div className={styles.successContent}>
          <span className={styles.successIcon}></span>
          <h3 className={styles.successTitle}>Thank You for Your Generosity!</h3>
          <p className={styles.successDesc}>
            Your donation of <strong>£{form.amount}</strong> has been received.
            A confirmation will be sent to <strong>{form.email}</strong>.
          </p>
          <Button fullWidth size="lg" className="mt-5" onClick={() => { setSuccessModal(false); navigate('/') }}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  )
}
