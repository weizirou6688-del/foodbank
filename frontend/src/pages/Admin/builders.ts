import type { Dispatch, SetStateAction } from 'react'
import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import type { FoodPackageDetailRecord } from '@/shared/lib/api/packages'
import type { AdminFoodBankScopeState } from '@/shared/lib/adminScope'
import type { DonationListRow } from '@/shared/types/donations'
import type { InventoryItem } from '@/shared/types/inventory'
import { inventoryCategoryOptions, packageCategoryOptions } from './adminFoodManagement.constants'
import { formatUkDate, formatUkDateInput } from './formatting'
import type {
  CodeVerifyResult,
  DonationEditorDraft,
  DonationEditorItemDraft,
  InventoryEditorDraft,
  InventoryStockInDraft,
  PackageEditorDraft,
  PackageEditorRowDraft,
  PackageRow,
} from './adminFoodManagement.types'
import { getApplicationPackageLabel, getApplicationStatusLabel, getDonationDonorType } from './rules'
import type { FoodBankOption } from './sectionBits'

let donationDraftRowCounter = 0
let packageDraftRowCounter = 0

interface ScopedSectionBindings {
  foodBankOptions?: FoodBankOption[]
  selectedFoodBankId?: number | null
  onFoodBankChange?: (foodBankId: number | null) => void
  searchDisabled: boolean
  searchPlaceholder: string
  searchScopeKey: string
  sectionError: string
  emptyStateMessage?: string | null
}

type ScopedFoodBankFilterProps = Pick<ScopedSectionBindings, 'foodBankOptions' | 'selectedFoodBankId' | 'onFoodBankChange'>

function nextDonationDraftRowKey() {
  donationDraftRowCounter += 1
  return `donation-row-${donationDraftRowCounter}`
}

function nextPackageDraftRowKey() {
  packageDraftRowCounter += 1
  return `package-row-${packageDraftRowCounter}`
}

function buildCodeVerifyMessage(record: AdminApplicationRecord) {
  return `Package: ${getApplicationPackageLabel(record)}\nGenerated At: ${formatUkDate(record.created_at)}\nStatus: ${getApplicationStatusLabel(record)}`
}

function buildScopedSectionBinding({
  scopeState,
  sharedFoodBankFilterProps,
  searchLabel,
  sectionError,
  emptyStateMessage = null,
}: {
  scopeState: AdminFoodBankScopeState
  sharedFoodBankFilterProps: ScopedFoodBankFilterProps | Record<string, never>
  searchLabel: string
  sectionError: string
  emptyStateMessage?: string | null
}): ScopedSectionBindings {
  const searchDisabled = scopeState.isFoodBankSelectionRequired
  return {
    ...sharedFoodBankFilterProps,
    searchDisabled,
    searchPlaceholder: searchDisabled ? `Choose a food bank to browse ${searchLabel}` : `Search ${searchLabel}`,
    searchScopeKey: scopeState.scopeKey,
    sectionError,
    emptyStateMessage: searchDisabled ? emptyStateMessage : null,
  }
}

export function createDonationDraftItem(): DonationEditorItemDraft {
  return { key: nextDonationDraftRowKey(), itemName: '', quantity: '1', expiryDate: '' }
}

export function createEmptyDonationDraft(): DonationEditorDraft {
  return { donorType: '', donorName: '', donorEmail: '', receivedDate: '', items: [createDonationDraftItem()] }
}

export function createPackageDraftRow(itemId = '', quantity = '1'): PackageEditorRowDraft {
  return { key: nextPackageDraftRowKey(), itemId, quantity }
}

export function createEmptyInventoryDraft(item?: InventoryItem | null): InventoryEditorDraft {
  return { name: item?.name ?? '', category: item?.category ?? inventoryCategoryOptions[0], unit: item?.unit ?? '', threshold: item ? String(item.threshold) : '0' }
}

export function createEmptyStockInDraft(): InventoryStockInDraft {
  return { quantity: '1', expiryDate: '' }
}

export function createEmptyPackageDraft(): PackageEditorDraft {
  return { name: '', category: packageCategoryOptions[0], threshold: '0', contents: [createPackageDraftRow()] }
}

export function buildPackageDraft(detail: FoodPackageDetailRecord): PackageEditorDraft {
  return {
    name: detail.name,
    category: detail.category || packageCategoryOptions[0],
    threshold: String(detail.threshold ?? 0),
    contents: detail.package_items.length > 0 ? detail.package_items.map((item) => createPackageDraftRow(String(item.inventory_item_id), String(item.quantity))) : [createPackageDraftRow()],
  }
}

export function buildLotReference(lot: { id: number; batch_reference?: string | null }) {
  return lot.batch_reference?.trim() || `LOT-${String(lot.id).padStart(4, '0')}`
}

export function buildScopedPackageRow(detail: FoodPackageDetailRecord): PackageRow {
  return {
    key: `detail-${detail.id}`,
    id: detail.id,
    name: detail.name,
    category: detail.category,
    threshold: detail.threshold,
    stock: detail.stock,
    contents: detail.package_items.map((item) => `${item.inventory_item_name} x${item.quantity}`),
  }
}

export function buildDonationDraft(donation: DonationListRow): DonationEditorDraft {
  return {
    donorType: getDonationDonorType(donation),
    donorName: donation.donor_name ?? '',
    donorEmail: donation.donor_email ?? '',
    receivedDate: formatUkDateInput(donation.pickup_date || donation.created_at),
    items: donation.items?.length ? donation.items.map((item) => ({ key: nextDonationDraftRowKey(), itemName: item.item_name, quantity: String(item.quantity), expiryDate: formatUkDateInput(item.expiry_date) })) : [createDonationDraftItem()],
  }
}

export function buildCodeVerifyResult(record: AdminApplicationRecord): CodeVerifyResult {
  const statusMeta = record.is_voided
    ? { tone: 'error' as const, title: 'Code Voided' }
    : record.status === 'collected'
      ? { tone: 'info' as const, title: 'Already Redeemed' }
      : record.status === 'expired'
        ? { tone: 'info' as const, title: 'Code Expired' }
        : { tone: 'success' as const, title: 'Code Valid' }
  return { ...statusMeta, message: buildCodeVerifyMessage(record), record }
}

export function resolveScopedFoodBankId(fixedFoodBankId: number | null, selectedFoodBankId: number | null) {
  return fixedFoodBankId ?? selectedFoodBankId ?? null
}

export function buildScopedInventoryItems(inventory: InventoryItem[], scopeState: AdminFoodBankScopeState) {
  return scopeState.effectiveFoodBankId == null ? (scopeState.canChooseFoodBank ? [] : inventory) : inventory.filter((item) => item.foodBankId === scopeState.effectiveFoodBankId)
}

export function buildScopedSectionBindings({
  scopeState,
  foodBankFilterOptions,
  selectedFoodBankId,
  setSelectedFoodBankId,
  availableFoodBanksError,
  scopedPackageError,
}: {
  scopeState: AdminFoodBankScopeState
  foodBankFilterOptions: FoodBankOption[]
  selectedFoodBankId: number | null
  setSelectedFoodBankId: Dispatch<SetStateAction<number | null>>
  availableFoodBanksError: string
  scopedPackageError: string
}) {
  const sharedFoodBankFilterProps: ScopedFoodBankFilterProps | Record<string, never> = scopeState.canChooseFoodBank
    ? { foodBankOptions: foodBankFilterOptions, selectedFoodBankId, onFoodBankChange: setSelectedFoodBankId }
    : {}

  return {
    inventory: buildScopedSectionBinding({ scopeState, sharedFoodBankFilterProps, searchLabel: 'inventory items', sectionError: availableFoodBanksError }),
    packages: buildScopedSectionBinding({
      scopeState,
      sharedFoodBankFilterProps,
      searchLabel: 'food packages',
      sectionError: availableFoodBanksError || scopedPackageError,
      emptyStateMessage: 'Choose a food bank to view food packages',
    }),
  }
}

export function toggleSelectedId<T extends string | number>(ids: T[], id: T) {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id]
}

export function toggleSelectedGroup<T extends string | number>(ids: T[], nextIds: T[], replaceAll = false) {
  const currentSet = new Set(ids)
  const allSelected = nextIds.length > 0 && nextIds.every((id) => currentSet.has(id))
  if (replaceAll) return allSelected ? [] : nextIds
  if (allSelected) return ids.filter((id) => !nextIds.includes(id))
  return Array.from(new Set([...ids, ...nextIds]))
}

export function assignField<T extends object, K extends keyof T>(value: T, field: K, nextValue: T[K]) {
  return { ...value, [field]: nextValue } as T
}

export function updateKeyedListField<T extends { key: string }, K extends keyof T>(rows: T[], key: string, field: K, value: T[K]) {
  return rows.map((row) => (row.key === key ? { ...row, [field]: value } : row))
}

export function appendListItem<T>(rows: T[], item: T) {
  return [...rows, item]
}

export function removeKeyedListItem<T extends { key: string }>(rows: T[], key: string) {
  return rows.length > 1 ? rows.filter((row) => row.key !== key) : rows
}
