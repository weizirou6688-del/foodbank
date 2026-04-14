import type { DashboardAnalyticsResponse, DashboardChartData, DashboardDisplayCard } from '@/shared/lib/api/stats'
import { chartPalette as palette } from './statsConfig'
import {
  buildChart,
  makeBarChart,
  makeDoughnutChart,
  makeLineChart,
  makePieChart,
  pickChartData,
  type ChartConfig,
} from './chartHelpers'
import type { ChartLegendConfig, ChartLegendItem, ChartPanel } from './statsBits'

const DEFAULT_CARDS = {
  averageDonation: { title: 'Average Donation Value', value: '--', subtitle: 'Per completed cash donation', trend: 'Loading live trend...' },
  averageSupport: { title: 'Average Family Support Duration', value: '--', subtitle: 'Weeks' },
  itemsPerPackage: { title: 'Items Per Package', value: '--', subtitle: 'Loading live calculation...' },
} satisfies Record<string, DashboardDisplayCard>

type Analytics = DashboardAnalyticsResponse | null | undefined
type PanelSpec = { title: string; loadingId: string; canvasId: string; data: (analytics: Analytics) => DashboardChartData | null | undefined; build: (data: DashboardChartData) => ChartConfig; legend?: (analytics: Analytics, data: DashboardChartData) => ChartLegendConfig | undefined }

const panel = (title: string, loadingId: string, canvasId: string, data: PanelSpec['data'], build: PanelSpec['build'], legend?: PanelSpec['legend']): PanelSpec => ({ title, loadingId, canvasId, data, build, legend })
const pickCard = (card: DashboardDisplayCard | null | undefined, fallback: DashboardDisplayCard) => card ?? fallback
const buildPanels = (analytics: Analytics, specs: readonly PanelSpec[]) => specs.map((spec) => buildPanel(analytics, spec))
const wastageLabel = (data: DashboardChartData) => (data as DashboardChartData & { label?: string }).label || 'Wastage'

const formatCount = (value: number, unit: string) => {
  const amount = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${amount} ${unit}${Math.abs(value) === 1 ? '' : 's'}`
}

const getChartValue = (data: DashboardChartData | null | undefined, label: string) => {
  const index = data?.labels.indexOf(label) ?? -1
  return index >= 0 ? data?.data[index] ?? 0 : 0
}

function buildDonationLegend(source?: DashboardChartData | null, donorType?: DashboardChartData | null) {
  if (!source) {
    return undefined
  }

  const items = source.labels.map<ChartLegendItem>((label, index) => ({
    label,
    value: formatCount(source.data[index] ?? 0, 'donation'),
    color: palette.donationSource[index % palette.donationSource.length],
    ...(label === 'Individual' && donorType
      ? {
          description: 'Individual source totals are split by donor loyalty below.',
          details: [
            { label: 'Regular Donors', value: formatCount(getChartValue(donorType, 'Regular Donors'), 'donor') },
            { label: 'One-Time Donors', value: formatCount(getChartValue(donorType, 'One-Time Donors'), 'donor') },
          ],
        }
      : {}),
  }))

  if (donorType) {
    items.push({
      label: 'Corporate Partners',
      value: formatCount(getChartValue(donorType, 'Corporate Partners'), 'partner'),
      description: 'Unique partner donors across Supermarket and Organization sources.',
    })
  }

  return items.length ? ({ items } satisfies ChartLegendConfig) : undefined
}

const buildPanel = (analytics: Analytics, spec: PanelSpec): ChartPanel => {
  const data = pickChartData(spec.data(analytics))
  return { title: spec.title, loadingId: spec.loadingId, canvasId: spec.canvasId, chartConfig: buildChart(data, spec.build), legend: data ? spec.legend?.(analytics, data) : undefined }
}

const PANELS = {
  donation: {
    primary: [
      panel('Donation Source Distribution', 'donation-source-loading', 'donation-source-chart', (analytics) => analytics?.donation.source, (data) => makeDoughnutChart(data, [...palette.donationSource], false), (analytics, data) => buildDonationLegend(data, pickChartData(analytics?.donation.donorType))),
      panel('Goods Donation Trend', 'donation-trend-loading', 'donation-trend-chart', (analytics) => analytics?.donation.trend, (data) => makeLineChart(data, 'Donations', palette.donationTrend.line, palette.donationTrend.fill)),
    ],
    secondary: [panel('Donation Category Distribution', 'donation-category-loading', 'donation-category-chart', (analytics) => analytics?.donation.category, (data) => makeBarChart(data, 'Items', [...palette.donationCategory]))],
  },
  inventory: [
    panel('Inventory Health Status', 'inventory-health-loading', 'inventory-health-chart', (analytics) => analytics?.inventory.health, (data) => makeDoughnutChart(data, [...palette.inventoryHealth])),
    panel('Stock by Category', 'inventory-category-loading', 'inventory-category-chart', (analytics) => analytics?.inventory.category, (data) => makeBarChart(data, 'Stock', palette.inventoryCategory)),
  ],
  package: {
    primary: [
      panel('Aid Package Distribution Trend', 'package-trend-loading', 'package-trend-chart', (analytics) => analytics?.package.trend, (data) => makeLineChart(data, 'Packages', palette.packageTrend.line, palette.packageTrend.fill)),
      panel('Redemption Code Status', 'redemption-status-loading', 'redemption-status-chart', (analytics) => analytics?.package.redemption, (data) => makeDoughnutChart(data, [...palette.status])),
    ],
    packageType: panel('Package Type Distribution', 'package-type-loading', 'package-type-chart', (analytics) => analytics?.package.packageType, (data) => makePieChart(data, [...palette.packageType])),
  },
  expiry: [
    panel('Lot Expiry Distribution', 'expiry-distribution-loading', 'expiry-distribution-chart', (analytics) => analytics?.expiry.distribution, (data) => makeDoughnutChart(data, [...palette.expiryDistribution])),
    panel('Food Wastage Trend', 'wastage-trend-loading', 'wastage-trend-chart', (analytics) => analytics?.expiry.wastage, (data) => makeBarChart(data, wastageLabel(data), palette.wastage)),
  ],
  redemption: [panel('Redemption Rate Trend', 'redemption-rate-loading', 'redemption-rate-chart', (analytics) => analytics?.redemption.rateTrend, (data) => makeLineChart(data, 'Redemption Rate (%)', palette.redemptionRate.line, palette.redemptionRate.fill, { min: 85, max: 100 }))],
}

export const makeDonationView = (analytics?: DashboardAnalyticsResponse | null) => ({
  primaryPanels: buildPanels(analytics, PANELS.donation.primary),
  secondaryPanels: buildPanels(analytics, PANELS.donation.secondary),
  averageDonationCard: pickCard(analytics?.donation.averageValue, DEFAULT_CARDS.averageDonation),
})

export const makeInventoryView = (analytics?: DashboardAnalyticsResponse | null) => ({ panels: buildPanels(analytics, PANELS.inventory) })
export const makePackageView = (analytics?: DashboardAnalyticsResponse | null) => ({
  primaryPanels: buildPanels(analytics, PANELS.package.primary),
  packageTypePanel: buildPanel(analytics, PANELS.package.packageType),
  averageSupportCard: pickCard(analytics?.package.averageSupportDuration, DEFAULT_CARDS.averageSupport),
  itemsPerPackageCard: pickCard(analytics?.package.itemsPerPackage, DEFAULT_CARDS.itemsPerPackage),
})
export const makeExpiryView = (analytics?: DashboardAnalyticsResponse | null) => ({ panels: buildPanels(analytics, PANELS.expiry), expiringLots: analytics?.expiry.expiringLots ?? [] })
export const makeRedemptionView = (analytics?: DashboardAnalyticsResponse | null) => ({ panels: buildPanels(analytics, PANELS.redemption), recentVerificationRecords: analytics?.redemption.recentVerificationRecords ?? [] })
