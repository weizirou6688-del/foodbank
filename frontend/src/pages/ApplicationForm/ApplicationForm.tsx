import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import { WEEKLY_COLLECTION_LIMIT } from '@/shared/config/businessRules'
import Button from '@/shared/ui/Button'
import Modal from '@/shared/ui/Modal'
import styles from './ApplicationForm.module.css'

interface Selection {
  packageId: number
  qty: number
}

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
    if (user) {
      loadUserCollections(user.email, weekStart)
    }
  }, [user, weekStart, loadUserCollections])

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

  if (selectedFoodBank.id <= 0 || selectedFoodBank.systemMatched === false) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>Online Application Unavailable</h2>
          <p>This food bank can be viewed in search results but is not connected to online applications yet.</p>
          <Button onClick={() => navigate('/find-foodbank')}>
            Back to Search
          </Button>
        </div>
      </div>
    )
  }

  const remaining = Math.max(0, WEEKLY_COLLECTION_LIMIT - weeklyCollected)
  const totalQty = Object.values(selections).reduce((s, q) => s + q, 0)
  const selectedCount = Object.keys(selections).length

  if (packages.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>No Packages Available Right Now</h2>
          <p>This food bank is connected, but there are no online food packages available for application at the moment.</p>
          <Button onClick={() => navigate('/find-foodbank')}>
            Back to Search
          </Button>
        </div>
      </div>
    )
  }

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
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr === '') {
      setWeekStart(dateStr)
    }
  }

  const handleSubmit = async () => {
    setErrorMsg('')

    if (selectedCount === 0) {
      setErrorMsg('Please select at least one package.')
      return
    }

    if (!weekStart) {
      setErrorMsg('Please select a week start date.')
      return
    }

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
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Application Form</h1>
        <p className={styles.heroSub}>
          Select the week and packages you need. Up to {WEEKLY_COLLECTION_LIMIT} packages per week.
        </p>
      </div>

      <div className={styles.main}>
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
          <p className={styles.hint}>Select Monday of the week you are applying for.</p>
        </div>

        <div className={styles.notice}>
          Maximum <strong>{WEEKLY_COLLECTION_LIMIT} packages</strong> per week. This week: <strong>{weeklyCollected}</strong>/{WEEKLY_COLLECTION_LIMIT} used.
        </div>

        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        <div className={styles.pkgGrid}>
          {packages.map((pkg) => {
            const isSelected = selections[pkg.id] !== undefined
            const qty = selections[pkg.id] ?? 1
            const isLow = pkg.stock <= pkg.threshold
            const isOutOfStock = pkg.stock <= 0

            return (
              <div
                key={pkg.id}
                className={`${styles.pkgCard} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                  if (!isOutOfStock) {
                    toggleSelect(pkg.id)
                  }
                }}
              >
                {isSelected && <span className={styles.selectedBadge}>Selected</span>}
                {isLow && <span className={styles.lowBadge}>Low Stock</span>}
                <img src={pkg.image} alt={pkg.name} className={styles.pkgImg} />
                <div className={styles.pkgBody}>
                  <h3 className={styles.pkgName}>{pkg.name}</h3>
                  <p className={styles.pkgDesc}>{pkg.description}</p>
                  <ul className={styles.itemList}>
                    {pkg.items.map((item) => (
                      <li key={item.name}>{item.name} <span>x{item.qty}</span></li>
                    ))}
                  </ul>
                  <div className={styles.stockRow}>
                    <span>Available:</span>
                    <span className={isLow ? styles.stockLow : styles.stockOk}>
                      {pkg.stock} packs
                    </span>
                  </div>
                  {isOutOfStock && (
                    <div className={styles.errorBanner}>This package is currently out of stock.</div>
                  )}
                  {isSelected && (
                    <div className={styles.qtyRow} onClick={(e) => e.stopPropagation()}>
                      <span className={styles.qtyLabel}>Quantity:</span>
                      <div className={styles.qtyControl}>
                        <button
                          onClick={() => setQty(pkg.id, Math.max(1, qty - 1))}
                          disabled={loading}
                        >
                          -
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

      <div className={styles.submitBar}>
        <div className={styles.submitSummary}>
          {selectedCount === 0
            ? 'No packages selected'
            : <><strong>{selectedCount}</strong> type(s) | Total <strong>{totalQty}</strong> pack(s)</>
          }
        </div>
        <Button
          onClick={handleSubmit}
          size="lg"
          disabled={selectedCount === 0 || loading}
        >
          {loading ? 'Submitting...' : 'Submit Application ->'}
        </Button>
      </div>

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

function getMondayOfCurrentWeek(): string {
  const today = new Date()
  const date = new Date(today)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}
