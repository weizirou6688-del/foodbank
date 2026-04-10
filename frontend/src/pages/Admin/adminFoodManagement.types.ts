export type FoodManagementTab = 'packages' | 'items' | 'packaging' | 'lots' | 'low-stock'

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

export interface LowStockRow {
  id: number
  name: string
  category: string
  unit: string
  current_stock: number
  threshold: number
  stock_deficit: number
}

export interface RestockRequestRow {
  id: number
  inventory_item_id: number
  current_stock: number
  threshold: number
  urgency: 'high' | 'medium' | 'low'
  status: 'open' | 'fulfilled' | 'cancelled'
  created_at: string
}

export interface PackageRow {
  key: string
  id: number
  name: string
  category: string
  threshold: number
  stock: number
  contents: string[]
}

export interface InventoryCategoryItem {
  id: number
  name: string
  stock: number
  unit: string
  threshold: number
}

export interface InventoryCategoryRow {
  name: string
  items: InventoryCategoryItem[]
}

export interface NameThresholdTarget {
  id: number
  name: string
  threshold: number
}

export interface ItemAdjustTarget {
  id: number
  direction: 'in' | 'out'
}

export interface LotDamageTarget {
  id: number
  itemName: string
}

export interface LotExpiryTarget {
  id: number
  itemName: string
  expiryDate: string
}

export interface LotStatusTarget {
  id: number
  itemName: string
  currentStatus: InventoryLotRow['status']
}

export interface DeleteItemTarget {
  id: number
  itemName: string
  referencedByPackages: string[]
}

export type PendingAction =
  | 'lot-damage'
  | 'lot-expiry'
  | 'lot-status'
  | 'delete-item'
  | 'restock-fulfil'
  | 'restock-cancel'
  | null

export interface RestockConfirmTarget {
  id: number
  mode: 'fulfil' | 'cancel'
}

export interface PageFeedback {
  tone: 'success' | 'error' | 'info'
  message: string
}
