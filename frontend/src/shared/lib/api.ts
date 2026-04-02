import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'
import type {
  ApplicationStatus,
  DonationListRow,
  FoodBank,
  GoodsDonationResponse,
} from '@/shared/types/common'

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Request failed' })) as {
        detail?: string
        message?: string
        errors?: Array<{ field?: string; message?: string }>
      }

      const validationMessage = Array.isArray(error.errors)
        ? error.errors
            .map((entry) => entry.message || entry.field)
            .filter(Boolean)
            .join(' ')
        : ''

      throw new Error(error.detail || validationMessage || error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async get(endpoint: string, token?: string) {
    return this.request(endpoint, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async post(endpoint: string, data?: Record<string, any>, token?: string) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data || {}),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async patch(endpoint: string, data?: Record<string, any>, token?: string) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async delete(endpoint: string, token?: string) {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return null
  }
}

const apiClient = new APIClient(API_BASE_URL)

export interface CashDonationResponse {
  id: string
  donor_name?: string | null
  donor_email: string
  amount_pence: number
  payment_reference?: string | null
  status: 'completed' | 'failed' | 'refunded'
  created_at: string
}

export interface FoodBankListResponse {
  items: FoodBank[]
  total: number
  page: number
  size: number
  pages: number
}

export interface InventoryItemListResponse {
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

export interface GeocodeResponse {
  lat: number
  lng: number
  source: string
}

export const donationsAPI = {
  donateCash: (data: {
    donor_name?: string
    donor_email: string
    amount_pence: number
    payment_reference?: string
  }) => apiClient.post('/api/v1/donations/cash', data) as Promise<CashDonationResponse>,

  donateGoods: (data: {
    donor_name: string
    donor_email: string
    donor_phone: string
    food_bank_id?: number
    food_bank_name?: string
    food_bank_address?: string
    postcode?: string
    pickup_date?: string
    item_condition?: string
    estimated_quantity?: string
    notes?: string
    items: Array<{ item_name: string; quantity: number }>
  }) => apiClient.post('/api/v1/donations/goods', data) as Promise<GoodsDonationResponse>,
}

export const foodBanksAPI = {
  getFoodBanks: (postcode?: string) =>
    apiClient.get(
      `/api/v1/food-banks${postcode ? `?postcode=${encodeURIComponent(postcode)}` : ''}`,
    ) as Promise<FoodBankListResponse>,

  geocodePostcode: (postcode: string) =>
    apiClient.get(
      `/api/v1/food-banks/geocode?postcode=${encodeURIComponent(postcode)}`,
    ) as Promise<GeocodeResponse>,

  getInventoryItems: (foodBankId: number | string) =>
    apiClient.get(
      `/api/v1/food-banks/${foodBankId}/inventory-items`,
    ) as Promise<InventoryItemListResponse>,
}

export const statsAPI = {
  getOverview: () => apiClient.get('/api/v1/stats/donations'),
}

export const restockAPI = {
  getRequests: (token: string) =>
    apiClient.get('/api/v1/restock-requests', token),

  submitRequest: (
    data: {
      inventory_item_id: number
      current_stock: number
      threshold: number
      urgency: 'high' | 'medium' | 'low'
    },
    token: string
  ) => apiClient.post('/api/v1/restock-requests', data, token),

  fulfilRequest: (
    requestId: number | string,
    token: string,
    notes?: string
  ) => apiClient.post(`/api/v1/restock-requests/${requestId}/fulfil`, { notes }, token),

  cancelRequest: (
    requestId: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/restock-requests/${requestId}`, token),
}

export const adminAPI = {
  getStats: (token: string, _period: 'daily' | 'weekly' | 'monthly' = 'daily') =>
    apiClient.get('/api/v1/stats/donations', token),

  getPackageStats: (token: string) =>
    apiClient.get('/api/v1/stats/packages', token),

  getStockGap: (token: string) =>
    apiClient.get('/api/v1/stats/stock-gap', token),

  getFoodPackages: (token: string) =>
    apiClient.get('/api/v1/stats/packages', token),

  updateFoodPackage: (
    id: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/packages/${id}`, data, token),

  deleteFoodPackage: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/packages/${id}`, token),

  packPackage: (
    id: number | string,
    quantity: number,
    token: string
  ) => apiClient.post(`/api/v1/packages/${id}/pack`, { quantity }, token),

  getInventoryItems: (token: string) =>
    apiClient.get('/api/v1/inventory', token),

  getInventoryLots: (token: string, includeInactive = true) =>
    apiClient.get(`/api/v1/inventory/lots?include_inactive=${includeInactive}`, token),

  adjustInventoryLot: (
    lotId: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/lots/${lotId}`, data, token),

  updateInventoryItem: (
    id: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/${id}`, data, token),

  deleteInventoryItem: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/${id}`, token),

  getLowStockItems: (token: string, threshold?: number) => {
    const url = threshold !== undefined 
      ? `/api/v1/inventory/low-stock?threshold=${threshold}`
      : '/api/v1/inventory/low-stock'
    return apiClient.get(url, token)
  },

  getDonations: (token: string, type?: 'cash' | 'goods') => {
    const query = type ? `?type=${type}` : ''
    return apiClient.get(`/api/v1/donations${query}`, token) as Promise<DonationListRow[]>
  },
}

export const applicationsAPI = {
  submitApplication: (
    data: {
      food_bank_id: number
      week_start?: string // ISO 8601 date string (YYYY-MM-DD)
      items: Array<{ package_id: number; quantity: number }>
    },
    token: string
  ) => apiClient.post('/api/v1/applications', data, token),

  getMyApplications: (token: string) =>
    apiClient.get('/api/v1/applications/my', token),

  updateApplicationStatus: (
    id: number | string,
    data: { status: ApplicationStatus },
    token: string
  ) => apiClient.patch(`/api/v1/applications/${id}`, data, token),
}
