import type {
  ApplicationStatus,
  DonationListRow,
  FoodBank,
  GoodsDonationResponse,
} from '@/shared/types/common'
import { apiClient } from './apiClient'

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
  }) => apiClient.post<CashDonationResponse>('/api/v1/donations/cash', data),

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
  }) => apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods', data),

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
  ) => apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods/supermarket', data, token),
}

export const foodBanksAPI = {
  getFoodBanks: (postcode?: string) =>
    apiClient.get<FoodBankListResponse>(
      `/api/v1/food-banks${postcode ? `?postcode=${encodeURIComponent(postcode)}` : ''}`,
    ),

  geocodePostcode: (postcode: string) =>
    apiClient.get<GeocodeResponse>(
      `/api/v1/food-banks/geocode?postcode=${encodeURIComponent(postcode)}`,
    ),

  getInventoryItems: (foodBankId: number | string) =>
    apiClient.get<InventoryItemListResponse>(
      `/api/v1/food-banks/${foodBankId}/inventory-items`,
    ),
}

export const statsAPI = {
  getOverview: () => apiClient.get('/api/v1/stats/donations'),
  getPublicImpact: (
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get<PublicImpactMetricsResponse>(`/api/v1/stats/public-impact?range=${range}`),
  getPublicGoodsImpact: (
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get<PublicImpactMetricsResponse>(`/api/v1/stats/public-goods-impact?range=${range}`),
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
  ) => apiClient.get<DashboardAnalyticsResponse>(`/api/v1/stats/dashboard?range=${range}`, token),

  getStockGap: (token: string) =>
    apiClient.get('/api/v1/stats/stock-gap', token),

  getFoodPackages: (token: string) =>
    apiClient.get('/api/v1/stats/packages', token),

  listFoodBankPackages: (
    foodBankId: number | string,
    token: string
  ) => apiClient.get<FoodPackageSummaryRecord[]>(`/api/v1/food-banks/${foodBankId}/packages`, token),

  getFoodPackageDetail: (
    id: number | string,
    token: string
  ) => apiClient.get<FoodPackageDetailRecord>(`/api/v1/packages/${id}`, token),

  createFoodPackage: (
    data: FoodPackageMutationPayload,
    token: string
  ) => apiClient.post<FoodPackageDetailRecord>('/api/v1/packages', data, token),

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
  ) => apiClient.post<PackPackageResponse>(`/api/v1/packages/${id}/pack`, { quantity }, token),

  getInventoryItems: (token: string) =>
    apiClient.get<InventoryItemListResponse>('/api/v1/inventory', token),

  createInventoryItem: (
    data: InventoryItemMutationPayload,
    token: string
  ) => apiClient.post<AdminInventoryItemRecord>('/api/v1/inventory', data, token),

  getInventoryLots: (token: string, includeInactive = true) =>
    apiClient.get(`/api/v1/inventory/lots?include_inactive=${includeInactive}`, token),

  adjustInventoryLot: (
    lotId: number | string,
    data: Record<string, unknown>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/lots/${lotId}`, data, token),

  deleteInventoryLot: (
    lotId: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/lots/${lotId}`, token),

  updateInventoryItem: (
    id: number | string,
    data: Record<string, unknown>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/${id}`, data, token),

  stockInInventoryItem: (
    id: number | string,
    data: { quantity: number; reason: string; expiry_date?: string },
    token: string
  ) => apiClient.post<AdminInventoryItemRecord>(`/api/v1/inventory/${id}/stock-in`, data, token),

  stockOutInventoryItem: (
    id: number | string,
    data: { quantity: number; reason: string },
    token: string
  ) => apiClient.post<AdminInventoryItemRecord>(`/api/v1/inventory/${id}/stock-out`, data, token),

  deleteInventoryItem: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/${id}`, token),

  getLowStockItems: (token: string, threshold?: number) => {
    const url = threshold === undefined
      ? '/api/v1/inventory/low-stock'
      : `/api/v1/inventory/low-stock?threshold=${threshold}`
    return apiClient.get(url, token)
  },

  getDonations: (token: string, type?: 'cash' | 'goods') => {
    const query = type ? `?type=${type}` : ''
    return apiClient.get<DonationListRow[]>(`/api/v1/donations${query}`, token)
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
  ) => apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods', data, token),

  updateGoodsDonation: (
    id: string,
    data: Record<string, unknown>,
    token: string
  ) => apiClient.patch<GoodsDonationResponse>(`/api/v1/donations/goods/${id}`, data, token),

  deleteGoodsDonation: (
    id: string,
    token: string
  ) => apiClient.delete(`/api/v1/donations/goods/${id}`, token),

  updateCashDonation: (
    id: string,
    data: Record<string, unknown>,
    token: string
  ) => apiClient.patch<CashDonationResponse>(`/api/v1/donations/cash/${id}`, data, token),

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
    apiClient.get<AdminApplicationListResponse>('/api/v1/applications/admin/records', token),

  getApplicationByCode: (code: string, token: string) =>
    apiClient.get<AdminApplicationRecord>(`/api/v1/applications/admin/by-code/${encodeURIComponent(code)}`, token),

  redeemApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(`/api/v1/applications/admin/${id}/redeem`, {}, token),

  voidApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(`/api/v1/applications/admin/${id}/void`, {}, token),
}
