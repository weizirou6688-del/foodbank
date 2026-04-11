import type {
  ApplicationStatus,
  DonationListRow,
  FoodBank,
  GoodsDonationResponse,
  User,
} from '@/shared/types/common'
import { apiClient } from './apiClient'

const buildQueryString = (params: Record<string, string | number | boolean | null | undefined>) => {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export interface CashDonationResponse {
  id: string
  donor_name?: string | null
  donor_type?: DonationDonorType | null
  donor_email: string
  food_bank_id?: number | null
  amount_pence: number
  payment_reference?: string | null
  status: CashDonationStatus
  created_at: string
}

export interface AuthTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface AuthRefreshResponse {
  access_token: string
  token_type: string
}

export interface MessageResponse {
  message?: string
}

export interface FoodBankListResponse {
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

export interface GeocodeResponse {
  lat: number
  lng: number
  source: string
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

export type DonationDonorType = 'supermarket' | 'individual' | 'organization'
export type GoodsDonationStatus = 'pending' | 'received' | 'rejected'
export type CashDonationStatus = 'completed' | 'failed' | 'refunded'

export interface InventoryItemCreatePayload {
  name: string
  category: string
  initial_stock: number
  unit?: string
  threshold?: number
  food_bank_id?: number | null
}

export interface InventoryItemUpdatePayload {
  name?: string
  category?: string
  unit?: string
  threshold?: number
}

export interface InventoryLotAdjustPayload {
  quantity?: number
  damage_quantity?: number
  expiry_date?: string
  status?: 'active' | 'wasted'
  batch_reference?: string | null
}

export interface GoodsDonationItemPayload {
  item_name: string
  quantity: number
  expiry_date?: string
}

export interface GoodsDonationCreatePayload {
  donor_name: string
  donor_type?: DonationDonorType
  donor_email: string
  donor_phone: string
  food_bank_id?: number | null
  food_bank_name?: string
  food_bank_address?: string
  food_bank_email?: string
  postcode?: string
  pickup_date?: string
  item_condition?: string
  estimated_quantity?: string
  notes?: string
  items: GoodsDonationItemPayload[]
  status?: GoodsDonationStatus
}

export interface GoodsDonationUpdatePayload {
  donor_name?: string
  donor_type?: DonationDonorType
  donor_email?: string
  donor_phone?: string
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  notes?: string | null
  status?: GoodsDonationStatus
  items?: GoodsDonationItemPayload[]
}

export interface CashDonationUpdatePayload {
  donor_name?: string | null
  donor_type?: DonationDonorType
  food_bank_id?: number | null
  donor_email?: string
  amount_pence?: number
  payment_reference?: string | null
  status?: CashDonationStatus
}

export type ApplicationRequestItemPayload =
  | {
      package_id: number
      quantity: number
      inventory_item_id?: never
    }
  | {
      inventory_item_id: number
      quantity: number
      package_id?: never
    }

export interface ApplicationCreatePayload {
  food_bank_id: number
  week_start?: string
  items: ApplicationRequestItemPayload[]
}

export interface ApplicationUpdatePayload {
  status?: ApplicationStatus
  redemption_code?: string
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
  stock?: number
  threshold?: number
  applied_count?: number
  description?: string | null
  image_url?: string | null
  food_bank_id?: number
  is_active?: boolean
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

export interface UserApplicationRecord {
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
}

export interface UserApplicationListResponse {
  items: UserApplicationRecord[]
  total: number
  page: number
  size: number
  pages: number
}

export interface DonationStatsSummaryResponse {
  total_cash_donations: number
  total_goods_donations: number
  average_cash_per_donation: number
  donations_by_week?: Array<{
    week: string
    cash: number
    goods_count: number
  }>
}

export interface PackageStatsRecord {
  package_id: number
  package_name: string
  request_count: number
  total_requested_items: number
}

export interface StockGapRecord {
  package_id: number
  package_name: string
  stock: number
  threshold: number
  gap: number
}

export interface InventoryLotRecord {
  id: number
  inventory_item_id: number
  item_name: string
  quantity: number
  received_date: string
  expiry_date: string
  batch_reference?: string | null
  status: 'active' | 'wasted' | 'expired'
  deleted_at?: string | null
}

export interface LowStockRecord {
  id: number
  name: string
  category: string
  unit: string
  current_stock: number
  threshold: number
  stock_deficit: number
}

export interface RestockRequestRecord {
  id: number
  inventory_item_id: number
  current_stock: number
  threshold: number
  urgency: 'high' | 'medium' | 'low'
  status: 'open' | 'fulfilled' | 'cancelled'
  assigned_to_user_id?: string | null
  created_at: string
  updated_at: string
}

export interface RestockRequestListResponse {
  items: RestockRequestRecord[]
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

export const authAPI = {
  register: (data: {
    name: string
    email: string
    password: string
  }) => apiClient.post<User>('/api/v1/auth/register', data),

  login: (data: {
    email: string
    password: string
  }) => apiClient.post<AuthTokenResponse>('/api/v1/auth/login', data),

  refreshAccessToken: (refreshToken: string) =>
    apiClient.post<AuthRefreshResponse>(
      `/api/v1/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`,
    ),

  forgotPassword: (data: { email: string }) =>
    apiClient.post<MessageResponse>('/api/v1/auth/forgot-password', data),

  resetPassword: (data: {
    email: string
    verification_code: string
    new_password: string
  }) => apiClient.post<MessageResponse>('/api/v1/auth/reset-password', data),
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

  getExternalFeed: () =>
    apiClient.get<ExternalFoodBankRecord[]>('/api/v1/food-banks/external-feed'),

  getInventoryItems: (foodBankId: number | string) =>
    apiClient.get<InventoryItemListResponse>(
      `/api/v1/food-banks/${foodBankId}/inventory-items`,
    ),
}

export const packagesAPI = {
  listFoodBankPackages: (foodBankId: number | string) =>
    apiClient.get<FoodPackageSummaryRecord[]>(`/api/v1/food-banks/${foodBankId}/packages`),

  getFoodPackageDetail: (id: number | string) =>
    apiClient.get<FoodPackageDetailRecord>(`/api/v1/packages/${id}`),
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
    apiClient.get<RestockRequestListResponse>('/api/v1/restock-requests', token),

  submitRequest: (
    data: {
      inventory_item_id: number
      current_stock: number
      threshold: number
      urgency: 'high' | 'medium' | 'low'
    },
    token: string
  ) => apiClient.post<RestockRequestRecord>('/api/v1/restock-requests', data, token),

  fulfilRequest: (
    requestId: number | string,
    token: string,
    notes?: string
  ) => apiClient.post<RestockRequestRecord>(`/api/v1/restock-requests/${requestId}/fulfil`, { notes }, token),

  cancelRequest: (
    requestId: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/restock-requests/${requestId}`, token),
}

export const adminAPI = {
  getStats: (token: string, _period: 'daily' | 'weekly' | 'monthly' = 'daily') =>
    apiClient.get<DonationStatsSummaryResponse>('/api/v1/stats/donations', token),

  getPackageStats: (token: string) =>
    apiClient.get<PackageStatsRecord[]>('/api/v1/stats/packages', token),

  getDashboardAnalytics: (
    token: string,
    range: 'month' | 'quarter' | 'year' = 'month'
  ) => apiClient.get<DashboardAnalyticsResponse>(`/api/v1/stats/dashboard?range=${range}`, token),

  getStockGap: (token: string) =>
    apiClient.get<StockGapRecord[]>('/api/v1/stats/stock-gap', token),

  listFoodPackages: (
    token: string,
    filters?: {
      foodBankId?: number | string
      category?: string
      search?: string
      includeInactive?: boolean
    }
  ) => apiClient.get<FoodPackageDetailRecord[]>(
    `/api/v1/packages${buildQueryString({
      food_bank_id: filters?.foodBankId,
      category: filters?.category,
      search: filters?.search,
      include_inactive: filters?.includeInactive,
    })}`,
    token,
  ),

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
  ) => apiClient.patch<FoodPackageSummaryRecord>(`/api/v1/packages/${id}`, data, token),

  deleteFoodPackage: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/packages/${id}`, token),

  packPackage: (
    id: number | string,
    quantity: number,
    token: string
  ) => apiClient.post<PackPackageResponse>(`/api/v1/packages/${id}/pack`, { quantity }, token),

  getInventoryItems: (
    token: string,
    filters?: {
      foodBankId?: number | string
      category?: string
      search?: string
    }
  ) => apiClient.get<InventoryItemListResponse>(
    `/api/v1/inventory${buildQueryString({
      food_bank_id: filters?.foodBankId,
      category: filters?.category,
      search: filters?.search,
    })}`,
    token,
  ),

  createInventoryItem: (
    data: InventoryItemCreatePayload,
    token: string
  ) => apiClient.post<AdminInventoryItemRecord>('/api/v1/inventory', data, token),

  getInventoryLots: (token: string, includeInactive = true) =>
    apiClient.get<InventoryLotRecord[]>(`/api/v1/inventory/lots?include_inactive=${includeInactive}`, token),

  adjustInventoryLot: (
    lotId: number | string,
    data: InventoryLotAdjustPayload,
    token: string
  ) => apiClient.patch<InventoryLotRecord>(`/api/v1/inventory/lots/${lotId}`, data, token),

  deleteInventoryLot: (
    lotId: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/lots/${lotId}`, token),

  updateInventoryItem: (
    id: number | string,
    data: InventoryItemUpdatePayload,
    token: string
  ) => apiClient.patch<AdminInventoryItemRecord>(`/api/v1/inventory/${id}`, data, token),

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
    return apiClient.get<LowStockRecord[]>(url, token)
  },

  getDonations: (token: string, type?: 'cash' | 'goods') => {
    const query = type ? `?type=${type}` : ''
    return apiClient.get<DonationListRow[]>(`/api/v1/donations${query}`, token)
  },

  createGoodsDonation: (
    data: GoodsDonationCreatePayload,
    token: string
  ) => apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods', data, token),

  updateGoodsDonation: (
    id: string,
    data: GoodsDonationUpdatePayload,
    token: string
  ) => apiClient.patch<GoodsDonationResponse>(`/api/v1/donations/goods/${id}`, data, token),

  deleteGoodsDonation: (
    id: string,
    token: string
  ) => apiClient.delete(`/api/v1/donations/goods/${id}`, token),

  updateCashDonation: (
    id: string,
    data: CashDonationUpdatePayload,
    token: string
  ) => apiClient.patch<CashDonationResponse>(`/api/v1/donations/cash/${id}`, data, token),

  deleteCashDonation: (
    id: string,
    token: string
  ) => apiClient.delete(`/api/v1/donations/cash/${id}`, token),
}

export const applicationsAPI = {
  submitApplication: (
    data: ApplicationCreatePayload,
    token: string
  ) => apiClient.post<UserApplicationRecord>('/api/v1/applications', data, token),

  getMyApplications: (token: string) =>
    apiClient.get<UserApplicationListResponse>('/api/v1/applications/my', token),

  updateApplicationStatus: (
    id: number | string,
    data: ApplicationUpdatePayload,
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
