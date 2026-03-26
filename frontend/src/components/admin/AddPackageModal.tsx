import { useEffect, useState } from 'react'

import { useFoodBankStore } from '@/store/foodBankStore'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/utils/apiBaseUrl'

const PACKAGE_CATEGORIES = [
  'Pantry & Spices',
  'Breakfast',
  'Lunchbox',
  'Family Bundle',
  'Emergency Pack',
] as const

interface InventoryItemOption {
  id: number
  name: string
}

interface ContentRow {
  item_id: string
  quantity: string
}

interface AddPackageModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddPackageModal({ isOpen, onClose }: AddPackageModalProps) {
  const addPackage = useFoodBankStore((state) => state.addPackage)
  const accessToken = useAuthStore((state) => state.accessToken)
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof PACKAGE_CATEGORIES)[number]>('Pantry & Spices')
  const [threshold, setThreshold] = useState('0')
  const [contents, setContents] = useState<ContentRow[]>([{ item_id: '', quantity: '1' }])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !accessToken) {
      return
    }

    const loadInventory = async () => {
      setLoadingItems(true)
      try {
        const requestWithToken = async (token: string) =>
          fetch(`${API_BASE_URL}/api/v1/inventory`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

        let response = await requestWithToken(accessToken)
        if (response.status === 401) {
          const refreshed = await refreshAccessToken()
          if (!refreshed) {
            throw new Error('Session expired, please login again.')
          }
          const renewedToken = useAuthStore.getState().accessToken
          if (!renewedToken) {
            throw new Error('Session expired, please login again.')
          }
          response = await requestWithToken(renewedToken)
        }

        if (!response.ok) {
          throw new Error('Failed to load inventory items.')
        }
        const data = await response.json()
        const mapped = Array.isArray(data)
          ? data.map((item: { id: number; name: string }) => ({ id: item.id, name: item.name }))
          : []
        setInventoryItems(mapped)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory items.')
      } finally {
        setLoadingItems(false)
      }
    }

    void loadInventory()
  }, [isOpen, accessToken, refreshAccessToken])

  if (!isOpen) {
    return null
  }

  const resetAndClose = () => {
    setName('')
    setCategory('Pantry & Spices')
    setThreshold('0')
    setContents([{ item_id: '', quantity: '1' }])
    setError('')
    setSubmitting(false)
    onClose()
  }

  const updateRow = (index: number, key: keyof ContentRow, value: string) => {
    setContents((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)))
  }

  const addRow = () => {
    setContents((prev) => [...prev, { item_id: '', quantity: '1' }])
  }

  const removeRow = (index: number) => {
    setContents((prev) => (prev.length <= 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Package name is required.')
      return
    }

    const parsedThreshold = Number(threshold)
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setError('Threshold must be a non-negative number.')
      return
    }

    const parsedContents = contents.map((row) => ({
      item_id: Number(row.item_id),
      quantity: Number(row.quantity),
    }))

    if (parsedContents.some((row) => !Number.isFinite(row.item_id) || row.item_id <= 0)) {
      setError('Please select an inventory item for every content row.')
      return
    }

    if (parsedContents.some((row) => !Number.isFinite(row.quantity) || row.quantity <= 0)) {
      setError('Quantity must be at least 1 for each content row.')
      return
    }

    try {
      setSubmitting(true)
      await addPackage({
        name: name.trim(),
        category,
        threshold: parsedThreshold,
        contents: parsedContents,
      })
      resetAndClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add package.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="_modalOverlay_fmbrn_179 fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={resetAndClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[90%] md:w-[760px] rounded-[2rem] shadow-2xl border border-[#E8E8E8] bg-white p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A1A1A]">Add New Package</h3>
          <button
            type="button"
            onClick={resetAndClose}
            className="h-9 w-9 rounded-full border border-[#E8E8E8] text-[#1A1A1A]"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Package Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
              placeholder="e.g. Emergency Pack A"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as (typeof PACKAGE_CATEGORIES)[number])}
                className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] bg-white outline-none"
              >
                {PACKAGE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Safety Threshold</label>
              <input
                type="number"
                min={0}
                step={1}
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#1A1A1A]">Contents</label>
              <button
                type="button"
                onClick={addRow}
                className="px-3 py-1.5 rounded-full border border-[#E8E8E8] text-xs font-semibold text-[#1A1A1A]"
              >
                + Add Row
              </button>
            </div>

            <div className="space-y-2">
              {contents.map((row, index) => (
                <div key={`row-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <select
                    value={row.item_id}
                    onChange={(event) => updateRow(index, 'item_id', event.target.value)}
                    disabled={loadingItems}
                    className="h-11 px-3 rounded-lg border border-[#E8E8E8] bg-white outline-none"
                  >
                    <option value="">Select item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(event) => updateRow(index, 'quantity', event.target.value)}
                    className="h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
                    placeholder="Qty"
                  />

                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="h-11 px-3 rounded-lg border border-[#E8E8E8] text-sm text-[#1A1A1A]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-[#E63946]">{error}</p>}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 rounded-full border border-[#E8E8E8] text-sm text-[#1A1A1A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-full border border-[#F7DC6F] bg-[#F7DC6F] text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Add Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
