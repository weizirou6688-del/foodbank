import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { donationsAPI, adminAPI } from '@/shared/lib/api'
import { useAuthStore } from '@/app/store/authStore'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { LowStockBanner, LowStockModal, type SupermarketLowStockItem } from './components/LowStockModal'

interface DonationRow {
  id: string
  foodName: string
  quantity: string
  inventoryItemId: number | null
}

interface LowStockItem {
  id: number
  name: string
  current_stock: number
  threshold: number
  unit: string
}

function makeId() {
  return `row_${Date.now()}${Math.random().toString(36).slice(2, 7)}`
}

function createRow(foodName = '', inventoryItemId: number | null = null): DonationRow {
  return { id: makeId(), foodName, quantity: '', inventoryItemId }
}

export default function Supermarket() {
  const accessToken = useAuthStore((state) => state.accessToken)

  const [rows, setRows] = useState<DonationRow[]>([createRow()])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [dismissedItemIds, setDismissedItemIds] = useState<number[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBannerVisible, setIsBannerVisible] = useState(true)
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false)
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')

  const updateRow = (id: string, field: 'foodName' | 'quantity', value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row
        }

        if (field === 'foodName') {
          return { ...row, foodName: value, inventoryItemId: null }
        }

        return { ...row, [field]: value }
      }),
    )
    if (formError) {
      setFormError('')
    }
  }

  const addRow = () => {
    setRows((prev) => [...prev, createRow()])
    if (formError) {
      setFormError('')
    }
  }

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length === 1) return [createRow()]
      return prev.filter((row) => row.id !== id)
    })
    if (formError) {
      setFormError('')
    }
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

  useEffect(() => {
    void loadLowStock()
  }, [accessToken])

  useEffect(() => {
    if (lowStockItems.length > 0) {
      setIsBannerVisible(true)
    }
    setDismissedItemIds((prev) => prev.filter((id) => lowStockItems.some((item) => item.id === id)))
  }, [lowStockItems])

  const visibleLowStockItems = useMemo(
    () => lowStockItems.filter((item) => !dismissedItemIds.includes(item.id)),
    [dismissedItemIds, lowStockItems],
  )

  const fillFood = (item: SupermarketLowStockItem) => {
    setRows((prev) => {
      const emptyRow = prev.find((row) => row.foodName.trim() === '')
      if (emptyRow) {
        return prev.map((row) =>
          row.id === emptyRow.id
            ? { ...row, foodName: item.name, inventoryItemId: item.id }
            : row,
        )
      }
      return [...prev, createRow(item.name, item.id)]
    })
    setFormError('')
    setIsModalOpen(false)
  }

  const dismissLowStockItem = (itemId: number) => {
    setDismissedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (!accessToken) {
      setFormError('Please log in again before submitting restock items.')
      return
    }

    const invalidRowIndex = rows.findIndex((row) => {
      const hasAnyValue = row.foodName.trim() !== '' || row.quantity.trim() !== ''
      if (!hasAnyValue) {
        return false
      }

      const quantity = Number(row.quantity)
      return !row.foodName.trim() || !Number.isFinite(quantity) || quantity <= 0
    })

    if (invalidRowIndex !== -1) {
      setFormError(`Row ${invalidRowIndex + 1}: enter an inventory item name and a quantity greater than 0.`)
      return
    }

    const filled = rows
      .map((row) => ({
        inventory_item_id: row.inventoryItemId ?? undefined,
        item_name: row.foodName.trim() || undefined,
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.item_name && Number.isFinite(row.quantity) && row.quantity > 0)

    if (!filled.length) {
      setFormError('Add at least one item before submitting your restock.')
      return
    }

    setIsSubmittingDonation(true)
    try {
      await donationsAPI.submitSupermarketDonation(
        {
          notes: 'Submitted from supermarket dashboard',
          items: filled,
        },
        accessToken,
      )

      setRows([createRow()])
      setDismissedItemIds([])
      await loadLowStock()
      window.alert('Restock submitted successfully. Inventory and low-stock status have been updated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit restock.'
      setFormError(message)
    } finally {
      setIsSubmittingDonation(false)
    }
  }

  const modalItems: SupermarketLowStockItem[] = visibleLowStockItems.map((item) => ({
    id: item.id,
    name: item.name,
    currentStock: item.current_stock,
    threshold: item.threshold,
    unit: item.unit,
  }))

  return (
    <div
      className="home-figma-font flex min-h-screen flex-col"
      style={{ backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <Header />

      <main className="flex-1 py-12" style={{ backgroundColor: '#F2F4F3' }}>
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-lg bg-white p-12 shadow-sm">
            {isBannerVisible && visibleLowStockItems.length > 0 && (
              <LowStockBanner
                items={modalItems}
                onViewFullList={() => setIsModalOpen(true)}
                onDismiss={() => setIsBannerVisible(false)}
              />
            )}

            {pageError && (
              <div
                className="mb-6 rounded-lg border px-4 py-3 text-[14px]"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#B91C1C' }}
              >
                {pageError}
              </div>
            )}

            <div className="mb-6 rounded-lg border px-4 py-3 text-[14px]" style={{ backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#334155' }}>
              Submissions from this page are saved as received supermarket donations and added to inventory immediately. Use the low stock list or an exact inventory item name so stock stays aligned with the database.
            </div>

            <div className="mb-8">
              <h1 className="mb-2 text-[40px] font-bold" style={{ color: '#1A1A1A' }}>
                Restock Submission
              </h1>
              <div className="h-1 w-20" style={{ backgroundColor: '#F5A623' }}></div>
            </div>

            {formError && (
              <div
                className="mb-6 rounded-lg border px-4 py-3 text-[14px]"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#B91C1C' }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-6">
                {rows.map((row) => (
                  <div key={row.id} className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className="mb-2 block text-[15px] font-medium" style={{ color: '#1A1A1A' }}>
                        Inventory Item <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={row.foodName}
                        onChange={(event) => updateRow(row.id, 'foodName', event.target.value)}
                        placeholder="Use low stock list or exact inventory name"
                        className="w-full rounded-md border px-4 py-3 transition-colors"
                        style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[15px] font-medium" style={{ color: '#1A1A1A' }}>
                        Quantity <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.id, 'quantity', event.target.value)}
                        placeholder="Quantity"
                        className="w-full rounded-md border px-4 py-3 transition-colors"
                        style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                      />
                    </div>

                    <div>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-md px-6 py-3 text-[15px] font-medium transition-colors"
                          style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="mt-8 flex items-center gap-2 rounded-md border px-6 py-3 text-[15px] font-medium transition-colors"
                style={{ borderColor: '#E5E7EB', color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
              >
                <Plus size={18} />
                Add row
              </button>

              <p className="mt-3 text-[13px]" style={{ color: '#6B7280' }}>
                Tip: selecting from the low stock list links the row directly to the existing inventory record.
              </p>

              <button
                type="submit"
                className="mt-8 w-full rounded-md py-4 text-[18px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: '#F5A623', color: '#1A1A1A' }}
                disabled={isSubmittingDonation}
                onMouseEnter={(event) => {
                  if (!isSubmittingDonation) {
                    event.currentTarget.style.backgroundColor = '#D4870A'
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = '#F5A623'
                }}
              >
                {isSubmittingDonation ? 'Submitting...' : 'Submit Restock'}
              </button>
            </form>

            <div className="mt-6 text-center text-[14px]" style={{ color: '#6B7280' }}>
              UK Registered Charity No. 1234567 | All Rights Reserved | Secured Data
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <LowStockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        items={modalItems}
        isLoading={isLoadingLowStock}
        onAddToForm={fillFood}
        onDismissItem={dismissLowStockItem}
      />
    </div>
  )
}
