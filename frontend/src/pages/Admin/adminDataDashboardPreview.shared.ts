import dataDashboardReferenceHtml from 'virtual:data-dashboard-reference'
import type { DashboardAnalyticsResponse } from '@/shared/lib/api'

export type DashboardRange = 'month' | 'quarter' | 'year'

export type DashboardFrameWindow = Window &
  typeof globalThis & {
    Chart?: unknown
    dashboardDataService?: {
      getKpiData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['kpi']>
      getDonationData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['donation']>
      getInventoryData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['inventory']>
      getPackageData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['package']>
      getExpiryData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['expiry']>
      getRedemptionData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['redemption']>
    }
    dashboardPostRender?: (range?: DashboardRange) => Promise<void>
    initAllData?: () => Promise<void>
  }

export const dashboardToneColorMap: Record<string, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  muted: 'var(--color-text-medium)',
}

export const dashboardHeroButtonConfig = [
  { targetId: 'donation-analysis', label: 'Donation Analysis' },
  { targetId: 'inventory-health', label: 'Inventory Health' },
  { targetId: 'distribution-analysis', label: 'Package Management' },
  { targetId: 'waste-analysis', label: 'Expiry Tracking' },
  { targetId: 'code-verification', label: 'Code Verification' },
] as const

const remoteChartScriptTag = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js"></script>'
const localChartScriptTag = '<script src="/vendor/chart.umd.min.js"></script>'
const adminChartScriptTag = '<script>window.__skipDashboardAutoInit = true;</script>\n<script src="/vendor/chart.umd.min.js"></script>'

export const dataDashboardAdminHtml = dataDashboardReferenceHtml
  .replace(remoteChartScriptTag, adminChartScriptTag)
  .replace(localChartScriptTag, adminChartScriptTag)
