// Compatibility stub: re-export from new location (shared/types/common)
export * from '@/shared/types/common'

// ── Food Bank ─────────────────────────────────────────────────
export interface FoodBank {
  id: number
  name: string
  address: string
  distance?: number  // km
  hours?: string[]
  lat: number
  lng: number
}

// ── Food Package ──────────────────────────────────────────────
export interface PackageItem {
  name: string
  qty: number
}

export interface FoodPackage {
  id: number
  name: string
  category: string
  description: string
  items: PackageItem[]
  stock: number
  threshold: number
  appliedCount: number
  image: string
}

// ── Cart / Selection ──────────────────────────────────────────
export interface SelectedPackage extends FoodPackage {
  selectedQty: number
}

// ── Donation ──────────────────────────────────────────────────
export interface CashDonationForm {
  email: string
  amount: number | ''
  cardholderName: string
  cardNumber: string
  expiryDate: string
  cvv: string
}

export interface GoodsDonationItem {
  id: string
  name: string
  quantity: number
}

export interface GoodsDonationForm {
  donorName: string
  email: string
  phone: string
  items: GoodsDonationItem[]
  notes: string
}

// ── Restock Request ───────────────────────────────────────────
export interface RestockRequest {
  id: number
  foodName: string
  currentStock: number
  threshold: number
  urgency: 'Critical' | 'Urgent' | 'Low'
}

// ── Single Inventory Item ─────────────────────────────────────
export interface InventoryItem {
  id: number
  name: string
  category: string
  stock: number
  unit: string
  threshold: number
}

// ── Form validation ───────────────────────────────────────────
export type FormErrors<T> = Partial<Record<keyof T, string>>
