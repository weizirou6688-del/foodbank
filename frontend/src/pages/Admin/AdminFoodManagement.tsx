import { useEffect, useMemo, useState } from 'react'
import AddItemModal from '@/features/admin/components/AddItemModal'
import AdminActionButtons from '@/features/admin/components/AdminActionButtons'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import AdminPackageActionButtons from '@/features/admin/components/AdminPackageActionButtons'
import AddPackageModal from '@/features/admin/components/AddPackageModal'
import AdjustStockModal from '@/features/admin/components/AdjustStockModal'
import ConfirmActionModal from '@/features/admin/components/ConfirmActionModal'
import DatePromptModal from '@/features/admin/components/DatePromptModal'
import EditNameThresholdModal from '@/features/admin/components/EditNameThresholdModal'
import QuantityPromptModal from '@/features/admin/components/QuantityPromptModal'
import { useAuthStore } from '@/app/store/authStore'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { adminAPI, restockAPI } from '@/shared/lib/api'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

type Tab = 'packages' | 'items' | 'packaging' | 'lots' | 'low-stock'

interface InventoryLotRow {
  id: number
  inventory_item_id: number
  item_name: string
  quantity: number
  expiry_date: string
  received_date: string
  batch_reference?: string | null
  status: 'active' | 'wasted' | 'expired'
}

interface LowStockRow {
  id: number
  name: string
  category: string
  unit: string
  current_stock: number
  threshold: number
  stock_deficit: number
}

interface RestockRequestRow {
  id: number
  inventory_item_id: number
  current_stock: number
  threshold: number
  urgency: 'high' | 'medium' | 'low'
  status: 'open' | 'fulfilled' | 'cancelled'
  created_at: string
}

interface Props {
  onSwitch: (s: 'statistics' | 'food') => void
}

export default function AdminFoodManagement({ onSwitch: _onSwitch }: Props) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const inventory = useFoodBankStore((state) => state.inventory)
  const packages = useFoodBankStore((state) => state.packages)
  const loadPackages = useFoodBankStore((state) => state.loadPackages)
  const loadInventory = useFoodBankStore((state) => state.loadInventory)
  const updateItem = useFoodBankStore((state) => state.updateItem)
  const stockInItem = useFoodBankStore((state) => state.stockInItem)
  const stockOutItem = useFoodBankStore((state) => state.stockOutItem)
  const deleteItem = useFoodBankStore((state) => state.deleteItem)
  const updatePackage = useFoodBankStore((state) => state.updatePackage)

  const [tab, setTab] = useState<Tab>('packages')
  const [search, setSearch] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false)
  const [itemEditTarget, setItemEditTarget] = useState<{ id: number; name: string; threshold: number } | null>(null)
  const [packageEditTarget, setPackageEditTarget] = useState<{ id: number; name: string; threshold: number } | null>(null)
  const [itemAdjustTarget, setItemAdjustTarget] = useState<{ id: number; direction: 'in' | 'out' } | null>(null)
  const [packPackageId, setPackPackageId] = useState<number | ''>('')
  const [packQuantity, setPackQuantity] = useState('1')
  const [isPacking, setIsPacking] = useState(false)
  const [packFeedback, setPackFeedback] = useState('')
  const [lotRows, setLotRows] = useState<InventoryLotRow[]>([])
  const [isLoadingLots, setIsLoadingLots] = useState(false)
  const [lotError, setLotError] = useState('')
  const [lowStockRows, setLowStockRows] = useState<LowStockRow[]>([])
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false)
  const [lowStockError, setLowStockError] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [restockRequests, setRestockRequests] = useState<RestockRequestRow[]>([])
  const [isLoadingRestockRequests, setIsLoadingRestockRequests] = useState(false)
  const [restockError, setRestockError] = useState('')
  const [restockActionId, setRestockActionId] = useState<number | null>(null)
  const [pageFeedback, setPageFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [lotDamageTarget, setLotDamageTarget] = useState<{ id: number; itemName: string } | null>(null)
  const [lotExpiryTarget, setLotExpiryTarget] = useState<{ id: number; itemName: string; expiryDate: string } | null>(null)
  const [lotStatusTarget, setLotStatusTarget] = useState<{ id: number; itemName: string; currentStatus: InventoryLotRow['status'] } | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ id: number; itemName: string; referencedByPackages: string[] } | null>(null)
  const [pendingAction, setPendingAction] = useState<'lot-damage' | 'lot-expiry' | 'lot-status' | 'delete-item' | 'restock-fulfil' | 'restock-cancel' | null>(null)
  const [restockConfirmTarget, setRestockConfirmTarget] = useState<{ id: number; mode: 'fulfil' | 'cancel' } | null>(null)

  const loadLots = async () => {
    if (!accessToken) {
      return
    }

    setIsLoadingLots(true)
    setLotError('')

    try {
      const data = await adminAPI.getInventoryLots(accessToken, true)
      setLotRows(Array.isArray(data) ? (data as InventoryLotRow[]) : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load inventory lots.'
      setLotError(message)
    } finally {
      setIsLoadingLots(false)
    }
  }

  const loadLowStock = async (overrideThreshold?: number) => {
    if (!accessToken) {
      return
    }

    setIsLoadingLowStock(true)
    setLowStockError('')

    try {
      const data = await adminAPI.getLowStockItems(accessToken, overrideThreshold)
      setLowStockRows(Array.isArray(data) ? (data as LowStockRow[]) : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load low stock items.'
      setLowStockError(message)
    } finally {
      setIsLoadingLowStock(false)
    }
  }

  const loadRestockRequests = async () => {
    if (!accessToken) {
      return
    }

    setIsLoadingRestockRequests(true)
    setRestockError('')

    try {
      const data = await restockAPI.getRequests(accessToken)
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown[] })?.items)
          ? (data as { items: RestockRequestRow[] }).items
          : []
      setRestockRequests(items as RestockRequestRow[])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load restock requests.'
      setRestockError(message)
    } finally {
      setIsLoadingRestockRequests(false)
    }
  }

  useEffect(() => {
    let active = true

    const loadData = async () => {
      setIsLoadingData(true)
      setLoadError('')

      const errors: string[] = []
      await Promise.all([
        loadPackages().catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to load packages.')
        }),
        loadInventory().catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to load inventory.')
        }),
        loadLots().catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to load inventory lots.')
        }),
        loadLowStock().catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to load low stock items.')
        }),
        loadRestockRequests().catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to load restock requests.')
        }),
      ])

      if (!active) {
        return
      }

      setLoadError(errors[0] ?? '')
      setIsLoadingData(false)
    }

    void loadData()
    return () => {
      active = false
    }
  }, [accessToken, loadPackages, loadInventory])

  const packageRows = useMemo(() => {
    const mappedStorePackages = packages.map((pkg) => ({
      key: `store-${pkg.id}`,
      id: pkg.id as number,
      name: pkg.name,
      category: pkg.category,
      threshold: pkg.threshold,
      stock: pkg.stock,
      contents: pkg.items.map((item) => `${item.name} x${item.qty}`),
    }))

    return mappedStorePackages
  }, [packages])

  const inventoryIdSet = useMemo(() => new Set(inventory.map((item) => item.id)), [inventory])

  const categories = useMemo(() => {
    const grouped = new Map<string, Array<{
      id: number
      name: string
      stock: number
      unit: string
      threshold: number
    }>>()

    for (const item of inventory) {
      const normalizedItem = {
        id: item.id,
        name: item.name,
        stock: item.stock,
        unit: item.unit,
        threshold: item.threshold,
      }

      const existing = grouped.get(item.category) ?? []
      existing.push(normalizedItem)
      grouped.set(item.category, existing)
    }

    return Array.from(grouped.entries()).map(([name, items]) => ({
      name,
      items,
    }))
  }, [inventory])

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0)

  const openRestockRequests = useMemo(
    () => restockRequests.filter((request) => request.status === 'open'),
    [restockRequests],
  )

  const openRestockItemIds = useMemo(
    () => new Set(openRestockRequests.map((request) => request.inventory_item_id)),
    [openRestockRequests],
  )

  const isActionBusy = (action: typeof pendingAction) => pendingAction === action

  const submitItemEdit = async (name: string, threshold: number) => {
    if (!itemEditTarget) {
      return
    }
    await updateItem(itemEditTarget.id, { name, threshold })
    setItemEditTarget(null)
  }

  const submitPackageEdit = async (name: string, threshold: number) => {
    if (!packageEditTarget) {
      return
    }
    await updatePackage(packageEditTarget.id, { name, threshold })
    setPackageEditTarget(null)
  }

  const submitItemAdjust = async (quantity: number) => {
    if (!itemAdjustTarget) {
      return
    }
    if (itemAdjustTarget.direction === 'in') {
      await stockInItem(itemAdjustTarget.id, quantity, 'admin manual stock-in')
    } else {
      await stockOutItem(itemAdjustTarget.id, quantity, 'admin manual stock-out')
    }
    setItemAdjustTarget(null)
  }

  const handlePackPackage = async () => {
    if (!accessToken) {
      setPackFeedback('Please login again and retry.')
      return
    }

    if (packPackageId === '') {
      setPackFeedback('Please select a package first.')
      return
    }

    const quantity = Number(packQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPackFeedback('Quantity must be a positive integer.')
      return
    }

    setIsPacking(true)
    setPackFeedback('')

    try {
      await adminAPI.packPackage(packPackageId, quantity, accessToken)
      await Promise.all([loadPackages(), loadInventory(), loadLots(), loadLowStock()])
      setPackFeedback('Package packed successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pack package.'
      setPackFeedback(message)
    } finally {
      setIsPacking(false)
    }
  }

  const handleLotDamage = async (lotId: number) => {
    const lot = lotRows.find((entry) => entry.id === lotId)
    if (!lot) {
      setPageFeedback({ tone: 'error', message: 'Inventory lot not found.' })
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setLotDamageTarget({ id: lotId, itemName: lot.item_name })
  }

  const submitLotDamage = async (damageQuantity: number) => {
    if (!lotDamageTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setPendingAction('lot-damage')
    try {
      await adminAPI.adjustInventoryLot(lotDamageTarget.id, { damage_quantity: damageQuantity }, accessToken)
      await Promise.all([loadLots(), loadLowStock(), loadInventory()])
      setLotDamageTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot damaged quantity updated.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to report damage.'
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
    }
  }

  const handleLotExpiryEdit = async (lotId: number, currentExpiryDate: string) => {
    const lot = lotRows.find((entry) => entry.id === lotId)
    if (!lot) {
      setPageFeedback({ tone: 'error', message: 'Inventory lot not found.' })
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setLotExpiryTarget({ id: lotId, itemName: lot.item_name, expiryDate: currentExpiryDate })
  }

  const submitLotExpiryEdit = async (expiryDate: string) => {
    if (!lotExpiryTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setPendingAction('lot-expiry')
    try {
      await adminAPI.adjustInventoryLot(lotExpiryTarget.id, { expiry_date: expiryDate }, accessToken)
      await Promise.all([loadLots(), loadLowStock()])
      setLotExpiryTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot expiry date updated.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update expiry date.'
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
    }
  }

  const handleLotStatusToggle = async (lotId: number, currentStatus: InventoryLotRow['status']) => {
    const lot = lotRows.find((entry) => entry.id === lotId)
    if (!lot) {
      setPageFeedback({ tone: 'error', message: 'Inventory lot not found.' })
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    if (currentStatus === 'expired') {
      setPageFeedback({ tone: 'info', message: 'Expired lots cannot be reactivated. Please adjust expiry date first.' })
      return
    }

    setLotStatusTarget({ id: lotId, itemName: lot.item_name, currentStatus })
  }

  const submitLotStatusToggle = async () => {
    if (!lotStatusTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    const nextStatus = lotStatusTarget.currentStatus === 'active' ? 'wasted' : 'active'
    setPendingAction('lot-status')
    try {
      await adminAPI.adjustInventoryLot(lotStatusTarget.id, { status: nextStatus }, accessToken)
      await Promise.all([loadLots(), loadLowStock()])
      setLotStatusTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot status updated.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update lot status.'
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
    }
  }

  const handleRefreshLowStock = async () => {
    const trimmed = lowStockThreshold.trim()
    if (!trimmed) {
      await loadLowStock()
      return
    }

    const threshold = Number(trimmed)
    if (!Number.isInteger(threshold) || threshold < 0) {
      setLowStockError('Threshold must be a non-negative integer.')
      return
    }

    await loadLowStock(threshold)
  }

  const handleDeleteItem = async (itemId: number, itemName: string) => {
    const normalizedItemName = itemName.trim().toLowerCase()
    const referencedByPackages = packageRows
      .filter((pkg) =>
        pkg.contents.some((content) => {
          const normalizedContent = content.trim().toLowerCase()
          return (
            normalizedContent === normalizedItemName
            || normalizedContent.startsWith(`${normalizedItemName} x`)
            || normalizedContent.includes(`item #${itemId}`)
          )
        }),
      )
      .map((pkg) => pkg.name)

    setDeleteItemTarget({ id: itemId, itemName, referencedByPackages })
  }

  const submitDeleteItem = async () => {
    if (!deleteItemTarget) {
      return
    }

    setPendingAction('delete-item')
    try {
      await deleteItem(deleteItemTarget.id)
      setPageFeedback({ tone: 'success', message: `Deleted ${deleteItemTarget.itemName}.` })
      setDeleteItemTarget(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete inventory item.'

      const isConflict = message.toLowerCase().includes('used in packages')
        || message.toLowerCase().includes('conflict')

      if (isConflict && deleteItemTarget.referencedByPackages.length > 0) {
        const preview = deleteItemTarget.referencedByPackages.slice(0, 3).join(', ')
        const suffix = deleteItemTarget.referencedByPackages.length > 3 ? ', ...' : ''
        setPageFeedback({ tone: 'error', message: `Cannot delete this item because it is referenced by: ${preview}${suffix}` })
      } else {
        setPageFeedback({ tone: 'error', message })
      }
    } finally {
      setPendingAction(null)
    }
  }

  const createRestockRequest = async (item: LowStockRow) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setRestockActionId(item.id)
    try {
      await restockAPI.submitRequest({
        inventory_item_id: item.id,
        current_stock: item.current_stock,
        threshold: item.threshold,
        urgency: item.current_stock === 0 ? 'high' : item.current_stock <= Math.max(1, Math.floor(item.threshold / 2)) ? 'medium' : 'low',
      }, accessToken)
      await Promise.all([loadRestockRequests(), loadLowStock()])
      setPageFeedback({ tone: 'success', message: `Restock request created for ${item.name}.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create restock request.'
      if (message.toLowerCase().includes('already exists')) {
        await loadRestockRequests()
      }
      setPageFeedback({ tone: 'error', message })
    } finally {
      setRestockActionId(null)
    }
  }

  const fulfilRestockRequest = async (requestId: number) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setRestockConfirmTarget({ id: requestId, mode: 'fulfil' })
  }

  const submitRestockConfirm = async () => {
    if (!restockConfirmTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: 'Please login again and retry.' })
      return
    }

    setRestockActionId(restockConfirmTarget.id)
    setPendingAction(restockConfirmTarget.mode === 'fulfil' ? 'restock-fulfil' : 'restock-cancel')
    try {
      if (restockConfirmTarget.mode === 'fulfil') {
        await restockAPI.fulfilRequest(restockConfirmTarget.id, accessToken)
        await Promise.all([loadRestockRequests(), loadInventory(), loadLots(), loadLowStock()])
        setPageFeedback({ tone: 'success', message: 'Restock request fulfilled.' })
      } else {
        await restockAPI.cancelRequest(restockConfirmTarget.id, accessToken)
        await Promise.all([loadRestockRequests(), loadLowStock()])
        setPageFeedback({ tone: 'success', message: 'Restock request cancelled.' })
      }
      setRestockConfirmTarget(null)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : restockConfirmTarget.mode === 'fulfil'
          ? 'Failed to fulfil restock request.'
          : 'Failed to cancel restock request.'
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
      setRestockActionId(null)
    }
  }

  return (
    <div className="fade-in">
      <h2 className="text-2xl md:text-[1.6rem] font-bold text-[#1A1A1A] border-l-[6px] border-[#F7DC6F] pl-4 mb-8" style={{ fontFamily: 'serif' }}>
        Food Management
      </h2>

      {loadError && (
        <div className="mb-6 rounded-xl border border-[#E63946]/30 bg-[#E63946]/[0.08] px-4 py-3 text-sm text-[#E63946]">
          {loadError}
        </div>
      )}

      {pageFeedback && (
        <AdminFeedbackBanner
          tone={pageFeedback.tone}
          message={pageFeedback.message}
          onClose={() => setPageFeedback(null)}
        />
      )}

      {/* Inner tabs */}
      <div className="flex gap-4 mb-8 border-b-[1.5px] border-[#E8E8E8] pb-2 overflow-x-auto">
        <button
          onClick={() => setTab('packages')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'packages' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
          </svg>
          Food Packages
        </button>
        <button
          onClick={() => setTab('items')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'items' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
          Single Items
        </button>
        <button
          onClick={() => setTab('packaging')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'packaging' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Package Packing
        </button>
        <button
          onClick={() => setTab('lots')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'lots' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Lot Management
        </button>
        <button
          onClick={() => setTab('low-stock')}
          className={`px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'low-stock' ? 'bg-[#F7DC6F] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Low Stock
        </button>
      </div>

      {/* Food Packages tab */}
      {tab === 'packages' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-[#1A1A1A]">Food Package List</h3>
            <button
              onClick={() => setIsAddPackageOpen(true)}
              className="bg-[#F7DC6F] hover:bg-[#F0C419] text-[#1A1A1A] px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border-[1.5px] border-[#F7DC6F]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              New Package
            </button>
          </div>

          <div className="overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F5F5F5]">
                  {['Package name','Category','Safety threshold','Current stock','Contents','Actions'].map((h) => (
                    <th key={h} className="p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packageRows.map((pkg) => (
                  <tr
                    key={pkg.key}
                    className={`border-b border-[#E8E8E8] ${pkg.stock < pkg.threshold ? 'bg-[#E63946]/[0.08] text-[#E63946]' : ''}`}
                  >
                    <td className="p-4">{pkg.name}</td>
                    <td className="p-4">{pkg.category}</td>
                    <td className="p-4">{pkg.threshold}</td>
                    <td className="p-4">{pkg.stock}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {pkg.contents.map((c) => (
                          <span key={c} className="bg-[#F5F5F5] border border-[#E8E8E8] rounded-full px-3 py-1 text-xs text-[#1A1A1A] whitespace-nowrap">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <AdminPackageActionButtons
                        onEdit={() => setPackageEditTarget({ id: pkg.id, name: pkg.name, threshold: pkg.threshold })}
                        onOpenPackTab={() => {
                          setPackPackageId(pkg.id)
                          setTab('packaging')
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {isLoadingData && packageRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-gray-500">
                      Loading packages...
                    </td>
                  </tr>
                )}
                {!isLoadingData && packageRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-gray-500">
                      No packages available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Items tab */}
      {tab === 'items' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="bg-[#F7DC6F] hover:bg-[#F0C419] text-[#1A1A1A] px-5 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-colors border-[1.5px] border-[#F7DC6F] w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              New Item
            </button>
            <div className="flex items-center border-[1.5px] border-[#E8E8E8] rounded-full px-4 h-12 bg-white w-full sm:w-[300px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mr-2 shrink-0">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#1A1A1A] w-full text-sm"
              />
            </div>
          </div>

          {filteredCategories.map((cat) => (
            <div key={cat.name} className="mb-8">
              <div className="flex items-center gap-2 text-xl font-bold text-[#1A1A1A] py-3 border-b-2 border-[#F7DC6F] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
                {cat.name}
              </div>
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b-2 border-[#E8E8E8] font-semibold text-gray-600 text-sm">
                <span>Name</span><span>Stock</span><span>Unit</span><span>Threshold</span><span>Actions</span>
              </div>
              {cat.items.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b border-[#E8E8E8] gap-4 md:gap-0 ${item.stock < item.threshold ? 'bg-[#E63946]/[0.08] -mx-4 px-4 md:mx-0 md:px-0' : ''}`}
                >
                  <span className="font-medium text-[#1A1A1A]">{item.name}</span>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Stock:</span>
                    <span className={item.stock < item.threshold ? 'text-[#E63946] font-semibold' : ''}>{item.stock}</span>
                  </div>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Unit:</span> {item.unit}
                  </div>
                  <div className="flex justify-between md:block text-[#1A1A1A]">
                    <span className="md:hidden text-gray-500 text-sm">Threshold:</span> {item.threshold}
                  </div>
                  <div className="mt-2 md:mt-0">
                    <AdminActionButtons
                      onEdit={inventoryIdSet.has(item.id) ? () => setItemEditTarget({ id: item.id, name: item.name, threshold: item.threshold }) : undefined}
                      onIn={inventoryIdSet.has(item.id) ? () => setItemAdjustTarget({ id: item.id, direction: 'in' }) : undefined}
                      onOut={inventoryIdSet.has(item.id) ? () => setItemAdjustTarget({ id: item.id, direction: 'out' }) : undefined}
                      onDelete={inventoryIdSet.has(item.id) ? () => void handleDeleteItem(item.id, item.name) : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
          {isLoadingData && filteredCategories.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">
              Loading inventory...
            </div>
          )}
          {!isLoadingData && filteredCategories.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500">
              No inventory items found.
            </div>
          )}
        </div>
      )}

      {tab === 'packaging' && (
        <div className="fade-in">
          <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-6">Pack Food Package</h3>

            <div className="grid md:grid-cols-[1fr_180px_160px] gap-4 items-end">
              <label className="block">
                <span className="block text-sm font-medium text-gray-600 mb-2">Package</span>
                <select
                  className="w-full h-11 px-4 border-[1.5px] border-[#E8E8E8] rounded-full bg-white text-[#1A1A1A]"
                  value={packPackageId}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setPackPackageId(Number.isNaN(value) ? '' : value)
                  }}
                >
                  <option value="">Select package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-600 mb-2">Quantity</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={packQuantity}
                  onChange={(event) => setPackQuantity(event.target.value)}
                  className="w-full h-11 px-4 border-[1.5px] border-[#E8E8E8] rounded-full bg-white text-[#1A1A1A]"
                />
              </label>

              <button
                onClick={() => void handlePackPackage()}
                disabled={isPacking}
                className="h-11 px-5 rounded-full bg-[#F7DC6F] border-[1.5px] border-[#F7DC6F] text-[#1A1A1A] font-semibold hover:bg-[#F0C419] disabled:opacity-60"
              >
                {isPacking ? 'Packing...' : 'Pack'}
              </button>
            </div>

            {packFeedback && (
              <div className="mt-4 rounded-xl border border-[#E8E8E8] bg-[#F5F5F5] px-4 py-3 text-sm text-[#1A1A1A]">
                {packFeedback}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'lots' && (
        <div className="fade-in">
          {lotError && (
            <div className="mb-6 rounded-xl border border-[#E63946]/30 bg-[#E63946]/[0.08] px-4 py-3 text-sm text-[#E63946]">
              {lotError}
            </div>
          )}

          <div className="overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-[#F5F5F5]">
                  {['Lot ID', 'Item', 'Quantity', 'Expiry', 'Received', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotRows.map((lot) => (
                  <tr
                    key={lot.id}
                    className={`border-b border-[#E8E8E8] ${lot.status !== 'active' ? 'bg-[#E63946]/[0.08]' : ''}`}
                  >
                    <td className="p-4">#{lot.id}</td>
                    <td className="p-4">{lot.item_name}</td>
                    <td className="p-4">{lot.quantity}</td>
                    <td className="p-4">{lot.expiry_date}</td>
                    <td className="p-4">{lot.received_date}</td>
                    <td className="p-4 capitalize">{lot.status}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleLotDamage(lot.id)}
                          className="px-3 py-1.5 border-[1.5px] border-[#E63946] text-[#E63946] rounded-full text-xs font-medium hover:bg-[#E63946]/5 bg-transparent"
                        >
                          Report Loss
                        </button>
                        <button
                          onClick={() => void handleLotExpiryEdit(lot.id, lot.expiry_date)}
                          className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent"
                        >
                          Edit Expiry
                        </button>
                        <button
                          onClick={() => void handleLotStatusToggle(lot.id, lot.status)}
                          className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent"
                        >
                          {lot.status === 'active' ? 'Mark Wasted' : 'Mark Active'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoadingLots && lotRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      Loading inventory lots...
                    </td>
                  </tr>
                )}
                {!isLoadingLots && lotRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      No inventory lots available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'low-stock' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <input
              type="number"
              min={0}
              placeholder="Optional threshold"
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
              className="h-11 px-4 border-[1.5px] border-[#E8E8E8] rounded-full bg-white text-[#1A1A1A] w-full sm:w-[220px]"
            />
            <button
              onClick={() => void handleRefreshLowStock()}
              disabled={isLoadingLowStock}
              className="h-11 px-5 rounded-full bg-[#F7DC6F] border-[1.5px] border-[#F7DC6F] text-[#1A1A1A] font-semibold hover:bg-[#F0C419] disabled:opacity-60"
            >
              {isLoadingLowStock ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {lowStockError && (
            <div className="mb-6 rounded-xl border border-[#E63946]/30 bg-[#E63946]/[0.08] px-4 py-3 text-sm text-[#E63946]">
              {lowStockError}
            </div>
          )}

          {restockError && (
            <div className="mb-6 rounded-xl border border-[#E63946]/30 bg-[#E63946]/[0.08] px-4 py-3 text-sm text-[#E63946]">
              {restockError}
            </div>
          )}

          <div className="overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-[#F5F5F5]">
                  {['Item', 'Category', 'Current', 'Threshold', 'Deficit', 'Unit', 'Restock'].map((h) => (
                    <th key={h} className="p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStockRows.map((item) => (
                  <tr key={item.id} className="border-b border-[#E8E8E8] bg-[#E63946]/[0.08]">
                    <td className="p-4">{item.name}</td>
                    <td className="p-4">{item.category}</td>
                    <td className="p-4">{item.current_stock}</td>
                    <td className="p-4">{item.threshold}</td>
                    <td className="p-4 text-[#E63946] font-semibold">{item.stock_deficit}</td>
                    <td className="p-4">{item.unit}</td>
                    <td className="p-4">
                      <button
                        onClick={() => void createRestockRequest(item)}
                        disabled={openRestockItemIds.has(item.id) || restockActionId === item.id}
                        className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent disabled:opacity-60"
                      >
                        {openRestockItemIds.has(item.id) ? 'Requested' : restockActionId === item.id ? 'Working...' : 'Create Request'}
                      </button>
                    </td>
                  </tr>
                ))}
                {isLoadingLowStock && lowStockRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      Loading low stock items...
                    </td>
                  </tr>
                )}
                {!isLoadingLowStock && lowStockRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      No low stock items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b-[1.5px] border-[#E8E8E8] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A1A1A]">Open Restock Requests</h3>
              <button
                onClick={() => void loadRestockRequests()}
                disabled={isLoadingRestockRequests}
                className="px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50 disabled:opacity-60"
              >
                {isLoadingRestockRequests ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F5F5F5]">
                  {['Request ID', 'Item ID', 'Current', 'Threshold', 'Urgency', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openRestockRequests.map((request) => (
                  <tr key={request.id} className="border-b border-[#E8E8E8]">
                    <td className="p-4">#{request.id}</td>
                    <td className="p-4">{request.inventory_item_id}</td>
                    <td className="p-4">{request.current_stock}</td>
                    <td className="p-4">{request.threshold}</td>
                    <td className="p-4 uppercase">{request.urgency}</td>
                    <td className="p-4">{request.created_at}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void fulfilRestockRequest(request.id)}
                          disabled={restockActionId === request.id}
                          className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent disabled:opacity-60"
                        >
                          Fulfil
                        </button>
                        <button
                          onClick={() => setRestockConfirmTarget({ id: request.id, mode: 'cancel' })}
                          disabled={restockActionId === request.id}
                          className="px-3 py-1.5 border-[1.5px] border-[#E63946] text-[#E63946] rounded-full text-xs font-medium hover:bg-[#E63946]/5 bg-transparent disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoadingRestockRequests && openRestockRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      Loading restock requests...
                    </td>
                  </tr>
                )}
                {!isLoadingRestockRequests && openRestockRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-gray-500">
                      No open restock requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddItemModal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} />
      <AddPackageModal isOpen={isAddPackageOpen} onClose={() => setIsAddPackageOpen(false)} />

      <EditNameThresholdModal
        isOpen={itemEditTarget !== null}
        onClose={() => setItemEditTarget(null)}
        title="Edit Item"
        nameLabel="Item Name"
        thresholdLabel="Safety Threshold"
        initialName={itemEditTarget?.name ?? ''}
        initialThreshold={itemEditTarget?.threshold ?? 0}
        submitLabel="Save Item"
        onSubmit={submitItemEdit}
      />

      <EditNameThresholdModal
        isOpen={packageEditTarget !== null}
        onClose={() => setPackageEditTarget(null)}
        title="Edit Package"
        nameLabel="Package Name"
        thresholdLabel="Safety Threshold"
        initialName={packageEditTarget?.name ?? ''}
        initialThreshold={packageEditTarget?.threshold ?? 0}
        submitLabel="Save Package"
        onSubmit={submitPackageEdit}
      />

      <AdjustStockModal
        isOpen={itemAdjustTarget !== null}
        onClose={() => setItemAdjustTarget(null)}
        title={itemAdjustTarget?.direction === 'out' ? 'Stock Out Item' : 'Stock In Item'}
        quantityLabel="Quantity"
        submitLabel={itemAdjustTarget?.direction === 'out' ? 'Apply Stock Out' : 'Apply Stock In'}
        onSubmit={submitItemAdjust}
      />

      <QuantityPromptModal
        isOpen={lotDamageTarget !== null}
        onClose={() => setLotDamageTarget(null)}
        title="Report Inventory Loss"
        description={lotDamageTarget ? `Record damaged or lost quantity for ${lotDamageTarget.itemName}.` : ''}
        submitLabel="Save Damage"
        submitting={isActionBusy('lot-damage')}
        onSubmit={submitLotDamage}
      />

      <DatePromptModal
        isOpen={lotExpiryTarget !== null}
        onClose={() => setLotExpiryTarget(null)}
        title="Edit Lot Expiry"
        description={lotExpiryTarget ? `Update the expiry date for ${lotExpiryTarget.itemName}.` : ''}
        initialValue={lotExpiryTarget?.expiryDate ?? ''}
        submitLabel="Save Expiry"
        submitting={isActionBusy('lot-expiry')}
        onSubmit={submitLotExpiryEdit}
      />

      <ConfirmActionModal
        isOpen={lotStatusTarget !== null}
        onClose={() => setLotStatusTarget(null)}
        title={lotStatusTarget?.currentStatus === 'active' ? 'Mark Lot as Wasted' : 'Reactivate Lot'}
        message={
          lotStatusTarget
            ? lotStatusTarget.currentStatus === 'active'
              ? `Mark ${lotStatusTarget.itemName} as wasted? This lot will stop counting toward active stock.`
              : `Mark ${lotStatusTarget.itemName} as active again? This lot will count toward stock totals.`
            : ''
        }
        confirmLabel={lotStatusTarget?.currentStatus === 'active' ? 'Mark Wasted' : 'Mark Active'}
        confirmTone={lotStatusTarget?.currentStatus === 'active' ? 'danger' : 'neutral'}
        submitting={isActionBusy('lot-status')}
        onConfirm={submitLotStatusToggle}
      />

      <ConfirmActionModal
        isOpen={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        title="Delete Inventory Item"
        message={
          deleteItemTarget
            ? `Delete ${deleteItemTarget.itemName}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Item"
        confirmTone="danger"
        submitting={isActionBusy('delete-item')}
        onConfirm={submitDeleteItem}
      />

      <ConfirmActionModal
        isOpen={restockConfirmTarget !== null}
        onClose={() => setRestockConfirmTarget(null)}
        title={restockConfirmTarget?.mode === 'fulfil' ? 'Fulfil Restock Request' : 'Cancel Restock Request'}
        message={
          restockConfirmTarget?.mode === 'fulfil'
            ? 'Fulfil this request and add a replenishment lot up to the threshold?'
            : 'Cancel this open restock request?'
        }
        confirmLabel={restockConfirmTarget?.mode === 'fulfil' ? 'Fulfil Request' : 'Cancel Request'}
        confirmTone={restockConfirmTarget?.mode === 'cancel' ? 'danger' : 'neutral'}
        submitting={isActionBusy(restockConfirmTarget?.mode === 'fulfil' ? 'restock-fulfil' : 'restock-cancel')}
        onConfirm={submitRestockConfirm}
      />
      <PublicSiteFooter />
    </div>
  )
}
