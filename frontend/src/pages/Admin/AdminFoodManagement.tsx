import { useState } from 'react'
import AddItemModal from '@/features/admin/components/AddItemModal'
import { AdminPageHeading } from '@/features/admin/components/AdminDisplayPrimitives'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import AddPackageModal from '@/features/admin/components/AddPackageModal'
import AdjustStockModal from '@/features/admin/components/AdjustStockModal'
import ConfirmActionModal from '@/features/admin/components/ConfirmActionModal'
import DatePromptModal from '@/features/admin/components/DatePromptModal'
import EditNameThresholdModal from '@/features/admin/components/EditNameThresholdModal'
import QuantityPromptModal from '@/features/admin/components/QuantityPromptModal'
import { adminAPI, restockAPI } from '@/shared/lib/api'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import {
  AdminFoodManagementTabs,
  AdminItemsSection,
  AdminLotsSection,
  AdminLowStockSection,
  AdminPackagesSection,
  AdminPackingSection,
} from './adminFoodManagement.sections'
import type {
  DeleteItemTarget,
  FoodManagementTab,
  ItemAdjustTarget,
  LotDamageTarget,
  LotExpiryTarget,
  LotStatusTarget,
  LowStockRow,
  NameThresholdTarget,
  PageFeedback,
  PendingAction,
  RestockConfirmTarget,
} from './adminFoodManagement.types'
import {
  findPackagesReferencingItem,
  getRestockUrgency,
  toErrorMessage,
} from './adminFoodManagement.utils'
import { useAdminFoodManagementData } from './useAdminFoodManagementData'

interface Props {
  onSwitch: (s: 'statistics' | 'food') => void
}

export default function AdminFoodManagement({ onSwitch: _onSwitch }: Props) {
  const [tab, setTab] = useState<FoodManagementTab>('packages')
  const [search, setSearch] = useState('')
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false)
  const [itemEditTarget, setItemEditTarget] = useState<NameThresholdTarget | null>(null)
  const [packageEditTarget, setPackageEditTarget] = useState<NameThresholdTarget | null>(null)
  const [itemAdjustTarget, setItemAdjustTarget] = useState<ItemAdjustTarget | null>(null)
  const [packPackageId, setPackPackageId] = useState<number | ''>('')
  const [packQuantity, setPackQuantity] = useState('1')
  const [isPacking, setIsPacking] = useState(false)
  const [packFeedback, setPackFeedback] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [restockActionId, setRestockActionId] = useState<number | null>(null)
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null)
  const [lotDamageTarget, setLotDamageTarget] = useState<LotDamageTarget | null>(null)
  const [lotExpiryTarget, setLotExpiryTarget] = useState<LotExpiryTarget | null>(null)
  const [lotStatusTarget, setLotStatusTarget] = useState<LotStatusTarget | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<DeleteItemTarget | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [restockConfirmTarget, setRestockConfirmTarget] = useState<RestockConfirmTarget | null>(null)
  const {
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
  } = useAdminFoodManagementData(search)

  const sessionExpiredMessage = 'Please login again and retry.'
  const getLotOrNotify = (lotId: number) => {
    const lot = lotRows.find((entry) => entry.id === lotId)
    if (!lot) {
      setPageFeedback({ tone: 'error', message: 'Inventory lot not found.' })
      return null
    }

    return lot
  }

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
      setPackFeedback(toErrorMessage(error, 'Failed to pack package.'))
    } finally {
      setIsPacking(false)
    }
  }

  const handleLotDamage = (lotId: number) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setLotDamageTarget({ id: lotId, itemName: lot.item_name })
  }

  const submitLotDamage = async (damageQuantity: number) => {
    if (!lotDamageTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setPendingAction('lot-damage')
    try {
      await adminAPI.adjustInventoryLot(lotDamageTarget.id, { damage_quantity: damageQuantity }, accessToken)
      await Promise.all([loadLots(), loadLowStock(), loadInventory()])
      setLotDamageTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot damaged quantity updated.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to report damage.') })
    } finally {
      setPendingAction(null)
    }
  }

  const handleLotExpiryEdit = (lotId: number, currentExpiryDate: string) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setLotExpiryTarget({ id: lotId, itemName: lot.item_name, expiryDate: currentExpiryDate })
  }

  const submitLotExpiryEdit = async (expiryDate: string) => {
    if (!lotExpiryTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setPendingAction('lot-expiry')
    try {
      await adminAPI.adjustInventoryLot(lotExpiryTarget.id, { expiry_date: expiryDate }, accessToken)
      await Promise.all([loadLots(), loadLowStock()])
      setLotExpiryTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot expiry date updated.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to update expiry date.') })
    } finally {
      setPendingAction(null)
    }
  }

  const handleLotStatusToggle = (lotId: number, currentStatus: LotStatusTarget['currentStatus']) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
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
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
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
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to update lot status.') })
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

  const handleDeleteItem = (itemId: number, itemName: string) => {
    setDeleteItemTarget({
      id: itemId,
      itemName,
      referencedByPackages: findPackagesReferencingItem(packageRows, itemId, itemName),
    })
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
      const message = toErrorMessage(error, 'Failed to delete inventory item.')

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
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setRestockActionId(item.id)
    try {
      await restockAPI.submitRequest({
        inventory_item_id: item.id,
        current_stock: item.current_stock,
        threshold: item.threshold,
        urgency: getRestockUrgency(item),
      }, accessToken)
      await Promise.all([loadRestockRequests(), loadLowStock()])
      setPageFeedback({ tone: 'success', message: `Restock request created for ${item.name}.` })
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to create restock request.')
      if (message.toLowerCase().includes('already exists')) {
        await loadRestockRequests()
      }
      setPageFeedback({ tone: 'error', message })
    } finally {
      setRestockActionId(null)
    }
  }

  const fulfilRestockRequest = (requestId: number) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setRestockConfirmTarget({ id: requestId, mode: 'fulfil' })
  }

  const submitRestockConfirm = async () => {
    if (!restockConfirmTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
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
      const message = toErrorMessage(
        error,
        restockConfirmTarget.mode === 'fulfil'
          ? 'Failed to fulfil restock request.'
          : 'Failed to cancel restock request.',
      )
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
      setRestockActionId(null)
    }
  }

  const openPackTab = (packageId: number) => {
    setPackPackageId(packageId)
    setTab('packaging')
  }

  const openItemAdjustModal = (itemId: number, direction: 'in' | 'out') => {
    setItemAdjustTarget({ id: itemId, direction })
  }

  const openRestockCancelConfirm = (requestId: number) => {
    setRestockConfirmTarget({ id: requestId, mode: 'cancel' })
  }

  return (
    <div className="fade-in">
      <AdminPageHeading className="mb-8">
        Food Management
      </AdminPageHeading>

      {loadError && (
        <AdminFeedbackBanner tone="error" message={loadError} />
      )}

      {pageFeedback && (
        <AdminFeedbackBanner
          tone={pageFeedback.tone}
          message={pageFeedback.message}
          onClose={() => setPageFeedback(null)}
        />
      )}

      <AdminFoodManagementTabs activeTab={tab} onChange={setTab} />

      {tab === 'packages' && (
        <AdminPackagesSection
          packageRows={packageRows}
          isLoadingData={isLoadingData}
          onAddPackage={() => setIsAddPackageOpen(true)}
          onEditPackage={setPackageEditTarget}
          onOpenPackTab={openPackTab}
        />
      )}

      {tab === 'items' && (
        <AdminItemsSection
          search={search}
          filteredCategories={filteredCategories}
          inventoryIdSet={inventoryIdSet}
          isLoadingData={isLoadingData}
          onSearchChange={setSearch}
          onAddItem={() => setIsAddItemOpen(true)}
          onEditItem={setItemEditTarget}
          onAdjustItem={openItemAdjustModal}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {tab === 'packaging' && (
        <AdminPackingSection
          packages={packages}
          packPackageId={packPackageId}
          packQuantity={packQuantity}
          isPacking={isPacking}
          packFeedback={packFeedback}
          onSelectPackage={setPackPackageId}
          onQuantityChange={setPackQuantity}
          onPack={() => void handlePackPackage()}
        />
      )}

      {tab === 'lots' && (
        <AdminLotsSection
          lotRows={lotRows}
          isLoadingLots={isLoadingLots}
          lotError={lotError}
          onReportDamage={handleLotDamage}
          onEditExpiry={handleLotExpiryEdit}
          onToggleStatus={handleLotStatusToggle}
        />
      )}

      {tab === 'low-stock' && (
        <AdminLowStockSection
          lowStockThreshold={lowStockThreshold}
          lowStockRows={lowStockRows}
          openRestockItemIds={openRestockItemIds}
          openRestockRequests={openRestockRequests}
          restockActionId={restockActionId}
          isLoadingLowStock={isLoadingLowStock}
          isLoadingRestockRequests={isLoadingRestockRequests}
          lowStockError={lowStockError}
          restockError={restockError}
          onThresholdChange={setLowStockThreshold}
          onRefreshLowStock={() => void handleRefreshLowStock()}
          onCreateRestockRequest={(item) => void createRestockRequest(item)}
          onRefreshRestockRequests={() => void loadRestockRequests()}
          onFulfilRestockRequest={fulfilRestockRequest}
          onCancelRestockRequest={openRestockCancelConfirm}
        />
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
