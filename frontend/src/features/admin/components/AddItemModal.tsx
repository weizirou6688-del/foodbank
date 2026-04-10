import { useEffect, useMemo, useState } from 'react'

import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import { foodBanksAPI } from '@/shared/lib/api'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput, AdminModalSelect } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

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

interface FoodBankOption {
  id: number
  name: string
}

export default function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const addItem = useFoodBankStore((state) => state.addItem)
  const user = useAuthStore((state) => state.user)
  const adminScope = getAdminScopeMeta(user)
  const isPlatformAdmin = adminScope.isPlatformAdmin

  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof ITEM_CATEGORIES)[number]>('Proteins & Meat')
  const [initialStock, setInitialStock] = useState('0')
  const [foodBankId, setFoodBankId] = useState('')
  const [foodBanks, setFoodBanks] = useState<FoodBankOption[]>([])
  const [loadingFoodBanks, setLoadingFoodBanks] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const parsedStock = useMemo(() => Number(initialStock), [initialStock])

  useEffect(() => {
    if (!isOpen || !isPlatformAdmin) {
      return
    }

    let cancelled = false

    const loadFoodBanks = async () => {
      setLoadingFoodBanks(true)
      try {
        const response = await foodBanksAPI.getFoodBanks()
        const items = Array.isArray(response?.items) ? response.items : []
        const nextFoodBanks = items
          .map((item) => ({
            id: Number(item.id),
            name: item.name,
          }))
          .filter((item) => Number.isFinite(item.id) && item.id > 0)

        if (cancelled) {
          return
        }

        setFoodBanks(nextFoodBanks)
        setFoodBankId((current) => {
          if (current && nextFoodBanks.some((item) => String(item.id) === current)) {
            return current
          }
          return nextFoodBanks.length === 1 ? String(nextFoodBanks[0].id) : ''
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load food banks.')
        }
      } finally {
        if (!cancelled) {
          setLoadingFoodBanks(false)
        }
      }
    }

    void loadFoodBanks()

    return () => {
      cancelled = true
    }
  }, [isOpen, isPlatformAdmin])

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

    const parsedFoodBankId = Number(foodBankId)
    if (isPlatformAdmin && (!Number.isFinite(parsedFoodBankId) || parsedFoodBankId <= 0)) {
      setError('Choose a food bank before adding an item.')
      return
    }

    try {
      setSubmitting(true)
      await addItem({
        name: name.trim(),
        category,
        initial_stock: parsedStock,
        food_bank_id: isPlatformAdmin ? parsedFoodBankId : undefined,
      })
      resetAndClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Add New Item"
      maxWidth="max-w-xl"
      dialogClassName="border border-[#E8E8E8]"
    >
      <AdminModalFormLayout
        onSubmit={onSubmit}
        error={error}
        className="space-y-4"
        actionsPadded
        actions={
          <>
            <AdminModalSecondaryButton onClick={resetAndClose}>
              Cancel
            </AdminModalSecondaryButton>
            <AdminModalPrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Item'}
            </AdminModalPrimaryButton>
          </>
        }
        >
        {isPlatformAdmin && (
          <AdminModalField label="Food Bank">
            <AdminModalSelect
              value={foodBankId}
              onChange={(event) => setFoodBankId(event.target.value)}
              disabled={loadingFoodBanks || submitting}
            >
              <option value="">
                {loadingFoodBanks ? 'Loading food banks...' : 'Choose a food bank'}
              </option>
              {foodBanks.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </AdminModalSelect>
          </AdminModalField>
        )}

        <AdminModalField label="Item Name">
          <AdminModalInput
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Canned Tuna"
          />
        </AdminModalField>

        <AdminModalField label="Category">
          <AdminModalSelect
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof ITEM_CATEGORIES)[number])}
          >
            {ITEM_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </AdminModalSelect>
        </AdminModalField>

        <AdminModalField label="Initial Stock">
          <AdminModalInput
            type="number"
            min={0}
            step={1}
            value={initialStock}
            onChange={(event) => setInitialStock(event.target.value)}
          />
        </AdminModalField>
      </AdminModalFormLayout>
    </Modal>
  )
}
