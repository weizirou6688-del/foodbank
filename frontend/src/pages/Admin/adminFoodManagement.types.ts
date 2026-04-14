import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import type { DonationListRow } from '@/shared/types/donations'
import type { InventoryCategoryOption, PackageCategoryOption } from './adminFoodManagement.constants'

export type InventoryCategoryName = InventoryCategoryOption | string
export type PackageCategoryName = PackageCategoryOption | string
export type DonationDonorType = NonNullable<DonationListRow['donor_type']>
export type DonationStatusFilter = 'all' | 'pending' | 'received' | 'rejected' | 'completed' | 'failed' | 'refunded'

export interface InventoryLotRow {
  id: number
  inventory_item_id: number
  item_name: string
  quantity: number
  expiry_date: string
  received_date: string
  batch_reference?: string | null
  status: 'active' | 'wasted' | 'expired'
}

export interface PackageRow {
  key: string
  id: number
  name: string
  category: PackageCategoryName
  threshold: number
  stock: number
  contents: string[]
}

export interface NameThresholdTarget {
  id: number
  name: string
  threshold: number
}

export interface InventoryEditorDraft {
  name: string
  category: InventoryCategoryName | ''
  unit: string
  threshold: string
}

export interface PackageEditorRowDraft {
  key: string
  itemId: string
  quantity: string
}

export interface PackageEditorDraft {
  name: string
  category: PackageCategoryName | ''
  threshold: string
  contents: PackageEditorRowDraft[]
}

export interface InventoryStockInDraft {
  quantity: string
  expiryDate: string
}

export interface PackingStockCheckRow {
  itemId: number
  name: string
  requiredQuantity: number
  availableQuantity: number
  unit: string
}

export interface DonationEditorItemDraft {
  key: string
  itemName: string
  quantity: string
  expiryDate: string
}

export interface DonationEditorDraft {
  donorType: DonationDonorType | ''
  donorName: string
  donorEmail: string
  receivedDate: string
  items: DonationEditorItemDraft[]
}

export interface DonationEditorTarget {
  mode: 'create' | 'edit'
  donation: DonationListRow | null
}

export interface DonationDeleteTarget {
  donation: DonationListRow
  displayId: string
}

export interface CodeVoidTarget {
  record: AdminApplicationRecord
}

export interface CodeVerifyResult {
  tone: 'success' | 'error' | 'info'
  title: string
  message: string
  record: AdminApplicationRecord | null
}

export interface LotExpiryTarget {
  id: number
  itemName: string
  lotNumber: string
  quantity: number
  expiryDate: string
}

export interface LotStatusTarget {
  id: number
  itemName: string
  lotNumber: string
  currentStatus: InventoryLotRow['status']
}

export interface LotDeleteTarget {
  id: number
  itemName: string
  lotNumber: string
}

export interface DeleteItemTarget {
  id: number
  itemName: string
  referencedByPackages: string[]
}

export type PendingAction =
  | 'lot-expiry'
  | 'lot-status'
  | 'delete-item'
  | 'donation-save'
  | 'donation-delete'
  | 'donation-receive'
  | 'donation-batch-receive'
  | 'donation-batch-delete'
  | 'code-check'
  | 'code-redeem'
  | 'code-void'
  | 'code-batch-void'
  | null

export interface PageFeedback {
  tone: 'success' | 'error' | 'info'
  message: string
}
