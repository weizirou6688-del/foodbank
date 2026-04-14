import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import { adminAPI } from '@/shared/lib/api/admin'
import {
  restockAPI,
  type RestockRequestRecord,
  type RestockUrgency,
} from '@/shared/lib/api/restock'
import { Plus } from '@/shared/ui/InlineIcons'
import PublicPageShell from '@/shared/ui/PublicPageShell'
import {
  LowStockBanner,
  LowStockModal,
  type SupermarketLowStockItem,
} from './components/LowStockModal'

interface RestockRow {
  id: string
  inventoryItemId: number | null
  urgency: RestockUrgency
}

interface LowStockItem {
  id: number
  name: string
  current_stock: number
  threshold: number
  unit: string
}

const makeId = () => `row_${Date.now()}${Math.random().toString(36).slice(2, 7)}`
const createRow = (inventoryItemId: number | null = null): RestockRow => ({
  id: makeId(),
  inventoryItemId,
  urgency: 'medium',
})
const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : [])
const asListItems = <T,>(value: unknown) =>
  value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
    ? ((value as { items: T[] }).items)
    : []
const URGENCY_OPTIONS: Array<{ value: RestockUrgency; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]
const BANNERS = {
  error: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#B91C1C' },
  info: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#334155' },
}
function Banner({ message, tone = 'info' }: { message: string; tone?: keyof typeof BANNERS }) {
  return (
    <div className="mb-6 rounded-lg border px-4 py-3 text-[14px]" style={BANNERS[tone]}>
      {message}
    </div>
  )
}

function RestockRowEditor({
  row,
  items,
  openRequestItemIds,
  canRemove,
  loading,
  onUpdateItem,
  onUpdateUrgency,
  onRemove,
}: {
  row: RestockRow
  items: LowStockItem[]
  openRequestItemIds: number[]
  canRemove: boolean
  loading: boolean
  onUpdateItem: (inventoryItemId: number | null) => void
  onUpdateUrgency: (urgency: RestockUrgency) => void
  onRemove: () => void
}) {
  const selectedItem = items.find((item) => item.id === row.inventoryItemId) ?? null
  const handleItemChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value
    onUpdateItem(nextValue ? Number(nextValue) : null)
  }

  return (
    <div className="grid items-end gap-4 md:grid-cols-[1.4fr_0.8fr_auto]">
      <div>
        <label className="mb-2 block text-[15px] font-medium" style={{ color: '#1A1A1A' }}>
          Low Stock Item <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <select
          value={row.inventoryItemId ?? ''}
          onChange={handleItemChange}
          className="w-full rounded-md border px-4 py-3 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
          disabled={loading || items.length === 0}
        >
          <option value="">Select a low-stock item</option>
          {items.map((item) => {
            const hasOpenRequest = openRequestItemIds.includes(item.id) && item.id !== row.inventoryItemId
            return (
              <option key={item.id} value={item.id} disabled={hasOpenRequest}>
                {item.name}
                {hasOpenRequest ? ' (open request already exists)' : ''}
              </option>
            )
          })}
        </select>
        {selectedItem ? (
          <p className="mt-2 text-[13px] text-[#6B7280]">
            Current stock {selectedItem.current_stock} {selectedItem.unit}, threshold {selectedItem.threshold}{' '}
            {selectedItem.unit}, deficit {Math.max(selectedItem.threshold - selectedItem.current_stock, 0)}{' '}
            {selectedItem.unit}.
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[#6B7280]">
            Use the low stock modal to prefill a row quickly.
          </p>
        )}
      </div>
      <div>
        <label className="mb-2 block text-[15px] font-medium" style={{ color: '#1A1A1A' }}>
          Urgency <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <select
          value={row.urgency}
          onChange={(event) => onUpdateUrgency(event.target.value as RestockUrgency)}
          className="w-full rounded-md border px-4 py-3 transition-colors"
          style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
          disabled={loading}
        >
          {URGENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={loading}
            className="rounded-md bg-[#EF4444] px-6 py-3 text-[15px] font-medium text-white transition-colors"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function Supermarket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [rows, setRows] = useState<RestockRow[]>([createRow()])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [restockRequests, setRestockRequests] = useState<RestockRequestRecord[]>([])
  const [dismissedItemIds, setDismissedItemIds] = useState<number[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBannerVisible, setIsBannerVisible] = useState(true)
  const [isLoadingPageData, setIsLoadingPageData] = useState(false)
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')

  const clearFormError = () => {
    if (formError) {
      setFormError('')
    }
  }

  const loadPageData = useCallback(async () => {
    if (!accessToken) {
      setLowStockItems([])
      setRestockRequests([])
      return
    }

    setIsLoadingPageData(true)
    setPageError('')

    try {
      const [lowStockResult, restockResult] = await Promise.all([
        adminAPI.getLowStockItems(accessToken),
        restockAPI.listRequests(accessToken),
      ])

      setLowStockItems(asArray<LowStockItem>(lowStockResult))
      setRestockRequests(asListItems<RestockRequestRecord>(restockResult))
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to load restock data.')
      setLowStockItems([])
      setRestockRequests([])
    } finally {
      setIsLoadingPageData(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    if (lowStockItems.length > 0) {
      setIsBannerVisible(true)
    }
    setDismissedItemIds((prev) =>
      prev.filter((itemId) => lowStockItems.some((item) => item.id === itemId)),
    )
  }, [lowStockItems])

  const lowStockById = useMemo(
    () => new Map(lowStockItems.map((item) => [item.id, item])),
    [lowStockItems],
  )
  const openRestockRequests = useMemo(
    () => restockRequests.filter((request) => request.status === 'open'),
    [restockRequests],
  )
  const openRequestItemIds = useMemo(
    () => openRestockRequests.map((request) => request.inventory_item_id),
    [openRestockRequests],
  )
  const openRequestItemIdSet = useMemo(
    () => new Set(openRequestItemIds),
    [openRequestItemIds],
  )
  const visibleLowStockItems = useMemo(
    () => lowStockItems.filter((item) => !dismissedItemIds.includes(item.id)),
    [dismissedItemIds, lowStockItems],
  )
  const modalItems: SupermarketLowStockItem[] = visibleLowStockItems.map((item) => ({
    id: item.id,
    name: item.name,
    currentStock: item.current_stock,
    threshold: item.threshold,
    unit: item.unit,
  }))

  const updateRow = (id: string, updates: Partial<RestockRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)))
    clearFormError()
  }

  const addRow = () => {
    setRows((prev) => [...prev, createRow()])
    clearFormError()
  }

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length === 1 ? [createRow()] : prev.filter((row) => row.id !== id)))
    clearFormError()
  }

  const fillFood = (item: SupermarketLowStockItem) => {
    if (openRequestItemIdSet.has(item.id)) {
      setFormError(`${item.name} already has an open restock request.`)
      setIsModalOpen(false)
      return
    }

    setRows((prev) => {
      const emptyRow = prev.find((row) => row.inventoryItemId === null)
      return emptyRow
        ? prev.map((row) =>
            row.id === emptyRow.id ? { ...row, inventoryItemId: item.id } : row,
          )
        : [...prev, createRow(item.id)]
    })
    setFormError('')
    setIsModalOpen(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (!accessToken) {
      setFormError('Please log in again before submitting restock requests.')
      return
    }

    const selectedRows = rows.filter((row) => row.inventoryItemId !== null)
    if (selectedRows.length === 0) {
      setFormError('Select at least one low-stock item before submitting.')
      return
    }

    const seenItemIds = new Set<number>()
    for (const row of selectedRows) {
      const inventoryItemId = row.inventoryItemId as number
      const item = lowStockById.get(inventoryItemId)

      if (!item) {
        setFormError('One of the selected items is no longer on the low-stock list. Refresh and try again.')
        return
      }

      if (openRequestItemIdSet.has(inventoryItemId)) {
        setFormError(`${item.name} already has an open restock request.`)
        return
      }

      if (seenItemIds.has(inventoryItemId)) {
        setFormError('Each inventory item can only be requested once per submission.')
        return
      }

      seenItemIds.add(inventoryItemId)
    }

    const payloads = selectedRows.map((row) => {
      const item = lowStockById.get(row.inventoryItemId as number) as LowStockItem
      return {
        inventory_item_id: item.id,
        current_stock: item.current_stock,
        threshold: item.threshold,
        urgency: row.urgency,
      }
    })

    setIsSubmittingRequest(true)
    let createdCount = 0

    try {
      for (const payload of payloads) {
        await restockAPI.createRequest(payload, accessToken)
        createdCount += 1
      }

      setRows([createRow()])
      setDismissedItemIds([])
      await loadPageData()
      window.alert(
        `${createdCount} restock request${createdCount === 1 ? '' : 's'} submitted. Stock will only change after an admin fulfils the request.`,
      )
    } catch (error) {
      await loadPageData()
      const message =
        error instanceof Error ? error.message : 'Failed to submit restock request.'
      setFormError(
        createdCount > 0
          ? `${createdCount} request${createdCount === 1 ? ' was' : 's were'} created before the submission stopped. ${message}`
          : message,
      )
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  return (
    <PublicPageShell
      variant="supermarket"
      className="public-page-font flex min-h-screen flex-col bg-[#F2F4F3]"
      mainClassName="flex-1 bg-[#F2F4F3] py-12"
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="rounded-lg bg-white p-12 shadow-sm">
          {isBannerVisible && visibleLowStockItems.length > 0 ? (
            <LowStockBanner
              items={modalItems}
              onViewFullList={() => setIsModalOpen(true)}
              onDismiss={() => setIsBannerVisible(false)}
            />
          ) : null}
          {pageError ? <Banner tone="error" message={pageError} /> : null}
          {openRestockRequests.length > 0 ? (
            <Banner
              message={`${openRestockRequests.length} open restock request${openRestockRequests.length === 1 ? '' : 's'} already exist for your food bank. Those items are disabled in the form below.`}
            />
          ) : null}
          {!lowStockItems.length && !pageError && !isLoadingPageData ? (
            <Banner message="No low-stock items need a restock request right now." />
          ) : null}
          <div className="mb-8">
            <h1 className="mb-2 text-[40px] font-bold" style={{ color: '#1A1A1A' }}>
              Restock Requests
            </h1>
            <div className="h-1 w-20 bg-[#F5A623]"></div>
          </div>
          {formError ? <Banner tone="error" message={formError} /> : null}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-6">
              {rows.map((row) => (
                <RestockRowEditor
                  key={row.id}
                  row={row}
                  items={lowStockItems}
                  openRequestItemIds={openRequestItemIds}
                  canRemove={rows.length > 1}
                  loading={isSubmittingRequest}
                  onUpdateItem={(inventoryItemId) => updateRow(row.id, { inventoryItemId })}
                  onUpdateUrgency={(urgency) => updateRow(row.id, { urgency })}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-8 flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-6 py-3 text-[15px] font-medium text-[#1A1A1A] transition-colors"
            >
              <Plus size={18} />
              Add row
            </button>
            <p className="mt-3 text-[13px] text-[#6B7280]">
              Tip: use the low stock modal to prefill items from the current deficit list.
            </p>
            <button
              type="submit"
              className="mt-8 w-full rounded-md bg-[#F5A623] py-4 text-[18px] font-bold text-[#1A1A1A] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmittingRequest || lowStockItems.length === 0}
              onMouseEnter={(event) => {
                if (!isSubmittingRequest && lowStockItems.length > 0) {
                  event.currentTarget.style.backgroundColor = '#D4870A'
                }
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = '#F5A623'
              }}
            >
              {isSubmittingRequest ? 'Submitting...' : 'Submit Restock Requests'}
            </button>
          </form>

        </div>
      </div>
      <LowStockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        items={modalItems}
        isLoading={isLoadingPageData}
        openRequestItemIds={openRequestItemIds}
        onAddToForm={fillFood}
        onDismissItem={(itemId) =>
          setDismissedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
        }
      />
    </PublicPageShell>
  )
}
