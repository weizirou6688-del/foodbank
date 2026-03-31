import { useMemo, useState } from 'react'

import { useFoodBankStore } from '@/app/store/foodBankStore'

const ITEM_CATEGORIES = [
  'Proteins & Meat',
  'Vegetables',
  'Fruits',
  'Dairy',
  'Canned Goods',
  'Grains & Pasta',
  'Snacks',
  'Beverages',
  'Baby Food',
] as const

interface AddItemModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const addItem = useFoodBankStore((state) => state.addItem)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof ITEM_CATEGORIES)[number]>('Proteins & Meat')
  const [initialStock, setInitialStock] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const parsedStock = useMemo(() => Number(initialStock), [initialStock])

  if (!isOpen) {
    return null
  }

  const resetAndClose = () => {
    setName('')
    setCategory('Proteins & Meat')
    setInitialStock('0')
    setError('')
    setSubmitting(false)
    onClose()
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Item name is required.')
      return
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError('Initial stock must be a non-negative number.')
      return
    }

    try {
      setSubmitting(true)
      await addItem({
        name: name.trim(),
        category,
        initial_stock: parsedStock,
      })
      resetAndClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item.')
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
        className="w-[90%] max-w-xl rounded-[2rem] shadow-2xl border border-[#E8E8E8] bg-white p-6 md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A1A1A]">Add New Item</h3>
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
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Item Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
              placeholder="e.g. Canned Tuna"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof ITEM_CATEGORIES)[number])}
              className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] bg-white outline-none"
            >
              {ITEM_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Initial Stock</label>
            <input
              type="number"
              min={0}
              step={1}
              value={initialStock}
              onChange={(event) => setInitialStock(event.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
            />
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
              {submitting ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
