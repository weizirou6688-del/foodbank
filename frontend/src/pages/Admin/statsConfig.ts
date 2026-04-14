import type { DashboardRange } from './useAdminDashboardData'

export const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
]

export const rangeLabels: Record<DashboardRange, string> = { month: 'This Month', quarter: 'This Quarter', year: 'This Year' }
export const trendGroupingCopy: Record<DashboardRange, string> = {
  month: 'Trend charts are grouped by day within the current month.',
  quarter: 'Trend charts are grouped by month within the selected range.',
  year: 'Trend charts are grouped by month within the selected range.',
}

export const loadingKpiCount = 6
export const chartPalette = {
  donationSource: ['#FFB703', '#FB8500', '#1976D2', '#7B1FA2'],
  donationTrend: { line: '#FFB703', fill: 'rgba(255, 183, 3, 0.1)' },
  donationCategory: ['#FFB703', '#FB8500', '#1976D2', '#7B1FA2', '#2E7D32'],
  inventoryHealth: ['#2E7D32', '#F57C00', '#D32F2F'],
  inventoryCategory: '#1976D2',
  packageTrend: { line: '#1976D2', fill: 'rgba(25, 118, 210, 0.1)' },
  status: ['#2E7D32', '#F57C00', '#D32F2F'],
  packageType: ['#FFB703', '#FB8500', '#1976D2'],
  expiryDistribution: ['#D32F2F', '#F57C00', '#2E7D32'],
  wastage: '#D32F2F',
  redemptionRate: { line: '#2E7D32', fill: 'rgba(46, 125, 50, 0.1)' },
} as const
