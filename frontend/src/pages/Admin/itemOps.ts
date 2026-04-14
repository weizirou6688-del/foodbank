import type { Dispatch, SetStateAction } from 'react'
import { adminAPI } from '@/shared/lib/api/admin'
import type { InventoryItem } from '@/shared/types/inventory'
import { makeTaskRunner, type BusySetter, type ErrorSetter } from './runTask'
import { resolveScopedFoodBankId } from './builders'
import { parseUkDateInput } from './formatting'
import type { DeleteItemTarget, InventoryEditorDraft, InventoryStockInDraft, PackageRow, PageFeedback, PendingAction } from './adminFoodManagement.types'
import { findPackagesReferencingItem } from './rules'

type ItemEditorTarget = { mode: 'create' | 'edit'; itemId: number | null } | null

type CreateAdminInventoryItemActionsParams = {
  accessToken: string | null; sessionExpiredMessage: string
  adminScopeFoodBankId: number | null; selectedFoodBankId: number | null; scopedInventoryItems: InventoryItem[]; scopedPackageRows: PackageRow[]
  itemEditorTarget: ItemEditorTarget; itemEditorDraft: InventoryEditorDraft; setItemEditorError: ErrorSetter; setIsItemEditorSubmitting: BusySetter
  resetItemEditor: (target?: ItemEditorTarget, item?: InventoryItem | null) => void; closeItemEditor: () => void
  stockInTarget: InventoryItem | null; stockInDraft: InventoryStockInDraft; setStockInError: ErrorSetter; setIsStockingIn: BusySetter
  resetStockInEditor: (target?: InventoryItem | null) => void; closeStockInEditor: () => void
  deleteItemTarget: DeleteItemTarget | null; setDeleteItemTarget: Dispatch<SetStateAction<DeleteItemTarget | null>>
  setPendingAction: Dispatch<SetStateAction<PendingAction>>; setPageNotice: (tone: PageFeedback['tone'], message: string) => void
  refreshInventoryAndLots: () => Promise<unknown>; deleteItem: (itemId: number) => Promise<unknown>
}

export function makeItemOps({
  accessToken, sessionExpiredMessage, adminScopeFoodBankId, selectedFoodBankId, scopedInventoryItems, scopedPackageRows,
  itemEditorTarget, itemEditorDraft, setItemEditorError, setIsItemEditorSubmitting, resetItemEditor, closeItemEditor,
  stockInTarget, stockInDraft, setStockInError, setIsStockingIn, resetStockInEditor, closeStockInEditor,
  deleteItemTarget, setDeleteItemTarget, setPendingAction, setPageNotice, refreshInventoryAndLots, deleteItem,
}: CreateAdminInventoryItemActionsParams) {
  const { runBusyTask, runPendingTask } = makeTaskRunner({ accessToken, sessionExpiredMessage, setPageNotice, setPendingAction })
  const resolveCreationFoodBankId = () => resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)
  const getScopedInventoryItemOrNotify = (itemId: number) => {
    const item = scopedInventoryItems.find((entry) => entry.id === itemId)
    if (!item) setPageNotice('error', 'Inventory item not found.')
    return item ?? null
  }
  const withScopedInventoryItem = (itemId: number, onFound: (item: InventoryItem) => void) => {
    const item = getScopedInventoryItemOrNotify(itemId)
    if (item) onFound(item)
  }
  const openItemEditor = (mode: 'create' | 'edit', itemId?: number) => {
    if (mode === 'create') {
      if (!resolveCreationFoodBankId()) return void setPageNotice('error', 'Choose a food bank before creating an item.')
      return void resetItemEditor({ mode, itemId: null })
    }
    if (typeof itemId === 'number') withScopedInventoryItem(itemId, (item) => resetItemEditor({ mode, itemId: item.id }, item))
  }

  const submitItemEditor = async () => {
    if (!itemEditorTarget) return void setItemEditorError(sessionExpiredMessage)
    const name = itemEditorDraft.name.trim(), category = itemEditorDraft.category.trim(), unit = itemEditorDraft.unit.trim(), threshold = Number(itemEditorDraft.threshold)
    const foodBankId = itemEditorTarget.mode === 'create' ? resolveCreationFoodBankId() : null
    if (!name || !category || !unit) return void setItemEditorError('Please complete all item fields before saving.')
    if (!Number.isInteger(threshold) || threshold < 0) return void setItemEditorError('Safety threshold must be a non-negative integer.')
    if (itemEditorTarget.mode === 'create' && !foodBankId) return void setItemEditorError('Choose a food bank before creating an item.')
    if (itemEditorTarget.mode === 'edit' && !itemEditorTarget.itemId) return void setItemEditorError('Inventory item not found.')
    await runBusyTask({
      setBusy: setIsItemEditorSubmitting,
      setError: setItemEditorError,
      fallbackMessage: 'Failed to save inventory item.',
      task: async (token) => {
        if (itemEditorTarget.mode === 'create') await adminAPI.createInventoryItem({ name, category, unit, threshold, initial_stock: 0, food_bank_id: foodBankId! }, token)
        else await adminAPI.updateInventoryItem(itemEditorTarget.itemId!, { name, category, unit, threshold }, token)
        await refreshInventoryAndLots()
        closeItemEditor()
        setPageNotice('success', itemEditorTarget.mode === 'create' ? 'Inventory item added.' : 'Inventory item saved.')
      },
    })
  }

  const submitStockIn = async () => {
    if (!stockInTarget) return void setStockInError(sessionExpiredMessage)
    const quantity = Number(stockInDraft.quantity), expiryInput = stockInDraft.expiryDate.trim(), normalizedExpiryDate = expiryInput ? parseUkDateInput(expiryInput) : undefined
    if (!Number.isInteger(quantity) || quantity <= 0) return void setStockInError('Quantity must be a positive integer.')
    if (expiryInput && !normalizedExpiryDate) return void setStockInError('Expiry date must use DD/MM/YYYY.')
    await runBusyTask({
      setBusy: setIsStockingIn,
      setError: setStockInError,
      fallbackMessage: 'Failed to stock in inventory item.',
      task: async (token) => {
        await adminAPI.stockInInventoryItem(stockInTarget.id, { quantity, reason: 'admin manual stock-in', expiry_date: normalizedExpiryDate ?? undefined }, token)
        await refreshInventoryAndLots()
        closeStockInEditor()
        setPageNotice('success', `${stockInTarget.name} stock updated.`)
      },
    })
  }

  const openItemStockEditor = (itemId: number) => withScopedInventoryItem(itemId, resetStockInEditor)
  const formatReferencedPackageConflict = (target: DeleteItemTarget) => {
    const preview = target.referencedByPackages.slice(0, 3).join(', '), suffix = target.referencedByPackages.length > 3 ? ', ...' : ''
    return `Cannot delete this item because it is referenced by: ${preview}${suffix}`
  }
  const submitDeleteItem = async () => {
    const target = deleteItemTarget
    if (!target) return
    await runPendingTask({
      action: 'delete-item',
      fallbackMessage: 'Failed to delete inventory item.',
      task: async () => { await deleteItem(target.id); setDeleteItemTarget(null); setPageNotice('success', `Deleted ${target.itemName}.`) },
      onError: (message) => {
        const normalizedMessage = message.toLowerCase(), isConflict = normalizedMessage.includes('used in packages') || normalizedMessage.includes('conflict')
        setPageNotice('error', isConflict && target.referencedByPackages.length > 0 ? formatReferencedPackageConflict(target) : message)
      },
    })
  }

  return {
    openNewItemEditor: () => openItemEditor('create'), openEditItemEditor: ({ id }: { id: number }) => openItemEditor('edit', id), submitItemEditor,
    openItemStockInEditor: openItemStockEditor, openItemAdjustModal: openItemStockEditor, submitStockIn,
    handleDeleteItem: (itemId: number, itemName: string) => setDeleteItemTarget({ id: itemId, itemName, referencedByPackages: findPackagesReferencingItem(scopedPackageRows, itemId, itemName) }),
    submitDeleteItem,
  }
}


