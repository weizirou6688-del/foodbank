import type { ChangeEvent, ReactNode } from 'react'

import AdminActionButtons from '@/features/admin/components/AdminActionButtons'
import {
  AdminInlineActionButton,
  AdminInlineActions,
} from '@/features/admin/components/AdminActionPrimitives'
import {
  AdminDataTableHeaderCell,
  AdminInfoBox,
  AdminLabeledField,
  AdminMutedText,
  AdminPanel,
  AdminPanelActionButton,
  AdminPrimaryActionButton,
  AdminRoundedInput,
  AdminRoundedSelect,
  AdminSearchField,
  AdminSectionHeading,
  AdminTableMessageRow,
  AdminTablePanel,
  AdminTabPillButton,
} from '@/features/admin/components/AdminDisplayPrimitives'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import AdminPackageActionButtons from '@/features/admin/components/AdminPackageActionButtons'
import type {
  FoodManagementTab,
  InventoryCategoryRow,
  InventoryLotRow,
  LowStockRow,
  NameThresholdTarget,
  PackageRow,
  RestockRequestRow,
} from './adminFoodManagement.types'

const packageTableHeaders = [
  'Package name',
  'Category',
  'Safety threshold',
  'Current stock',
  'Contents',
  'Actions',
]

const lotTableHeaders = [
  'Lot ID',
  'Item',
  'Quantity',
  'Expiry',
  'Received',
  'Status',
  'Actions',
]

const lowStockTableHeaders = [
  'Item',
  'Category',
  'Current',
  'Threshold',
  'Deficit',
  'Unit',
  'Restock',
]

const restockRequestTableHeaders = [
  'Request ID',
  'Item ID',
  'Current',
  'Threshold',
  'Urgency',
  'Created',
  'Actions',
]

const tabOptions: Array<{
  id: FoodManagementTab
  label: string
  icon?: ReactNode
}> = [
  {
    id: 'packages',
    label: 'Food Packages',
    icon: <PackageIcon />,
  },
  {
    id: 'items',
    label: 'Single Items',
    icon: <InventoryIcon />,
  },
  {
    id: 'packaging',
    label: 'Package Packing',
  },
  {
    id: 'lots',
    label: 'Lot Management',
  },
  {
    id: 'low-stock',
    label: 'Low Stock',
  },
]

interface AdminFoodManagementTabsProps {
  activeTab: FoodManagementTab
  onChange: (tab: FoodManagementTab) => void
}

export function AdminFoodManagementTabs({
  activeTab,
  onChange,
}: AdminFoodManagementTabsProps) {
  return (
    <div className="flex gap-4 mb-8 border-b-[1.5px] border-[#E8E8E8] pb-2 overflow-x-auto">
      {tabOptions.map((option) => (
        <AdminTabPillButton
          key={option.id}
          onClick={() => onChange(option.id)}
          active={activeTab === option.id}
        >
          {option.icon}
          {option.label}
        </AdminTabPillButton>
      ))}
    </div>
  )
}

interface AdminPackagesSectionProps {
  packageRows: PackageRow[]
  isLoadingData: boolean
  onAddPackage: () => void
  onEditPackage: (target: NameThresholdTarget) => void
  onOpenPackTab: (packageId: number) => void
}

export function AdminPackagesSection({
  packageRows,
  isLoadingData,
  onAddPackage,
  onEditPackage,
  onOpenPackTab,
}: AdminPackagesSectionProps) {
  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <AdminSectionHeading>Food Package List</AdminSectionHeading>
        <AdminPrimaryActionButton
          onClick={onAddPackage}
          className="px-5 py-2.5 text-sm font-medium"
        >
          <PlusIcon />
          New Package
        </AdminPrimaryActionButton>
      </div>

      <AdminTablePanel>
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#F5F5F5]">
              {packageTableHeaders.map((header) => (
                <AdminDataTableHeaderCell key={header}>
                  {header}
                </AdminDataTableHeaderCell>
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
                    {pkg.contents.map((content) => (
                      <span
                        key={content}
                        className="bg-[#F5F5F5] border border-[#E8E8E8] rounded-full px-3 py-1 text-xs text-[#1A1A1A] whitespace-nowrap"
                      >
                        {content}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <AdminPackageActionButtons
                    onEdit={() => onEditPackage({
                      id: pkg.id,
                      name: pkg.name,
                      threshold: pkg.threshold,
                    })}
                    onOpenPackTab={() => onOpenPackTab(pkg.id)}
                  />
                </td>
              </tr>
            ))}
            {isLoadingData && packageRows.length === 0 && (
              <AdminTableMessageRow colSpan={6} className="p-8 text-center">
                Loading packages...
              </AdminTableMessageRow>
            )}
            {!isLoadingData && packageRows.length === 0 && (
              <AdminTableMessageRow colSpan={6} className="p-8 text-center">
                No packages available yet.
              </AdminTableMessageRow>
            )}
          </tbody>
        </table>
      </AdminTablePanel>
    </div>
  )
}

interface AdminItemsSectionProps {
  search: string
  filteredCategories: InventoryCategoryRow[]
  inventoryIdSet: Set<number>
  isLoadingData: boolean
  onSearchChange: (value: string) => void
  onAddItem: () => void
  onEditItem: (target: NameThresholdTarget) => void
  onAdjustItem: (itemId: number, direction: 'in' | 'out') => void
  onDeleteItem: (itemId: number, itemName: string) => void
}

export function AdminItemsSection({
  search,
  filteredCategories,
  inventoryIdSet,
  isLoadingData,
  onSearchChange,
  onAddItem,
  onEditItem,
  onAdjustItem,
  onDeleteItem,
}: AdminItemsSectionProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value)
  }

  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
        <AdminPrimaryActionButton
          onClick={onAddItem}
          className="px-5 py-2.5 text-sm font-medium w-full sm:w-auto"
        >
          <PlusIcon />
          New Item
        </AdminPrimaryActionButton>
        <AdminSearchField
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={handleSearchChange}
          className="w-full sm:w-[300px]"
        />
      </div>

      {filteredCategories.map((category) => (
        <div key={category.name} className="mb-8">
          <div className="flex items-center gap-2 text-xl font-bold text-[#1A1A1A] py-3 border-b-2 border-[#F7DC6F] mb-4">
            <ChevronDownIcon />
            {category.name}
          </div>
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b-2 border-[#E8E8E8] font-semibold text-gray-600 text-sm">
            <span>Name</span>
            <span>Stock</span>
            <span>Unit</span>
            <span>Threshold</span>
            <span>Actions</span>
          </div>
          {category.items.map((item) => {
            const isItemEditable = inventoryIdSet.has(item.id)
            const isBelowThreshold = item.stock < item.threshold

            return (
              <div
                key={item.id}
                className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center py-3 border-b border-[#E8E8E8] gap-4 md:gap-0 ${isBelowThreshold ? 'bg-[#E63946]/[0.08] -mx-4 px-4 md:mx-0 md:px-0' : ''}`}
              >
                <span className="font-medium text-[#1A1A1A]">{item.name}</span>
                <div className="flex justify-between md:block text-[#1A1A1A]">
                  <span className="md:hidden text-gray-500 text-sm">Stock:</span>
                  <span className={isBelowThreshold ? 'text-[#E63946] font-semibold' : ''}>
                    {item.stock}
                  </span>
                </div>
                <div className="flex justify-between md:block text-[#1A1A1A]">
                  <span className="md:hidden text-gray-500 text-sm">Unit:</span>
                  {item.unit}
                </div>
                <div className="flex justify-between md:block text-[#1A1A1A]">
                  <span className="md:hidden text-gray-500 text-sm">Threshold:</span>
                  {item.threshold}
                </div>
                <div className="mt-2 md:mt-0">
                  <AdminActionButtons
                    onEdit={isItemEditable ? () => onEditItem({
                      id: item.id,
                      name: item.name,
                      threshold: item.threshold,
                    }) : undefined}
                    onIn={isItemEditable ? () => onAdjustItem(item.id, 'in') : undefined}
                    onOut={isItemEditable ? () => onAdjustItem(item.id, 'out') : undefined}
                    onDelete={isItemEditable ? () => onDeleteItem(item.id, item.name) : undefined}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {isLoadingData && filteredCategories.length === 0 && (
        <AdminMutedText as="div" className="py-12 text-center">
          Loading inventory...
        </AdminMutedText>
      )}
      {!isLoadingData && filteredCategories.length === 0 && (
        <AdminMutedText as="div" className="py-12 text-center">
          No inventory items found.
        </AdminMutedText>
      )}
    </div>
  )
}

interface AdminPackingSectionProps {
  packages: Array<{ id: string | number; name: string }>
  packPackageId: number | ''
  packQuantity: string
  isPacking: boolean
  packFeedback: string
  onSelectPackage: (packageId: number | '') => void
  onQuantityChange: (value: string) => void
  onPack: () => void
}

export function AdminPackingSection({
  packages,
  packPackageId,
  packQuantity,
  isPacking,
  packFeedback,
  onSelectPackage,
  onQuantityChange,
  onPack,
}: AdminPackingSectionProps) {
  const handlePackageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value)
    onSelectPackage(Number.isNaN(value) ? '' : value)
  }

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQuantityChange(event.target.value)
  }

  return (
    <div className="fade-in">
      <AdminPanel>
        <AdminSectionHeading className="mb-6">Pack Food Package</AdminSectionHeading>

        <div className="grid md:grid-cols-[1fr_180px_160px] gap-4 items-end">
          <AdminLabeledField label="Package">
            <AdminRoundedSelect
              value={packPackageId}
              onChange={handlePackageChange}
            >
              <option value="">Select package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name}
                </option>
              ))}
            </AdminRoundedSelect>
          </AdminLabeledField>

          <AdminLabeledField label="Quantity">
            <AdminRoundedInput
              type="number"
              min={1}
              step={1}
              value={packQuantity}
              onChange={handleQuantityChange}
            />
          </AdminLabeledField>

          <AdminPrimaryActionButton
            onClick={onPack}
            disabled={isPacking}
            className="h-11 px-5 font-semibold"
          >
            {isPacking ? 'Packing...' : 'Pack'}
          </AdminPrimaryActionButton>
        </div>

        {packFeedback && (
          <AdminInfoBox className="mt-4">
            {packFeedback}
          </AdminInfoBox>
        )}
      </AdminPanel>
    </div>
  )
}

interface AdminLotsSectionProps {
  lotRows: InventoryLotRow[]
  isLoadingLots: boolean
  lotError: string
  onReportDamage: (lotId: number) => void
  onEditExpiry: (lotId: number, expiryDate: string) => void
  onToggleStatus: (lotId: number, status: InventoryLotRow['status']) => void
}

export function AdminLotsSection({
  lotRows,
  isLoadingLots,
  lotError,
  onReportDamage,
  onEditExpiry,
  onToggleStatus,
}: AdminLotsSectionProps) {
  return (
    <div className="fade-in">
      {lotError && (
        <AdminFeedbackBanner tone="error" message={lotError} />
      )}

      <AdminTablePanel>
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#F5F5F5]">
              {lotTableHeaders.map((header) => (
                <AdminDataTableHeaderCell key={header}>
                  {header}
                </AdminDataTableHeaderCell>
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
                  <AdminInlineActions className="flex-wrap">
                    <AdminInlineActionButton
                      onClick={() => onReportDamage(lot.id)}
                      tone="danger"
                    >
                      Report Loss
                    </AdminInlineActionButton>
                    <AdminInlineActionButton
                      onClick={() => onEditExpiry(lot.id, lot.expiry_date)}
                    >
                      Edit Expiry
                    </AdminInlineActionButton>
                    <AdminInlineActionButton
                      onClick={() => onToggleStatus(lot.id, lot.status)}
                    >
                      {lot.status === 'active' ? 'Mark Wasted' : 'Mark Active'}
                    </AdminInlineActionButton>
                  </AdminInlineActions>
                </td>
              </tr>
            ))}
            {isLoadingLots && lotRows.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                Loading inventory lots...
              </AdminTableMessageRow>
            )}
            {!isLoadingLots && lotRows.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                No inventory lots available.
              </AdminTableMessageRow>
            )}
          </tbody>
        </table>
      </AdminTablePanel>
    </div>
  )
}

interface AdminLowStockSectionProps {
  lowStockThreshold: string
  lowStockRows: LowStockRow[]
  openRestockItemIds: Set<number>
  openRestockRequests: RestockRequestRow[]
  restockActionId: number | null
  isLoadingLowStock: boolean
  isLoadingRestockRequests: boolean
  lowStockError: string
  restockError: string
  onThresholdChange: (value: string) => void
  onRefreshLowStock: () => void
  onCreateRestockRequest: (item: LowStockRow) => void
  onRefreshRestockRequests: () => void
  onFulfilRestockRequest: (requestId: number) => void
  onCancelRestockRequest: (requestId: number) => void
}

export function AdminLowStockSection({
  lowStockThreshold,
  lowStockRows,
  openRestockItemIds,
  openRestockRequests,
  restockActionId,
  isLoadingLowStock,
  isLoadingRestockRequests,
  lowStockError,
  restockError,
  onThresholdChange,
  onRefreshLowStock,
  onCreateRestockRequest,
  onRefreshRestockRequests,
  onFulfilRestockRequest,
  onCancelRestockRequest,
}: AdminLowStockSectionProps) {
  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    onThresholdChange(event.target.value)
  }

  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <AdminRoundedInput
          type="number"
          min={0}
          placeholder="Optional threshold"
          value={lowStockThreshold}
          onChange={handleThresholdChange}
          className="sm:w-[220px]"
        />
        <AdminPrimaryActionButton
          onClick={onRefreshLowStock}
          disabled={isLoadingLowStock}
          className="h-11 px-5 font-semibold"
        >
          {isLoadingLowStock ? 'Loading...' : 'Refresh'}
        </AdminPrimaryActionButton>
      </div>

      {lowStockError && (
        <AdminFeedbackBanner tone="error" message={lowStockError} />
      )}

      {restockError && (
        <AdminFeedbackBanner tone="error" message={restockError} />
      )}

      <AdminTablePanel>
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#F5F5F5]">
              {lowStockTableHeaders.map((header) => (
                <AdminDataTableHeaderCell key={header}>
                  {header}
                </AdminDataTableHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {lowStockRows.map((item) => {
              const isRequested = openRestockItemIds.has(item.id)
              const isWorking = restockActionId === item.id

              return (
                <tr key={item.id} className="border-b border-[#E8E8E8] bg-[#E63946]/[0.08]">
                  <td className="p-4">{item.name}</td>
                  <td className="p-4">{item.category}</td>
                  <td className="p-4">{item.current_stock}</td>
                  <td className="p-4">{item.threshold}</td>
                  <td className="p-4 text-[#E63946] font-semibold">{item.stock_deficit}</td>
                  <td className="p-4">{item.unit}</td>
                  <td className="p-4">
                    <AdminInlineActionButton
                      onClick={() => onCreateRestockRequest(item)}
                      disabled={isRequested || isWorking}
                    >
                      {isRequested ? 'Requested' : isWorking ? 'Working...' : 'Create Request'}
                    </AdminInlineActionButton>
                  </td>
                </tr>
              )
            })}
            {isLoadingLowStock && lowStockRows.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                Loading low stock items...
              </AdminTableMessageRow>
            )}
            {!isLoadingLowStock && lowStockRows.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                No low stock items found.
              </AdminTableMessageRow>
            )}
          </tbody>
        </table>
      </AdminTablePanel>

      <AdminTablePanel className="mt-8">
        <div className="px-6 py-4 border-b-[1.5px] border-[#E8E8E8] flex items-center justify-between">
          <AdminSectionHeading className="text-lg">Open Restock Requests</AdminSectionHeading>
          <AdminPanelActionButton
            onClick={onRefreshRestockRequests}
            disabled={isLoadingRestockRequests}
          >
            {isLoadingRestockRequests ? 'Loading...' : 'Refresh'}
          </AdminPanelActionButton>
        </div>

        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#F5F5F5]">
              {restockRequestTableHeaders.map((header) => (
                <AdminDataTableHeaderCell key={header}>
                  {header}
                </AdminDataTableHeaderCell>
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
                  <AdminInlineActions>
                    <AdminInlineActionButton
                      onClick={() => onFulfilRestockRequest(request.id)}
                      disabled={restockActionId === request.id}
                    >
                      Fulfil
                    </AdminInlineActionButton>
                    <AdminInlineActionButton
                      onClick={() => onCancelRestockRequest(request.id)}
                      disabled={restockActionId === request.id}
                      tone="danger"
                    >
                      Cancel
                    </AdminInlineActionButton>
                  </AdminInlineActions>
                </td>
              </tr>
            ))}
            {isLoadingRestockRequests && openRestockRequests.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                Loading restock requests...
              </AdminTableMessageRow>
            )}
            {!isLoadingRestockRequests && openRestockRequests.length === 0 && (
              <AdminTableMessageRow colSpan={7} className="p-8 text-center">
                No open restock requests.
              </AdminTableMessageRow>
            )}
          </tbody>
        </table>
      </AdminTablePanel>
    </div>
  )
}

function PackageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
