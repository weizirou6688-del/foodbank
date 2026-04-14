import type { FoodBank } from '@/shared/types/foodBanks'
import { apiClient } from '../apiClient'

interface FoodBankListResponse {
  items: FoodBank[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ExternalFoodBankRecord {
  name: string
  address: string
  postcode: string
  lat?: number | null
  lng?: number | null
  latt_long?: string | null
  phone?: string
  email?: string
  url?: string
  needs?: string[]
}

interface GeocodeResponse {
  lat: number
  lng: number
  source: string
}

interface InventoryItemListResponse {
  items: Array<{
    id: number
    name: string
    category: string
    stock: number
    total_stock: number
    unit: string
    threshold: number
    food_bank_id?: number | null
    updated_at: string
  }>
  total: number
  page: number
  size: number
  pages: number
}

export const foodBanksAPI = {
  getFoodBanks: (postcode?: string) =>
    apiClient.get<FoodBankListResponse>(
      `/api/v1/food-banks${postcode ? `?postcode=${encodeURIComponent(postcode)}` : ''}`,
    ),
  geocodePostcode: (postcode: string) =>
    apiClient.get<GeocodeResponse>(`/api/v1/food-banks/geocode?postcode=${encodeURIComponent(postcode)}`),
  getExternalFeed: () => apiClient.get<ExternalFoodBankRecord[]>('/api/v1/food-banks/external-feed'),
  getInventoryItems: (foodBankId: number | string) =>
    apiClient.get<InventoryItemListResponse>(`/api/v1/food-banks/${foodBankId}/inventory-items`),
}
