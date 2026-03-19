import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { isValidEmail } from '@/utils/validation'
import type { GoodsDonationItem, GoodsDonationForm } from '@/types'
import styles from './DonateGoods.module.css'

const ACCEPTED_ITEMS = ['Canned goods', 'Rice & Pasta', 'Breakfast cereal', 'Cooking oil', 'Toiletries', 'Baby food', 'UHT milk', 'Non-perishables']
function createItem(name = ''): GoodsDonationItem { return { id: String(Date.now() + Math.random()), name, quantity: 1 } }

interface FieldProps { label: string; placeholder?: string; type?: string; value: string; error?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string }
function Field({ label, placeholder, type = 'text', value, error, onChange, className }: FieldProps) {
  return (
    <div className={`${styles.inputGroup} ${className ?? ''}`}>
      <label className={styles.inputLabel}>{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        className={`${styles.inputField} ${error ? styles.hasError : ''}`}
        onFocus={(e) => { if (!error) e.target.style.borderColor = '#F7DC6F' }}
        onBlur={(e)  => { if (!error) e.target.style.borderColor = '#E8E8E8' }} />
      {error && <span className={styles.inputError}>{error}</span>}
    </div>
  )
}

export default function DonateGoods() {
  const [searchParams] = useSearchParams()
  const prefilledFood = searchParams.get('food') ?? ''

  const [form, setForm] = useState<GoodsDonationForm>({ donorName: '', email: '', phone: '', notes: '', items: [createItem(prefilledFood)] })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)

  const updateDonor = (field: keyof Omit<GoodsDonationForm, 'items'>, value: string) => setForm((f) => ({ ...f, [field]: value }))
  const updateItem  = (id: string, field: keyof GoodsDonationItem, value: string | number) => setForm((f) => ({ ...f, items: f.items.map((i) => i.id === id ? { ...i, [field]: value } : i) }))
  const addItem     = () => setForm((f) => ({ ...f, items: [...f.items, createItem()] }))
  const removeItem  = (id: string) => setForm((f) => ({ ...f, items: f.items.filter((i) => i.id !== id) }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.donorName.trim())      e.donorName = 'Name is required.'
    if (!isValidEmail(form.email))   e.email     = 'Please enter a valid email.'
    if (!form.phone.trim())          e.phone     = 'Phone number is required.'
    let itemsOk = true
    form.items.forEach((item, idx) => {
      if (!item.name.trim()) { e[`item_${idx}_name`] = 'Item name is required.'; itemsOk = false }
      if (item.quantity < 1) { e[`item_${idx}_qty`]  = 'Quantity must be at least 1.'; itemsOk = false }
    })
    if (!itemsOk) e.items = 'Please complete all item fields.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    setSuccessModal(true)
  }

  const handleDone = () => { setSuccessModal(false); setForm({ donorName:'', email:'', phone:'', notes:'', items:[createItem()] }); setErrors({}) }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Donate Goods</h1>
        <p className={styles.pageSub}>Register your food donation and help families in need.</p>
      </div>

      <div className={styles.main}>
        <div className={styles.formCard}>
          <h2 className={styles.cardTitle}>Register Your Donation</h2>
          <p className={styles.cardSub}>Fill in your details and list the items you wish to donate. You can add multiple items.</p>

          <div className={styles.acceptsBox}>
            <h4 className={styles.acceptsTitle}>We Accept</h4>
            <div className={styles.acceptsTags}>
              {ACCEPTED_ITEMS.map((item) => <span key={item} className={styles.tag}>{item}</span>)}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Your Details</div>
            <div className={styles.formRow}>
              <Field label="Full Name" placeholder="Your full name" value={form.donorName} error={errors.donorName} onChange={(e) => updateDonor('donorName', e.target.value)} />
              <Field label="Email" type="email" placeholder="you@example.com" value={form.email} error={errors.email} onChange={(e) => updateDonor('email', e.target.value)} />
            </div>
            <Field label="Phone Number" type="tel" placeholder="+44 7XXX XXXXXX" value={form.phone} error={errors.phone} onChange={(e) => updateDonor('phone', e.target.value)} />
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Donation Items</div>
            <div className={styles.itemsHeader}>
              <span>Food Item Name</span><span>Quantity</span><span />
            </div>
            {form.items.map((item, idx) => (
              <div key={item.id} className={styles.itemRow}>
                <input className={`${styles.itemInput} ${errors[`item_${idx}_name`] ? styles.inputErr : ''}`}
                  placeholder="e.g. Canned Tomatoes" value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = '#F7DC6F' }}
                  onBlur={(e)  => { e.target.style.borderColor = errors[`item_${idx}_name`] ? '#E63946' : '#E8E8E8' }} />
                <input className={`${styles.qtyInput} ${errors[`item_${idx}_qty`] ? styles.inputErr : ''}`}
                  type="number" min="1" value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))} />
                <button className={styles.removeBtn} onClick={() => removeItem(item.id)} disabled={form.items.length === 1} title="Remove item">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {errors.items && <p className={styles.itemsError}>{errors.items}</p>}
            <button className={styles.addBtn} onClick={addItem}>
              <Plus size={15} /> Add Another Item
            </button>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Additional Notes</div>
            <textarea className={styles.textarea} placeholder="e.g. best-before dates, collection availability…"
              value={form.notes} onChange={(e) => updateDonor('notes', e.target.value)} />
          </div>

          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Donation'}
          </button>
        </div>
      </div>

      <Modal isOpen={successModal} onClose={handleDone}>
        <div className={styles.successContent}>
          <h3 className={styles.successTitle}>Donation Registered!</h3>
          <p className={styles.successDesc}>
            Thank you, <strong>{form.donorName}</strong>!<br />
            Your donation of <strong>{form.items.length}</strong> item type(s) has been recorded.
            We'll be in touch at <strong>{form.email}</strong>.
          </p>
          <button className={styles.doneBtn} onClick={handleDone}>Done</button>
        </div>
      </Modal>
    </div>
  )
}
