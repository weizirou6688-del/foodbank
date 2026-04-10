import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { adminAPI, restockAPI } from '@/shared/lib/api'
import type {
  InventoryLotRow,
  LowStockRow,
  RestockRequestRow,
} from './adminFoodManagement.types'
import {
  buildInventoryCategories,
  buildPackageRows,
  extractRestockRequests,
  filterInventoryCategories,
  toErrorMessage,
} from './adminFoodManagement.utils'

const captureLoadError = async (
  task: () => Promise<void>,
  fallbackMessage: string,
) => {
  try {
    await task()
    return ''
  } catch (error) {
    return toErrorMessage(error, fallbackMessage)
  }
}

export function useAdminFoodManagementData(search: string) {
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

  const [isLoadingData, setIsLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [lotRows, setLotRows] = useState<InventoryLotRow[]>([])
  const [isLoadingLots, setIsLoadingLots] = useState(false)
  const [lotError, setLotError] = useState('')
  const [lowStockRows, setLowStockRows] = useState<LowStockRow[]>([])
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false)
  const [lowStockError, setLowStockError] = useState('')
  const [restockRequests, setRestockRequests] = useState<RestockRequestRow[]>([])
  const [isLoadingRestockRequests, setIsLoadingRestockRequests] = useState(false)
  const [restockError, setRestockError] = useState('')

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
      setLotError(toErrorMessage(error, 'Failed to load inventory lots.'))
      throw error
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
      setLowStockError(toErrorMessage(error, 'Failed to load low stock items.'))
      throw error
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
      setRestockRequests(extractRestockRequests(data))
    } catch (error) {
      setRestockError(toErrorMessage(error, 'Failed to load restock requests.'))
      throw error
    } finally {
      setIsLoadingRestockRequests(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadAll = async () => {
      setIsLoadingData(true)
      setLoadError('')

      const errors = await Promise.all([
        captureLoadError(loadPackages, 'Failed to load packages.'),
        captureLoadError(loadInventory, 'Failed to load inventory.'),
        captureLoadError(loadLots, 'Failed to load inventory lots.'),
        captureLoadError(() => loadLowStock(), 'Failed to load low stock items.'),
        captureLoadError(loadRestockRequests, 'Failed to load restock requests.'),
      ])

      if (cancelled) {
        return
      }

      setLoadError(errors.find(Boolean) ?? '')
      setIsLoadingData(false)
    }

    void loadAll()

    return () => {
      cancelled = true
    }
  }, [accessToken, loadInventory, loadPackages])

  const packageRows = useMemo(() => buildPackageRows(packages), [packages])
  const inventoryIdSet = useMemo(
    () => new Set(inventory.map((item) => item.id)),
    [inventory],
  )
  const filteredCategories = useMemo(
    () => filterInventoryCategories(buildInventoryCategories(inventory), search),
    [inventory, search],
  )
  const openRestockRequests = useMemo(
    () => restockRequests.filter((request) => request.status === 'open'),
    [restockRequests],
  )
  const openRestockItemIds = useMemo(
    () => new Set(openRestockRequests.map((request) => request.inventory_item_id)),
    [openRestockRequests],
  )

  return {
    accessToken,
    packages,
    updateItem,
    stockInItem,
    stockOutItem,
    deleteItem,
    updatePackage,
    loadPackages,
    loadInventory,
    isLoadingData,
    loadError,
    lotRows,
    isLoadingLots,
    lotError,
    lowStockRows,
    isLoadingLowStock,
    lowStockError,
    setLowStockError,
    isLoadingRestockRequests,
    restockError,
    packageRows,
    inventoryIdSet,
    filteredCategories,
    openRestockRequests,
    openRestockItemIds,
    loadLots,
    loadLowStock,
    loadRestockRequests,
  }
}
