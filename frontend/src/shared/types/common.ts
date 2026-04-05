// User and authentication
export type UserRole = 'public' | 'supermarket' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  food_bank_id?: number | null
  food_bank_name?: string | null
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

export interface GoodsDonationApiItem {
  id: number
  donation_id: string
  item_name: string
  quantity: number
  expiry_date?: string | null
}

export interface GoodsDonationResponse {
  id: string
  donor_user_id?: string | null
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  donor_name: string
  donor_type?: 'supermarket' | 'individual' | 'organization' | null
  donor_email: string
  donor_phone: string
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  notes?: string | null
  status: 'pending' | 'received' | 'rejected'
  created_at: string
  items: GoodsDonationApiItem[]
}

export interface DonationListRow {
  id: string
  donation_type: 'cash' | 'goods'
  donor_email?: string
  donor_name?: string
  donor_type?: 'supermarket' | 'individual' | 'organization' | null
  donor_phone?: string
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  amount_pence?: number
  payment_reference?: string | null
  status?: string
  notes?: string | null
  created_at?: string
  items?: GoodsDonationApiItem[]
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
