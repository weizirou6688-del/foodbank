import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'
import type {
  ApplicationStatus,
  DonationListRow,
  FoodBank,
  GoodsDonationResponse,
} from '@/shared/types/common'
import { useAuthStore } from '@/app/store/authStore'

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private buildHeaders(headers?: HeadersInit): Headers {
    return new Headers({
      'Content-Type': 'application/json',
      ...(headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers),
    })
  }

  private async performRequest(url: string, options: RequestInit, headers: Headers) {
    return fetch(url, {
      ...options,
      headers,
    })
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`
    const initialHeaders = this.buildHeaders(options.headers)
    let response = await this.performRequest(url, options, initialHeaders)

    if (response.status === 401 && initialHeaders.has('Authorization')) {
      const refreshed = await useAuthStore.getState().refreshAccessToken()
      if (refreshed) {
        const renewedToken = useAuthStore.getState().accessToken
        if (renewedToken) {
          const retryHeaders = this.buildHeaders(options.headers)
          retryHeaders.set('Authorization', `Bearer ${renewedToken}`)
          response = await this.performRequest(url, options, retryHeaders)
        }
      } else {
        useAuthStore.getState().logout()
      }
    }

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
    const currentToken = token ? (useAuthStore.getState().accessToken ?? token) : undefined
    return this.request(endpoint, {
      method: 'GET',
      headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {},
    })
  }

  async post(endpoint: string, data?: Record<string, any>, token?: string) {
    const currentToken = token ? (useAuthStore.getState().accessToken ?? token) : undefined
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data || {}),
      headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {},
    })
  }

  async patch(endpoint: string, data?: Record<string, any>, token?: string) {
    const currentToken = token ? (useAuthStore.getState().accessToken ?? token) : undefined
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
      headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {},
    })
  }

  async delete(endpoint: string, token?: string) {
    const currentToken = token ? (useAuthStore.getState().accessToken ?? token) : undefined
    const url = `${this.baseURL}${endpoint}`
    const initialHeaders = this.buildHeaders(
      currentToken ? { 'Authorization': `Bearer ${currentToken}` } : undefined,
    )
    let response = await this.performRequest(
      url,
      { method: 'DELETE' },
      initialHeaders,
    )

    if (response.status === 401 && initialHeaders.has('Authorization')) {
      const refreshed = await useAuthStore.getState().refreshAccessToken()
      if (refreshed) {
        const renewedToken = useAuthStore.getState().accessToken
        if (renewedToken) {
          const retryHeaders = this.buildHeaders({ 'Authorization': `Bearer ${renewedToken}` })
          response = await this.performRequest(url, { method: 'DELETE' }, retryHeaders)
        }
      } else {
        useAuthStore.getState().logout()
      }
    }

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
  donor_type?: 'supermarket' | 'individual' | 'organization' | null
  donor_email: string
  food_bank_id?: number | null
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

export interface AdminInventoryItemRecord {
  id: number
  name: string
  category: string
  stock: number
  total_stock: number
  unit: string
  threshold: number
  food_bank_id?: number | null
  updated_at: string
}

export interface InventoryItemMutationPayload {
  name: string
  category: string
  initial_stock?: number
  unit: string
  threshold: number
  food_bank_id?: number
}

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

export interface FoodPackageContentRecord {
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
  threshold?: number
  description?: string | null
  image_url?: string | null
  food_bank_id?: number
  contents?: Array<{
    item_id: number
    quantity: number
  }>
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

export interface GeocodeResponse {
  lat: number
  lng: number
  source: string
}

export interface AdminApplicationItem {
  id: number
  package_id?: number | null
  inventory_item_id?: number | null
  name: string
  quantity: number
}

export interface AdminApplicationRecord {
  id: string
  user_id: string
  food_bank_id: number
  redemption_code: string
  status: ApplicationStatus
  week_start: string
  total_quantity: number
  created_at: string
  updated_at: string
  redeemed_at?: string | null
  deleted_at?: string | null
  items: AdminApplicationItem[]
  package_name?: string | null
  is_voided: boolean
  voided_at?: string | null
}

export interface AdminApplicationListResponse {
  items: AdminApplicationRecord[]
  total: number
  page: number
  size: number
  pages: number
}

export interface DashboardChartData {
  labels: string[]
  data: number[]
}

export interface DashboardImpactMetric {
  key: string
  value: string
  label: string
}

export interface PublicImpactMetric {
  key: string
  change: string
  value: string
  label: string
  note: string
  positive?: boolean
}

export interface PublicImpactMetricsResponse {
  impactMetrics: PublicImpactMetric[]
}

export interface DashboardKpi {
  totalDonation: number
  totalSku: number
  totalPackageDistributed: number
  lowStockCount: number
  expiringLotCount: number
  redemptionRate: number
  trends: {
    donation: string
    package: string
    lowStock: string
    wastage: string
  }
}

export interface DashboardDisplayCard {
  title: string
  value: string
  subtitle: string
  trend?: string | null
}

export interface DashboardLowStockAlert {
  item_name: string
  category: string
  current_stock: number
  current_stock_label: string
  threshold: number
  threshold_label: string
  deficit: number
  status: string
  status_tone: 'success' | 'warning' | 'error' | 'muted' | string
}

export interface DashboardExpiringLot {
  item_name: string
  lot_number: string
  expiry_date: string
  remaining_stock: number
  remaining_stock_label: string
  days_until_expiry: number
  status_tone: 'success' | 'warning' | 'error' | 'muted' | string
}

export interface DashboardVerificationRecord {
  redemption_code: string
  package_type: string
  verified_at: string
  status: string
  status_tone: 'success' | 'warning' | 'error' | 'muted' | string
}

export interface DashboardAnalyticsResponse {
  impactMetrics: DashboardImpactMetric[]
  kpi: DashboardKpi
  donation: {
    source: DashboardChartData
    trend: DashboardChartData
    category: DashboardChartData
    donorType: DashboardChartData
    averageValue: DashboardDisplayCard
  }
  inventory: {
    health: DashboardChartData
    category: DashboardChartData
    lowStockAlerts: DashboardLowStockAlert[]
  }
  package: {
    trend: DashboardChartData
    redemption: DashboardChartData
    packageType: DashboardChartData
    averageSupportDuration: DashboardDisplayCard
    itemsPerPackage: DashboardDisplayCard
  }
  expiry: {
    distribution: DashboardChartData
    wastage: DashboardChartData & { label: string }
    expiringLots: DashboardExpiringLot[]
  }
  redemption: {
    rateTrend: DashboardChartData
    breakdown: DashboardChartData
    recentVerificationRecords: DashboardVerificationRecord[]
  }
}

export const donationsAPI = {
  donateCash: (data: {
    donor_name?: string
    donor_type?: 'supermarket' | 'individual' | 'organization'
    donor_email: string
    food_bank_id?: number
    amount_pence: number
    payment_reference?: string
  }) => apiClient.post('/api/v1/donations/cash', data) as Promise<CashDonationResponse>,

  donateGoods: (data: {
    donor_name: string
    donor_type?: 'supermarket' | 'individual' | 'organization'
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
    status?: 'pending' | 'received' | 'rejected'
    items: Array<{ item_name: string; quantity: number; expiry_date?: string }>
  }) => apiClient.post('/api/v1/donations/goods', data) as Promise<GoodsDonationResponse>,

  submitSupermarketDonation: (
    data: {
      donor_phone?: string
      pickup_date?: string
      notes?: string
      items: Array<{
        inventory_item_id?: number
        item_name?: string
        quantity: number
        expiry_date?: string
      }>
    },
    token: string
  ) => apiClient.post('/api/v1/donations/goods/supermarket', data, token) as Promise<GoodsDonationResponse>,
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
  getPublicImpact: (
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get(`/api/v1/stats/public-impact?range=${range}`) as Promise<PublicImpactMetricsResponse>,
  getPublicGoodsImpact: (
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get(`/api/v1/stats/public-goods-impact?range=${range}`) as Promise<PublicImpactMetricsResponse>,
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

  getDashboardAnalytics: (
    token: string,
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get(`/api/v1/stats/dashboard?range=${range}`, token) as Promise<DashboardAnalyticsResponse>,

  getStockGap: (token: string) =>
    apiClient.get('/api/v1/stats/stock-gap', token),

  getFoodPackages: (token: string) =>
    apiClient.get('/api/v1/stats/packages', token),

  listFoodBankPackages: (
    foodBankId: number | string,
    token: string
  ) => apiClient.get(`/api/v1/food-banks/${foodBankId}/packages`, token) as Promise<FoodPackageSummaryRecord[]>,

  getFoodPackageDetail: (
    id: number | string,
    token: string
  ) => apiClient.get(`/api/v1/packages/${id}`, token) as Promise<FoodPackageDetailRecord>,

  createFoodPackage: (
    data: FoodPackageMutationPayload,
    token: string
  ) => apiClient.post('/api/v1/packages', data, token) as Promise<FoodPackageDetailRecord>,

  updateFoodPackage: (
    id: number | string,
    data: FoodPackageMutationPayload,
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
  ) => apiClient.post(`/api/v1/packages/${id}/pack`, { quantity }, token) as Promise<PackPackageResponse>,

  getInventoryItems: (token: string) =>
    apiClient.get('/api/v1/inventory', token) as Promise<InventoryItemListResponse>,

  createInventoryItem: (
    data: InventoryItemMutationPayload,
    token: string
  ) => apiClient.post('/api/v1/inventory', data, token) as Promise<AdminInventoryItemRecord>,

  getInventoryLots: (token: string, includeInactive = true) =>
    apiClient.get(`/api/v1/inventory/lots?include_inactive=${includeInactive}`, token),

  adjustInventoryLot: (
    lotId: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/lots/${lotId}`, data, token),

  deleteInventoryLot: (
    lotId: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/lots/${lotId}`, token),

  updateInventoryItem: (
    id: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/${id}`, data, token),

  stockInInventoryItem: (
    id: number | string,
    data: { quantity: number; reason: string; expiry_date?: string },
    token: string
  ) => apiClient.post(`/api/v1/inventory/${id}/stock-in`, data, token) as Promise<AdminInventoryItemRecord>,

  stockOutInventoryItem: (
    id: number | string,
    data: { quantity: number; reason: string },
    token: string
  ) => apiClient.post(`/api/v1/inventory/${id}/stock-out`, data, token) as Promise<AdminInventoryItemRecord>,

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

  createGoodsDonation: (
    data: {
      donor_name: string
      donor_type?: 'supermarket' | 'individual' | 'organization'
      donor_email: string
      donor_phone: string
      pickup_date?: string
      items: Array<{ item_name: string; quantity: number; expiry_date?: string }>
      status?: 'pending' | 'received' | 'rejected'
    },
    token: string
  ) => apiClient.post('/api/v1/donations/goods', data, token) as Promise<GoodsDonationResponse>,

  updateGoodsDonation: (
    id: string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/donations/goods/${id}`, data, token) as Promise<GoodsDonationResponse>,

  deleteGoodsDonation: (
    id: string,
    token: string
  ) => apiClient.delete(`/api/v1/donations/goods/${id}`, token),

  updateCashDonation: (
    id: string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/donations/cash/${id}`, data, token) as Promise<CashDonationResponse>,

  deleteCashDonation: (
    id: string,
    token: string
  ) => apiClient.delete(`/api/v1/donations/cash/${id}`, token),
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

  getAdminApplications: (token: string) =>
    apiClient.get('/api/v1/applications/admin/records', token) as Promise<AdminApplicationListResponse>,

  getApplicationByCode: (code: string, token: string) =>
    apiClient.get(`/api/v1/applications/admin/by-code/${encodeURIComponent(code)}`, token) as Promise<AdminApplicationRecord>,

  redeemApplication: (id: string, token: string) =>
    apiClient.post(`/api/v1/applications/admin/${id}/redeem`, {}, token) as Promise<AdminApplicationRecord>,

  voidApplication: (id: string, token: string) =>
    apiClient.post(`/api/v1/applications/admin/${id}/void`, {}, token) as Promise<AdminApplicationRecord>,
}
