import { useEffect, useMemo, useState } from 'react'
import { donationsAPI, restockAPI, adminAPI } from '@/shared/lib/api'
import { useAuthStore } from '@/app/store/authStore'
import styles from './Supermarket.module.css'

interface DonationRow {
  id: string
  name: string
  quantity: string
}

interface LowStockItem {
  id: number
  name: string
  current_stock: number
  threshold: number
  unit: string
}

interface RestockRequestRow {
  id: number
  inventory_item_id: number
  status: 'open' | 'fulfilled' | 'cancelled'
}

function makeId() {
  return `row_${Date.now()}${Math.random().toString(36).slice(2, 7)}`
}

function createRow(name = ''): DonationRow {
  return { id: makeId(), name, quantity: '' }
}

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0h10" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

export default function Supermarket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  const [rows, setRows] = useState<DonationRow[]>([createRow()])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [requestedItemIds, setRequestedItemIds] = useState<number[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false)
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false)
  const [pageError, setPageError] = useState('')

  const updateRow = (id: string, field: 'name' | 'quantity', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const addRow = () => setRows((prev) => [...prev, createRow()])

  const removeRow = (id: string) => {
    if (!window.confirm('Permanently delete this row? This cannot be undone.')) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const loadLowStock = async () => {
    if (!accessToken) {
      setLowStockItems([])
      return
    }

    setIsLoadingLowStock(true)
    setPageError('')
    try {
      const data = await adminAPI.getLowStockItems(accessToken)
      setLowStockItems(Array.isArray(data) ? (data as LowStockItem[]) : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load low stock items.'
      setPageError(message)
      setLowStockItems([])
    } finally {
      setIsLoadingLowStock(false)
    }
  }

  const loadExistingRequests = async () => {
    if (!accessToken) {
      setRequestedItemIds([])
      return
    }

    setIsLoadingRequests(true)
    try {
      const data = await restockAPI.getRequests(accessToken) as { items?: RestockRequestRow[] }
      const items = Array.isArray(data?.items) ? data.items : []
      const openItemIds = items
        .filter((item) => item.status === 'open')
        .map((item) => item.inventory_item_id)

      setRequestedItemIds(Array.from(new Set(openItemIds)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load restock requests.'
      setPageError((prev) => prev || message)
      setRequestedItemIds([])
    } finally {
      setIsLoadingRequests(false)
    }
  }

  useEffect(() => {
    void loadLowStock()
  }, [accessToken])

  useEffect(() => {
    void loadExistingRequests()
  }, [accessToken])

  const fillFood = (food: string) => {
    const empty = rows.find((r) => r.name.trim() === '')
    if (empty) {
      updateRow(empty.id, 'name', food)
    } else {
      setRows((prev) => [...prev, createRow(food)])
    }
    window.alert(`"${food}" added to the donation form. Please fill in the quantity.`)
    setModalOpen(false)
  }

  const createRestockRequest = async (item: LowStockItem) => {
    if (!accessToken) {
      window.alert('Please sign in again before creating a restock request.')
      return
    }

    try {
      await restockAPI.submitRequest({
        inventory_item_id: item.id,
        current_stock: item.current_stock,
        threshold: item.threshold,
        urgency: item.current_stock === 0 ? 'high' : item.current_stock <= Math.max(1, Math.floor(item.threshold / 2)) ? 'medium' : 'low',
      }, accessToken)

      setRequestedItemIds((prev) => Array.from(new Set([...prev, item.id])))
      await loadExistingRequests()
      window.alert(`Restock request created for ${item.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create restock request.'
      if (message.toLowerCase().includes('already exists')) {
        setRequestedItemIds((prev) => Array.from(new Set([...prev, item.id])))
      }
      window.alert(message)
    }
  }

  const handleSubmit = async () => {
    const filled = rows
      .map((row) => ({
        item_name: row.name.trim(),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.item_name && Number.isFinite(row.quantity) && row.quantity > 0)

    if (!filled.length) {
      window.alert('Please fill in at least one valid item before submitting.')
      return
    }

    setIsSubmittingDonation(true)
    try {
      await donationsAPI.donateGoods({
        donor_name: user?.name || 'Supermarket Donation',
        donor_email: user?.email || 'supermarket@example.com',
        donor_phone: '0000000000',
        notes: 'Submitted from supermarket dashboard',
        items: filled,
      })

      setRows([createRow()])
      window.alert('Donation submitted successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit donation.'
      window.alert(message)
    } finally {
      setIsSubmittingDonation(false)
    }
  }

  const previewText = useMemo(
    () => lowStockItems.slice(0, 4).map((r) => `${r.name} (${r.current_stock})`).join(' | '),
    [lowStockItems],
  )

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {pageError && (
          <div className={styles.warningMessage}>
            <div className={styles.warningText}>
              <span className={styles.infoIcon}>i</span>
              <span>{pageError}</span>
            </div>
          </div>
        )}

        {lowStockItems.length > 0 && (
          <div className={styles.warningMessage} onClick={() => setModalOpen(true)}>
            <div className={styles.warningText}>
              <span className={styles.infoIcon}>i</span>
              <span>Restock needed:</span>
            </div>
            <div className={styles.previewList}>
              {previewText}
              <span>view all</span>
            </div>
          </div>
        )}

        <div className={styles.dashboardCard}>
          <div className={styles.sectionHeader}>
            <h2>Donation Form</h2>
          </div>
          <div className={styles.donationForm}>
            <div className={styles.formRows}>
              {rows.map((row) => (
                <div key={row.id} className={styles.itemRow}>
                  <input
                    type="text"
                    className={styles.itemInput}
                    placeholder="Food name (for example Rice)"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    className={styles.qtyInput}
                    placeholder="Quantity"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                  />
                  <button
                    className={styles.btnDelete}
                    title="Delete item"
                    onClick={() => removeRow(row.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>

            <button className={styles.addRowBtn} onClick={addRow}>
              <span style={{ fontSize: '1.2rem' }}>+</span> Add row
            </button>

            <div className={styles.submitDonation}>
              <button className={styles.btnPrimary} onClick={() => void handleSubmit()} disabled={isSubmittingDonation}>
                {isSubmittingDonation ? 'Submitting...' : 'Submit Donation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Low stock items</h3>
              <button className={styles.closeModal} onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              {isLoadingLowStock && <p>Loading low stock items...</p>}
              {!isLoadingLowStock && lowStockItems.length === 0 && (
                <p>No low stock items right now.</p>
              )}
              {!isLoadingLowStock && lowStockItems.length > 0 && (
                <ul className={styles.restockList}>
                  {lowStockItems.map((item) => {
                    const requested = requestedItemIds.includes(item.id)

                    return (
                      <li key={item.id} className={styles.restockItem} data-food={item.name}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.itemStock}>
                            Current stock: <strong>{item.current_stock}</strong> {item.unit} (threshold {item.threshold})
                          </span>
                        </div>
                        <div className={styles.actionButtons}>
                          <button className={styles.plusBtn} onClick={() => fillFood(item.name)}>+</button>
                          <button
                            className={styles.deleteItemBtn}
                            title="Create restock request"
                            onClick={() => void createRestockRequest(item)}
                            disabled={requested || isLoadingRequests}
                          >
                            {requested ? 'Requested' : isLoadingRequests ? '...' : 'Request'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '1.5rem', textAlign: 'center' }}>
                Click + to add an item to the donation form, or Request to create a restock request.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
