import { useState } from 'react'
import styles from './Supermarket.module.css'

interface DonationRow {
  id: string
  name: string
  quantity: string
}

interface RestockItem {
  id: string
  food: string
  stock: number
  threshold: number
}

const INITIAL_RESTOCK: RestockItem[] = [
  { id: '1', food: 'Apples',           stock: 2, threshold: 5 },
  { id: '2', food: 'Milk',             stock: 1, threshold: 5 },
  { id: '3', food: 'Whole wheat bread', stock: 3, threshold: 5 },
  { id: '4', food: 'Carrots',          stock: 0, threshold: 5 },
]

function makeId() { return 'row_' + Date.now() + Math.random().toString(36).slice(2, 7) }
function createRow(name = ''): DonationRow { return { id: makeId(), name, quantity: '' } }

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0h10"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
)

export default function Supermarket() {
  const [rows,         setRows]         = useState<DonationRow[]>([createRow()])
  const [restock,      setRestock]      = useState<RestockItem[]>(INITIAL_RESTOCK)
  const [modalOpen,    setModalOpen]    = useState(false)

  // ── row helpers ──────────────────────────────────────────────
  const updateRow = (id: string, field: 'name' | 'quantity', value: string) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))

  const addRow = () => setRows((prev) => [...prev, createRow()])

  const removeRow = (id: string) => {
    if (!confirm('Permanently delete this row? This cannot be undone.')) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  // ── restock modal helpers ─────────────────────────────────────
  const fillFood = (food: string) => {
    const empty = rows.find((r) => r.name.trim() === '')
    if (empty) {
      updateRow(empty.id, 'name', food)
    } else {
      setRows((prev) => [...prev, createRow(food)])
    }
    alert(`"${food}" added to donation form. Please fill quantity.`)
    setModalOpen(false)
  }

  const deleteRestock = (id: string) => {
    if (!confirm('Remove this item from the list?')) return
    setRestock((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = () => {
    const filled = rows.filter((r) => r.name.trim() && r.quantity)
    if (!filled.length) { alert('Please fill in at least one item before submitting.'); return }
    alert('Donation submitted (demo)')
  }

  const previewText = restock.map((r) => `${r.food} (${r.stock})`).join(' · ')

  return (
    <div className={styles.page}>
      {/* container */}
      <div className={styles.container}>

        {/* ── Warning banner ── */}
        {restock.length > 0 && (
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

        {/* ── Donation Form card ── */}
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
                    placeholder="Food name (e.g. Rice)"
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
              <button className={styles.btnPrimary} onClick={handleSubmit}>
                Submit Donation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Restock modal ── */}
      {modalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setModalOpen(false)}
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Low stock items</h3>
              <button className={styles.closeModal} onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <ul className={styles.restockList}>
                {restock.map((item) => (
                  <li key={item.id} className={styles.restockItem} data-food={item.food}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{item.food}</span>
                      <span className={styles.itemStock}>
                        Current stock: <strong>{item.stock}</strong> (below {item.threshold} items)
                      </span>
                    </div>
                    <div className={styles.actionButtons}>
                      <button className={styles.plusBtn} onClick={() => fillFood(item.food)}>+</button>
                      <button className={styles.deleteItemBtn} title="Remove this item" onClick={() => deleteRestock(item.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '1.5rem', textAlign: 'center' }}>
                Click + to add to form; click delete button to remove this item from the list.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
