import { apiClient } from '../apiClient'

export interface DashboardChartData {
  labels: string[]
  data: number[]
}

export interface PublicImpactMetric {
  key: string
  change: string
  value: string
  label: string
  note: string
  positive?: boolean
}

interface PublicImpactMetricsResponse {
  impactMetrics: PublicImpactMetric[]
}

interface DashboardKpi {
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

export const getPublicImpact = (range: 'month' | 'quarter' | 'year' = 'month') =>
  apiClient.get<PublicImpactMetricsResponse>(`/api/v1/stats/public-impact?range=${range}`)

export const statsAPI = {
  getPublicImpact,
}
