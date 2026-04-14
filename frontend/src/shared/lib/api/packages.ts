import { apiClient } from '../apiClient'

export interface FoodPackageSummaryRecord {
  id: number
  name: string
  category: string
  description?: string | null
  stock: number
  threshold: number
  applied_count: number
  image_url?: string | null
  food_bank_id?: number | null
  is_active: boolean
  created_at: string
}

interface FoodPackageContentRecord {
  id: number
  inventory_item_id: number
  quantity: number
  inventory_item_name: string
  inventory_item_unit: string
}

export interface FoodPackageDetailRecord extends FoodPackageSummaryRecord {
  package_items: FoodPackageContentRecord[]
}

export interface FoodPackageMutationPayload {
  name?: string
  category?: string
  stock?: number
  threshold?: number
  applied_count?: number
  description?: string | null
  image_url?: string | null
  food_bank_id?: number
  is_active?: boolean
  contents?: Array<{ item_id: number; quantity: number }>
}

export interface PackPackageResponse {
  package_id: number
  package_name: string
  quantity: number
  new_stock: number
  consumed_lots: Array<{
    item_id: number
    lot_id: number
    quantity_used: number
    remaining_in_lot: number
    expiry_date: string
    batch_reference?: string | null
  }>
  timestamp: string
}

export const packagesAPI = {
  listFoodBankPackages: (foodBankId: number | string) =>
    apiClient.get<FoodPackageSummaryRecord[]>(`/api/v1/food-banks/${foodBankId}/packages`),
  getFoodPackageDetail: (id: number | string) => apiClient.get<FoodPackageDetailRecord>(`/api/v1/packages/${id}`),
}
