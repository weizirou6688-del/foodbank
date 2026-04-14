import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InventoryItem } from '@/shared/types/inventory'
import { buildLotReference, toggleSelectedGroup, toggleSelectedId } from './builders'
import { AdminActionGroup, AdminButton } from './chrome'
import { formatUkDate, getDaysUntilDate } from './formatting'
import {
  AdminTableActionButtons,
  ConfigurableSelectableTableSection,
  type AdminTableRowAction,
  type TableColumn,
} from './adminFoodManagement.selectableTable'
import {
  AdminSummaryCard,
  AdminSummaryCardDetails,
  ConfigurableAdminCardSection,
  type FilterOption,
  type FoodBankOption,
} from './sectionBits'
import { buildFilterOptions } from './listHelpers'
import { matchesSearch, normalizeSearch } from './rules'
import type { InventoryLotRow, NameThresholdTarget } from './adminFoodManagement.types'

type AdminItemsSectionProps = {
  search: string
  inventoryItems: InventoryItem[]
  isLoadingData: boolean
  onSearchChange: (value: string) => void
  onAddItem: () => void
  onEditItem: (target: NameThresholdTarget) => void
  onAdjustItem: (itemId: number) => void
  onDeleteItem: (itemId: number, itemName: string) => void
  foodBankOptions?: FoodBankOption[]
  selectedFoodBankId?: number | null
  onFoodBankChange?: (foodBankId: number | null) => void
  searchDisabled?: boolean
  searchPlaceholder?: string
  searchScopeKey?: string
  sectionError?: string
}

type AdminLotsSectionProps = {
  inventoryItems: InventoryItem[]
  lotRows: InventoryLotRow[]
  isLoadingLots: boolean
  lotError: string
  onEditExpiry: (lotId: number, expiryDate: string) => void
  onToggleStatus: (lotId: number, status: InventoryLotRow['status']) => void
  onDeleteLot: (lotId: number) => Promise<void>
  onBatchWasteLots: (lotIds: number[]) => Promise<void>
  onBatchDeleteLots: (lotIds: number[]) => Promise<void>
  heading?: string
}

type LotTableRow = InventoryLotRow & {
  category: string
  reference: string
  receivedDateLabel: string
  expiryDateLabel: string
  statusLabel: string
  statusColor: string
  canDelete: boolean
  canMarkWasted: boolean
}

type LotActionHandlers = Pick<AdminLotsSectionProps, 'onEditExpiry' | 'onToggleStatus' | 'onDeleteLot'>

const LOT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'Expiring Soon', label: 'Expiring Soon' },
  { value: 'Expired', label: 'Expired' },
]

const buildItemDetailRows = (item: InventoryItem) => [
  { label: 'Current Stock', value: `${item.stock} ${item.unit}` },
  { label: 'Safety Threshold', value: `${item.threshold} ${item.unit}` },
  { label: 'Deficit', value: Math.max(item.threshold - item.stock, 0) },
]

const isLotExpiringSoon = (lot: InventoryLotRow) =>
  lot.status === 'active' &&
  (() => {
    const diffDays = getDaysUntilDate(lot.expiry_date)
    return diffDays != null && diffDays >= 0 && diffDays <= 14
  })()

const getLotStatusMeta = (lot: InventoryLotRow) =>
  lot.status === 'wasted' || lot.status === 'expired'
    ? {
        label: lot.status === 'wasted' ? 'Wasted' : 'Expired',
        color: 'var(--color-error)',
      }
    : isLotExpiringSoon(lot)
      ? { label: 'Expiring Soon', color: 'var(--color-warning)' }
      : { label: 'Active', color: 'var(--color-text-dark)' }

const buildLotTableRow = (lot: InventoryLotRow, category: string): LotTableRow => {
  const statusMeta = getLotStatusMeta(lot)
  return {
    ...lot,
    category,
    reference: buildLotReference(lot),
    receivedDateLabel: formatUkDate(lot.received_date),
    expiryDateLabel: formatUkDate(lot.expiry_date),
    statusLabel: statusMeta.label,
    statusColor: statusMeta.color,
    canDelete: lot.status !== 'active',
    canMarkWasted: lot.status === 'active' && statusMeta.label === 'Expiring Soon',
  }
}

const buildLotTableActions = (lot: LotTableRow, handlers: LotActionHandlers): AdminTableRowAction[] => {
  const actions: AdminTableRowAction[] = []

  if (!lot.canDelete) {
    actions.push({ label: 'Edit', tone: 'secondary', className: 'edit-lot-btn', onClick: () => handlers.onEditExpiry(lot.id, lot.expiry_date) })
  }
  if (lot.canMarkWasted) {
    actions.push({ label: 'Mark Wasted', tone: 'danger', className: 'mark-wasted-btn', onClick: () => handlers.onToggleStatus(lot.id, lot.status) })
  }
  if (lot.canDelete) {
    actions.push({ label: 'Delete', tone: 'secondary', className: 'delete-lot-btn', onClick: () => { void handlers.onDeleteLot(lot.id) } })
  }

  return actions
}

const createLotColumns = (handlers: LotActionHandlers): TableColumn<LotTableRow>[] => [
  { header: 'Item Name', renderCell: (lot) => lot.item_name },
  { header: 'Lot Number', renderCell: (lot) => lot.reference },
  { header: 'Received Date', renderCell: (lot) => lot.receivedDateLabel },
  { header: 'Expiry Date', renderCell: (lot) => lot.expiryDateLabel },
  { header: 'Remaining Stock', renderCell: (lot) => lot.quantity },
  { header: 'Status', renderCell: (lot) => <span style={{ color: lot.statusColor, fontWeight: 600 }}>{lot.statusLabel}</span> },
  { header: 'Actions', renderCell: (lot) => <AdminTableActionButtons rowKey={lot.id} actions={buildLotTableActions(lot, handlers)} /> },
]

function renderItemCard(item: InventoryItem, handlers: Pick<AdminItemsSectionProps, 'onEditItem' | 'onAdjustItem' | 'onDeleteItem'>): ReactNode {
  const isBelowThreshold = item.stock < item.threshold

  return (
    <AdminSummaryCard
      key={item.id}
      className={isBelowThreshold ? 'card-error' : undefined}
      data-item-id={item.id}
      title={item.name}
      details={<AdminSummaryCardDetails rows={buildItemDetailRows(item)} />}
      note={isBelowThreshold ? <span className="threshold-warning-notice">Stock is below the safety threshold. Replenish this item soon.</span> : null}
      actions={
        <AdminActionGroup variant="card">
          <AdminButton
            tone="secondary"
            size="sm"
            className="edit-item-btn"
            onClick={() =>
              handlers.onEditItem({
                id: item.id,
                name: item.name,
                threshold: item.threshold,
              })
            }
          >
            Edit
          </AdminButton>
          <AdminButton size="sm" className="stock-in-btn" onClick={() => handlers.onAdjustItem(item.id)}>
            + Stock
          </AdminButton>
          <AdminButton tone="danger" size="sm" className="delete-item-btn" onClick={() => handlers.onDeleteItem(item.id, item.name)}>
            Delete
          </AdminButton>
        </AdminActionGroup>
      }
    />
  )
}

export function AdminItemsSection({ search, inventoryItems, isLoadingData, onSearchChange, onAddItem, onEditItem, onAdjustItem, onDeleteItem, foodBankOptions, selectedFoodBankId, onFoodBankChange, searchDisabled = false, searchPlaceholder = 'Search inventory items', searchScopeKey = '', sectionError = '' }: AdminItemsSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    setCategoryFilter('')
  }, [searchScopeKey])

  const categoryOptions = useMemo<FilterOption[]>(() => buildFilterOptions(inventoryItems.map((item) => item.category)), [inventoryItems])
  const filteredItems = useMemo(() => {
    const needle = normalizeSearch(search)
    return inventoryItems.filter(
      (item) => (!categoryFilter || item.category === categoryFilter) && matchesSearch(needle, item.name, item.category, item.unit, item.stock, item.threshold),
    )
  }, [categoryFilter, inventoryItems, search])

  return (
    <ConfigurableAdminCardSection
      errorMessage={sectionError}
      title="Inventory Items"
      search={{ value: search, onChange: onSearchChange, placeholder: searchPlaceholder, disabled: searchDisabled }}
      toolbarAction={{ id: 'new-item-btn', label: '+ New Item', onClick: onAddItem }}
      filters={[
        ...(foodBankOptions ? [{ type: 'food-bank' as const, id: 'inventory-food-bank-filter', foodBankOptions, selectedFoodBankId, onFoodBankChange }] : []),
        { type: 'select' as const, id: 'inventory-category-filter', value: categoryFilter, options: categoryOptions, placeholder: 'All Categories', onChange: setCategoryFilter },
      ]}
      gridId="inventory-card-grid"
      items={filteredItems}
      hideEmptyState={!!foodBankOptions && selectedFoodBankId == null && searchDisabled}
      emptyStateTitle={isLoadingData ? 'Loading inventory...' : 'No inventory items found'}
      renderCard={(item) => renderItemCard(item, { onEditItem, onAdjustItem, onDeleteItem })}
    />
  )
}

export function AdminLotsSection({ inventoryItems, lotRows, isLoadingLots, lotError, onEditExpiry, onToggleStatus, onDeleteLot, onBatchWasteLots, onBatchDeleteLots, heading }: AdminLotsSectionProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedLotIds, setSelectedLotIds] = useState<number[]>([])
  const [batchAction, setBatchAction] = useState<'waste' | 'delete' | null>(null)

  useEffect(() => {
    const validIds = new Set(lotRows.map((lot) => lot.id))
    setSelectedLotIds((current) => current.filter((id) => validIds.has(id)))
  }, [lotRows])

  const categoryByItemId = useMemo(() => new Map(inventoryItems.map((item) => [item.id, item.category])), [inventoryItems])
  const lotTableRows = useMemo(() => lotRows.map((lot) => buildLotTableRow(lot, categoryByItemId.get(lot.inventory_item_id) ?? '')), [categoryByItemId, lotRows])
  const categoryOptions = useMemo<FilterOption[]>(() => buildFilterOptions(lotTableRows.map((lot) => lot.category)), [lotTableRows])
  const filteredLots = useMemo(() => {
    const needle = normalizeSearch(search)
    return lotTableRows.filter(
      (lot) =>
        (!categoryFilter || lot.category === categoryFilter) &&
        (!statusFilter || lot.statusLabel === statusFilter) &&
        matchesSearch(needle, lot.item_name, lot.reference, lot.receivedDateLabel, lot.expiryDateLabel, lot.statusLabel, lot.category, lot.quantity),
    )
  }, [categoryFilter, lotTableRows, search, statusFilter])

  const selectedLotIdSet = useMemo(() => new Set(selectedLotIds), [selectedLotIds])
  const selectedLots = useMemo(() => lotTableRows.filter((lot) => selectedLotIdSet.has(lot.id)), [lotTableRows, selectedLotIdSet])
  const activeSelectedCount = selectedLots.filter((lot) => lot.status === 'active').length
  const inactiveSelectedCount = selectedLots.filter((lot) => lot.status !== 'active').length

  const runBatchAction = async (action: 'waste' | 'delete', task: () => Promise<void>) => {
    setBatchAction(action)
    try {
      await task()
    } finally {
      setBatchAction(null)
    }
  }

  return (
    <ConfigurableSelectableTableSection
      title={heading ?? 'Lot Records'}
      errorMessage={lotError}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search lot records"
      filters={[
        { type: 'select', value: categoryFilter, options: categoryOptions, placeholder: 'All Categories', onChange: setCategoryFilter },
        { type: 'select', value: statusFilter, options: LOT_STATUS_OPTIONS, placeholder: 'All Status', onChange: setStatusFilter },
      ]}
      selectAllId="select-all-lots"
      countId="lot-selected-count"
      rows={filteredLots}
      selectedRowIds={selectedLotIdSet}
      getRowId={(lot) => lot.id}
      onToggleRow={(lotId) => setSelectedLotIds((current) => toggleSelectedId(current, lotId))}
      onToggleAll={(visibleLotIds) => setSelectedLotIds((current) => toggleSelectedGroup(current, visibleLotIds ?? []))}
      batchButtons={[
        { id: 'batch-waste-lots', label: 'Mark Selected as Wasted', busyLabel: 'Working...', tone: 'danger', disabled: activeSelectedCount === 0 || batchAction !== null, onClick: () => void runBatchAction('waste', () => onBatchWasteLots(selectedLotIds)) },
        { id: 'batch-delete-lots', label: 'Delete Selected', busyLabel: 'Working...', tone: 'secondary', disabled: inactiveSelectedCount === 0 || batchAction !== null, onClick: () => void runBatchAction('delete', () => onBatchDeleteLots(selectedLotIds)) },
      ]}
      isLoading={isLoadingLots}
      loadingMessage="Loading inventory lots..."
      emptyMessage="No lot records found."
      paginationId="lot-pagination"
      tableId="lot-table"
      bodyId="lot-table-body"
      paginationKey={`${search}|${categoryFilter}|${statusFilter}`}
      columns={createLotColumns({ onEditExpiry, onToggleStatus, onDeleteLot })}
      getRowMeta={(lot) => ({ dataAttributes: { 'data-id': lot.id } })}
    />
  )
}

