import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import { WEEKLY_COLLECTION_LIMIT } from '@/shared/config/businessRules'
import Button from '@/shared/ui/Button'
import Modal from '@/shared/ui/Modal'
import styles from './FoodPackages.module.css'

interface Selection {
  packageId: number
  qty: number
}

export default function FoodPackages() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { selectedFoodBank, packages, weeklyCollected, loadUserCollections, loadPackages, applyPackages } = useFoodBankStore()

  const [selections, setSelections] = useState<Record<number, number>>({})
  const [codeModal, setCodeModal] = useState<{ open: boolean; code: string }>({ open: false, code: '' })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (user) {
      loadUserCollections(user.email)
    }
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
          <p>You need to select a food bank before viewing packages.</p>
          <Button onClick={() => navigate('/find-foodbank')}>
            Find Food Bank
          </Button>
        </div>
      </div>
    )
  }

  const remaining = WEEKLY_COLLECTION_LIMIT - weeklyCollected

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

  const totalQty = Object.values(selections).reduce((s, q) => s + q, 0)
  const selectedCount = Object.keys(selections).length

  const handleApply = async () => {
    setErrorMsg('')
    if (selectedCount === 0) {
      setErrorMsg('Please select at least one package.')
      return
    }

    const selArray: Selection[] = Object.entries(selections).map(([id, qty]) => ({
      packageId: Number(id), qty,
    }))
    const result = await applyPackages(user!.email, selArray)
    if (result.success) {
      setSelections({})
      setCodeModal({ open: true, code: result.code! })
    } else {
      setErrorMsg(result.message)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Food Packages</h1>
        <p className={styles.heroSub}>Select the packages you need and apply. Up to 3 packages per week.</p>
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

        <div className={styles.notice}>
          Maximum <strong>3 packages</strong> per week. This week: <strong>{weeklyCollected}</strong>/3 used.
        </div>

        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

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
                        <button onClick={() => setQty(pkg.id, Math.max(1, qty - 1))}>−</button>
                        <span>{qty}</span>
                        <button onClick={() => setQty(pkg.id, Math.min(pkg.stock, qty + 1))}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.applyBar}>
        <div className={styles.applySummary}>
          {selectedCount === 0
            ? 'No packages selected'
            : <><strong>{selectedCount}</strong> type(s) · Total <strong>{totalQty}</strong> pack(s)</>
          }
        </div>
        <Button onClick={handleApply} size="lg" disabled={selectedCount === 0}>
          Apply Package →
        </Button>
      </div>

      <Modal isOpen={codeModal.open} onClose={() => { setCodeModal({ open: false, code: '' }); navigate('/find-foodbank') }} title="Application Successful! ">
        <div className={styles.codeModalContent}>
          <p className={styles.codeLabel}>Your Redemption Code</p>
          <div className={styles.code}>{codeModal.code}</div>
          <p className={styles.codeHint}>
            Please present this code at the food bank counter when collecting your package.
          </p>
          <Button
            fullWidth
            size="lg"
            className="mt-4"
            onClick={() => { setCodeModal({ open: false, code: '' }); navigate('/find-foodbank') }}
          >
            Done
          </Button>
        </div>
      </Modal>
    </div>
  )
}
