import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFoodBankStore } from '@/store/foodBankStore'
import { useAuthStore } from '@/store/authStore'
import { WEEKLY_COLLECTION_LIMIT } from '@/data/mockData'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import styles from './ApplicationForm.module.css'

interface Selection {
  packageId: number
  qty: number
}

/**
 * ApplicationForm Component
 * 
 * Purpose: Collect application details from users
 * - Select a food bank
 * - Choose week_start date (defaults to Monday of current week)
 * - Select packages and quantities
 * - Submit application
 * 
 * Fields:
 * - food_bank_id: Selected food bank
 * - week_start: Date in YYYY-MM-DD format (Monday of the week)
 * - items[]: Array of {package_id, quantity}
 */
export default function ApplicationForm() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { selectedFoodBank, packages, weeklyCollected, loadUserCollections, loadPackages, applyPackages } = useFoodBankStore()

  const [selections, setSelections] = useState<Record<number, number>>({})
  const [weekStart, setWeekStart] = useState<string>(getMondayOfCurrentWeek())
  const [successModal, setSuccessModal] = useState<{ open: boolean; code: string }>({ open: false, code: '' })
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) loadUserCollections(user.email)
  }, [user, loadUserCollections])

  useEffect(() => {
    if (!selectedFoodBank) {
      return
    }

    loadPackages().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to load packages from server'
      setErrorMsg(message)
    })
  }, [selectedFoodBank?.id, loadPackages])

  if (!selectedFoodBank) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>Please Select a Food Bank First</h2>
          <p>You need to select a food bank before submitting an application.</p>
          <Button onClick={() => navigate('/find-foodbank')}>
            Find Food Bank
          </Button>
        </div>
      </div>
    )
  }

  const remaining = WEEKLY_COLLECTION_LIMIT - weeklyCollected
  const totalQty = Object.values(selections).reduce((s, q) => s + q, 0)
  const selectedCount = Object.keys(selections).length

  const toggleSelect = (pkgId: number) => {
    setSelections((prev) => {
      if (prev[pkgId] !== undefined) {
        const next = { ...prev }
        delete next[pkgId]
        return next
      }
      return { ...prev, [pkgId]: 1 }
    })
  }

  const setQty = (pkgId: number, qty: number) => {
    setSelections((prev) => ({ ...prev, [pkgId]: qty }))
  }

  const handleWeekStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    // Validate format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr === '') {
      setWeekStart(dateStr)
    }
  }

  const handleSubmit = async () => {
    setErrorMsg('')

    // Validation
    if (selectedCount === 0) {
      setErrorMsg('Please select at least one package.')
      return
    }

    if (!weekStart) {
      setErrorMsg('Please select a week start date.')
      return
    }

    // Validate week_start is Monday
    const date = new Date(weekStart)
    const day = date.getDay()
    if (day !== 1) {
      setErrorMsg('Week start date must be a Monday.')
      return
    }

    try {
      setLoading(true)
      const selArray: Selection[] = Object.entries(selections).map(([id, qty]) => ({
        packageId: Number(id),
        qty,
      }))

      // Call store method with week_start parameter (YYYY-MM-DD format)
      const result = await applyPackages(user!.email, selArray, weekStart)
      
      if (result.success) {
        setSelections({})
        setSuccessModal({ open: true, code: result.code! })
      } else {
        setErrorMsg(result.message)
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Application failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Application Form</h1>
        <p className={styles.heroSub}>
          Select the week and packages you need. Up to {WEEKLY_COLLECTION_LIMIT} packages per week.
        </p>
      </div>

      <div className={styles.main}>
        {/* Food bank info bar */}
        <div className={styles.infoBar}>
          <div>
            <h3 className={styles.fbName}>{selectedFoodBank.name}</h3>
            <p className={styles.fbAddr}>{selectedFoodBank.address}</p>
          </div>
          <div className={styles.weeklyBadge}>
            <span className={styles.weeklyNum}>{remaining}</span>
            <span className={styles.weeklyLabel}>Packages Remaining</span>
          </div>
        </div>

        {/* Week selector */}
        <div className={styles.weekSelector}>
          <label htmlFor="week-start" className={styles.label}>
            Week Starting (Monday):
          </label>
          <input
            id="week-start"
            type="date"
            value={weekStart}
            onChange={handleWeekStartChange}
            className={styles.dateInput}
            disabled={loading}
          />
          <p className={styles.hint}>Select Monday of the week you're applying for.</p>
        </div>

        {/* Notice */}
        <div className={styles.notice}>
          Maximum <strong>{WEEKLY_COLLECTION_LIMIT} packages</strong> per week. This week: <strong>{weeklyCollected}</strong>/{WEEKLY_COLLECTION_LIMIT} used.
        </div>

        {/* Error */}
        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        {/* Package grid */}
        <div className={styles.pkgGrid}>
          {packages.map((pkg) => {
            const isSelected = selections[pkg.id] !== undefined
            const qty = selections[pkg.id] ?? 1
            const isLow = pkg.stock <= pkg.threshold

            return (
              <div
                key={pkg.id}
                className={`${styles.pkgCard} ${isSelected ? styles.selected : ''}`}
                onClick={() => toggleSelect(pkg.id)}
              >
                {isSelected && <span className={styles.selectedBadge}>Selected</span>}
                {isLow && <span className={styles.lowBadge}>Low Stock</span>}
                <img src={pkg.image} alt={pkg.name} className={styles.pkgImg} />
                <div className={styles.pkgBody}>
                  <h3 className={styles.pkgName}>{pkg.name}</h3>
                  <p className={styles.pkgDesc}>{pkg.description}</p>
                  <ul className={styles.itemList}>
                    {pkg.items.map((item) => (
                      <li key={item.name}>{item.name} <span>×{item.qty}</span></li>
                    ))}
                  </ul>
                  <div className={styles.stockRow}>
                    <span>Available:</span>
                    <span className={isLow ? styles.stockLow : styles.stockOk}>
                      {pkg.stock} packs
                    </span>
                  </div>
                  {isSelected && (
                    <div className={styles.qtyRow} onClick={(e) => e.stopPropagation()}>
                      <span className={styles.qtyLabel}>Quantity:</span>
                      <div className={styles.qtyControl}>
                        <button 
                          onClick={() => setQty(pkg.id, Math.max(1, qty - 1))}
                          disabled={loading}
                        >
                          −
                        </button>
                        <span>{qty}</span>
                        <button 
                          onClick={() => setQty(pkg.id, Math.min(pkg.stock, qty + 1))}
                          disabled={loading}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky submit bar */}
      <div className={styles.submitBar}>
        <div className={styles.submitSummary}>
          {selectedCount === 0
            ? 'No packages selected'
            : <><strong>{selectedCount}</strong> type(s) · Total <strong>{totalQty}</strong> pack(s)</>
          }
        </div>
        <Button 
          onClick={handleSubmit} 
          size="lg" 
          disabled={selectedCount === 0 || loading}
        >
          {loading ? 'Submitting...' : 'Submit Application →'}
        </Button>
      </div>

      {/* Success modal */}
      <Modal 
        isOpen={successModal.open} 
        onClose={() => { setSuccessModal({ open: false, code: '' }); navigate('/find-foodbank') }} 
        title="Application Successful!"
      >
        <div className={styles.modalContent}>
          <p className={styles.modalLabel}>Your Redemption Code</p>
          <div className={styles.code}>{successModal.code}</div>
          <p className={styles.modalHint}>
            Please present this code at the food bank counter when collecting your package.
          </p>
          <Button
            fullWidth
            size="lg"
            className="mt-4"
            onClick={() => { setSuccessModal({ open: false, code: '' }); navigate('/find-foodbank') }}
          >
            Done
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Helper: Get Monday of current week in YYYY-MM-DD format
 */
function getMondayOfCurrentWeek(): string {
  const today = new Date()
  const date = new Date(today)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is Sunday
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}
