import { useEffect, useState } from 'react'

import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import { foodBanksAPI } from '@/shared/lib/api'
import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput, AdminModalSelect } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

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

interface FoodBankOption {
  id: number
  name: string
}

function createEmptyContentRow(): ContentRow {
  return { item_id: '', quantity: '1' }
}

interface PackageContentsSectionProps {
  contents: ContentRow[]
  inventoryItems: InventoryItemOption[]
  loadingItems: boolean
  onAddRow: () => void
  onRemoveRow: (index: number) => void
  onUpdateRow: (index: number, key: keyof ContentRow, value: string) => void
}

function PackageContentsSection({
  contents,
  inventoryItems,
  loadingItems,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: PackageContentsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">Contents</p>
        <button
          type="button"
          onClick={onAddRow}
          className="px-3 py-1.5 rounded-full border border-[#E8E8E8] text-xs font-semibold text-[#1A1A1A]"
        >
          + Add Row
        </button>
      </div>

      <div className="space-y-2">
        {contents.map((row, index) => (
          <PackageContentRow
            key={`row-${index}`}
            row={row}
            inventoryItems={inventoryItems}
            loadingItems={loadingItems}
            onRemove={() => onRemoveRow(index)}
            onUpdateRow={(key, value) => onUpdateRow(index, key, value)}
          />
        ))}
      </div>
    </div>
  )
}

interface PackageContentRowProps {
  row: ContentRow
  inventoryItems: InventoryItemOption[]
  loadingItems: boolean
  onRemove: () => void
  onUpdateRow: (key: keyof ContentRow, value: string) => void
}

function PackageContentRow({
  row,
  inventoryItems,
  loadingItems,
  onRemove,
  onUpdateRow,
}: PackageContentRowProps) {
  return (
    <div className="grid grid-cols-[1fr_120px_auto] gap-2">
      <AdminModalSelect
        value={row.item_id}
        onChange={(event) => onUpdateRow('item_id', event.target.value)}
        disabled={loadingItems}
      >
        <option value="">Select item</option>
        {inventoryItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </AdminModalSelect>

      <AdminModalInput
        type="number"
        min={1}
        step={1}
        value={row.quantity}
        onChange={(event) => onUpdateRow('quantity', event.target.value)}
        placeholder="Qty"
      />

      <button
        type="button"
        onClick={onRemove}
        className="h-11 px-3 rounded-lg border border-[#E8E8E8] text-sm text-[#1A1A1A]"
      >
        Remove
      </button>
    </div>
  )
}

interface AddPackageModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddPackageModal({ isOpen, onClose }: AddPackageModalProps) {
  const addPackage = useFoodBankStore((state) => state.addPackage)
  const accessToken = useAuthStore((state) => state.accessToken)
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken)
  const user = useAuthStore((state) => state.user)
  const adminScope = getAdminScopeMeta(user)
  const isPlatformAdmin = adminScope.isPlatformAdmin

  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof PACKAGE_CATEGORIES)[number]>('Pantry & Spices')
  const [threshold, setThreshold] = useState('0')
  const [contents, setContents] = useState<ContentRow[]>([createEmptyContentRow()])
  const [foodBankId, setFoodBankId] = useState('')
  const [foodBanks, setFoodBanks] = useState<FoodBankOption[]>([])
  const [loadingFoodBanks, setLoadingFoodBanks] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (!isOpen || !accessToken) {
      return
    }

    const selectedFoodBankId = Number(foodBankId)
    if (isPlatformAdmin && (!Number.isFinite(selectedFoodBankId) || selectedFoodBankId <= 0)) {
      setInventoryItems([])
      return
    }

    const loadInventory = async () => {
      setLoadingItems(true)
      try {
        const requestWithToken = async (token: string) =>
          fetch(
            `${API_BASE_URL}/api/v1/inventory${
              isPlatformAdmin ? `?food_bank_id=${selectedFoodBankId}` : ''
            }`,
            {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            },
          )

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
        const inventoryItems = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : []
        const mapped = inventoryItems.map((item: { id: number; name: string }) => ({ id: item.id, name: item.name }))
        setInventoryItems(mapped)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory items.')
      } finally {
        setLoadingItems(false)
      }
    }

    void loadInventory()
  }, [isOpen, accessToken, refreshAccessToken, isPlatformAdmin, foodBankId])

  useEffect(() => {
    if (!isOpen || !isPlatformAdmin) {
      return
    }

    setContents([createEmptyContentRow()])
  }, [foodBankId, isOpen, isPlatformAdmin])

  const resetAndClose = () => {
    setName('')
    setCategory('Pantry & Spices')
    setThreshold('0')
    setContents([createEmptyContentRow()])
    setError('')
    setSubmitting(false)
    onClose()
  }

  const updateRow = (index: number, key: keyof ContentRow, value: string) => {
    setContents((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)))
  }

  const addRow = () => {
    setContents((prev) => [...prev, createEmptyContentRow()])
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

    const parsedFoodBankId = Number(foodBankId)
    if (isPlatformAdmin && (!Number.isFinite(parsedFoodBankId) || parsedFoodBankId <= 0)) {
      setError('Choose a food bank before adding a package.')
      return
    }

    const allowedInventoryItemIds = new Set(inventoryItems.map((item) => item.id))
    if (parsedContents.some((row) => !allowedInventoryItemIds.has(row.item_id))) {
      setError('Selected inventory items must belong to the chosen food bank.')
      return
    }

    try {
      setSubmitting(true)
      await addPackage({
        name: name.trim(),
        category,
        threshold: parsedThreshold,
        food_bank_id: isPlatformAdmin ? parsedFoodBankId : undefined,
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
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Add New Package"
      maxWidth="max-w-[760px]"
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
              {submitting ? 'Saving...' : 'Add Package'}
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

        <AdminModalField label="Package Name">
          <AdminModalInput
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Emergency Pack A"
          />
        </AdminModalField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminModalField label="Category">
            <AdminModalSelect
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof PACKAGE_CATEGORIES)[number])}
            >
              {PACKAGE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </AdminModalSelect>
          </AdminModalField>

          <AdminModalField label="Safety Threshold">
            <AdminModalInput
              type="number"
              min={0}
              step={1}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </AdminModalField>
        </div>

        <PackageContentsSection
          contents={contents}
          inventoryItems={inventoryItems}
          loadingItems={loadingItems}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
        />
      </AdminModalFormLayout>
    </Modal>
  )
}
