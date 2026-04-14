import type { ReactNode } from 'react'
import type {
  DashboardAnalyticsResponse,
  DashboardDisplayCard,
  DashboardExpiringLot,
  DashboardVerificationRecord,
} from '@/shared/lib/api/stats'
import { rangeOptions } from './statsConfig'
import {
  ExpiryTable,
  KpiCards,
  MetricCard,
  StatsBlock,
  StatsChart,
  type ChartPanel,
  type MetricCardPanel,
  VerificationTable,
} from './statsBits'
import type { DashboardRange } from './useAdminDashboardData'

const SECTION_META = {
  kpi: { title: 'Core Operational KPIs', subtitle: "At-a-glance view of your food bank's key performance metrics." },
  donation: { id: 'donation-analysis', title: 'Donation Analysis', subtitle: 'Track donation sources, trends, and category distribution to optimize your fundraising efforts.' },
  inventory: { id: 'inventory-health', title: 'Inventory Health Analysis', subtitle: 'Monitor stock levels, low stock risks, and category distribution to avoid supply shortages.' },
  distribution: { id: 'distribution-analysis', title: 'Aid Package & Distribution Analysis', subtitle: 'Track aid package distribution, redemption rates, and community support scale.' },
  waste: { id: 'waste-analysis', title: 'Expiry & Food Waste Reduction Analysis', subtitle: 'Monitor expiry dates, track food waste, and optimize stock rotation to reduce waste.', tableTitle: 'Expiring Soon (Within 30 Days)' },
  verification: { id: 'code-verification', title: 'Code Verification Analytics', subtitle: 'Track redemption code performance, success rates, and verification trends.', tableTitle: 'Recent Verification Records' },
} as const

const METRIC_CARD_IDS = {
  averageDonation: { cardId: 'average-donation-card', valueId: 'average-donation-value', subtitleId: 'average-donation-subtitle', trendId: 'average-donation-trend' },
  averageSupport: { cardId: 'average-support-card', titleId: 'average-support-title', valueId: 'average-support-value', subtitleId: 'average-support-unit' },
  itemsPerPackage: { cardId: 'items-per-package-card', titleId: 'items-per-package-title', valueId: 'items-per-package-value', subtitleId: 'items-per-package-unit' },
} satisfies Record<string, Partial<MetricCardPanel>>

type Row = { className: string; items: ReactNode[] }
type SectionLayout = { id?: string; title: string; subtitle: string; rows: Row[]; table?: { title: string; node: ReactNode } }

const chartItems = (panels: ChartPanel[], isLoading: boolean) => panels.map((panel) => <StatsChart key={panel.canvasId} {...panel} isLoading={isLoading} />)
const metricItem = (card: MetricCardPanel) => <MetricCard key={card.cardId ?? card.title} {...card} />

function renderSection({ id, title, subtitle, rows, table }: SectionLayout) {
  return (
    <StatsBlock id={id} title={title} subtitle={subtitle}>
      {rows.map((row, index) => (
        <div key={`${id ?? title}-${index}`} className={row.className}>
          {row.items}
        </div>
      ))}
      {table ? (
        <>
          <h3 className="chart-title" style={{ marginTop: 'var(--spacing-lg)' }}>
            {table.title}
          </h3>
          {table.node}
        </>
      ) : null}
    </StatsBlock>
  )
}

const SECTION_LAYOUTS = {
  donation: ({ primaryPanels, secondaryPanels, averageDonationCard, isLoading }: { primaryPanels: ChartPanel[]; secondaryPanels: ChartPanel[]; averageDonationCard: DashboardDisplayCard; isLoading: boolean }): SectionLayout => ({
    ...SECTION_META.donation,
    rows: [
      { className: 'chart-grid-2', items: chartItems(primaryPanels, isLoading) },
      { className: 'chart-grid-3', items: [...chartItems(secondaryPanels, isLoading), metricItem({ ...averageDonationCard, ...METRIC_CARD_IDS.averageDonation })] },
    ],
  }),
  inventory: ({ panels, isLoading }: { panels: ChartPanel[]; isLoading: boolean }): SectionLayout => ({
    ...SECTION_META.inventory,
    rows: [{ className: 'chart-grid-2', items: chartItems(panels, isLoading) }],
  }),
  distribution: ({ primaryPanels, packageTypePanel, averageSupportCard, itemsPerPackageCard, isLoading }: { primaryPanels: ChartPanel[]; packageTypePanel: ChartPanel; averageSupportCard: DashboardDisplayCard; itemsPerPackageCard: DashboardDisplayCard; isLoading: boolean }): SectionLayout => ({
    ...SECTION_META.distribution,
    rows: [
      { className: 'chart-grid-2', items: chartItems(primaryPanels, isLoading) },
      {
        className: 'chart-grid-3',
        items: [
          ...chartItems([packageTypePanel], isLoading),
          metricItem({ ...averageSupportCard, ...METRIC_CARD_IDS.averageSupport }),
          metricItem({ ...itemsPerPackageCard, ...METRIC_CARD_IDS.itemsPerPackage }),
        ],
      },
    ],
  }),
  waste: ({ panels, expiringLots, isLoading }: { panels: ChartPanel[]; expiringLots: DashboardExpiringLot[]; isLoading: boolean }): SectionLayout => ({
    ...SECTION_META.waste,
    rows: [{ className: 'chart-grid-2', items: chartItems(panels, isLoading) }],
    table: { title: SECTION_META.waste.tableTitle, node: <ExpiryTable isLoading={isLoading} rows={expiringLots} /> },
  }),
  verification: ({ panels, verificationRows, isLoading }: { panels: ChartPanel[]; verificationRows: DashboardVerificationRecord[]; isLoading: boolean }): SectionLayout => ({
    ...SECTION_META.verification,
    rows: [{ className: 'chart-grid-2', items: chartItems(panels, isLoading) }],
    table: { title: SECTION_META.verification.tableTitle, node: <VerificationTable isLoading={isLoading} rows={verificationRows} /> },
  }),
}

export function StatsKpiSection({
  range,
  setRange,
  refreshDashboard,
  rangeSummary,
  analytics,
}: {
  range: DashboardRange
  setRange: (range: DashboardRange) => void
  refreshDashboard: (nextRange?: DashboardRange) => Promise<void>
  rangeSummary: string
  analytics?: DashboardAnalyticsResponse | null
}) {
  return (
    <StatsBlock title={SECTION_META.kpi.title} subtitle={SECTION_META.kpi.subtitle}>
      <div className="filter-bar">
        <div className="filter-group">
          <label style={{ fontSize: 14, fontWeight: 500 }} htmlFor="time-range-select">
            Time Range:
          </label>
          <select id="time-range-select" className="filter-select" value={range} onChange={(event) => setRange(event.target.value as DashboardRange)}>
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" id="refresh-data-btn" onClick={() => void refreshDashboard(range)}>
          Refresh Data
        </button>
      </div>
      <p id="time-range-summary" style={{ marginTop: 12, fontSize: 14, color: 'var(--color-text-light)' }}>
        {rangeSummary}
      </p>
      <KpiCards range={range} analytics={analytics} />
    </StatsBlock>
  )
}

export const DonationSection = (props: { primaryPanels: ChartPanel[]; secondaryPanels: ChartPanel[]; averageDonationCard: DashboardDisplayCard; isLoading: boolean }) => renderSection(SECTION_LAYOUTS.donation(props))
export const InventorySection = (props: { panels: ChartPanel[]; isLoading: boolean }) => renderSection(SECTION_LAYOUTS.inventory(props))
export const DistributionSection = (props: { primaryPanels: ChartPanel[]; packageTypePanel: ChartPanel; averageSupportCard: DashboardDisplayCard; itemsPerPackageCard: DashboardDisplayCard; isLoading: boolean }) => renderSection(SECTION_LAYOUTS.distribution(props))
export const WasteSection = (props: { panels: ChartPanel[]; expiringLots: DashboardExpiringLot[]; isLoading: boolean }) => renderSection(SECTION_LAYOUTS.waste(props))
export const VerificationSection = (props: { panels: ChartPanel[]; verificationRows: DashboardVerificationRecord[]; isLoading: boolean }) => renderSection(SECTION_LAYOUTS.verification(props))
