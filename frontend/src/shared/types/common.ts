// User and authentication
export type UserRole = 'public' | 'supermarket' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

// Food bank discovery and selection
export interface FoodBank {
  id: number
  name: string
  address: string
  distance?: number // km
  hours?: string[]
  lat: number
  lng: number
  phone?: string
  email?: string
  url?: string
  systemMatched?: boolean
}

export type ApplicationStatus = 'pending' | 'collected' | 'expired'

// Food packages
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

// Selected package state
export interface SelectedPackage extends FoodPackage {
  selectedQty: number
}

// Donation forms
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

// Restock requests used by mock/demo helpers
export interface RestockRequest {
  id: number
  foodName: string
  currentStock: number
  threshold: number
  urgency: 'high' | 'medium' | 'low'
}

// Inventory items
export interface InventoryItem {
  id: number
  name: string
  category: string
  stock: number
  unit: string
  threshold: number
  foodBankId?: number
}

// Generic form validation helpers
export type FormErrors<T> = Partial<Record<keyof T, string>>
