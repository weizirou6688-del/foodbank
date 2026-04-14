import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type {
  DashboardAnalyticsResponse,
  DashboardDisplayCard,
  DashboardExpiringLot,
  DashboardVerificationRecord,
} from '@/shared/lib/api/stats'
import { loadingKpiCount, rangeLabels } from './statsConfig'
import type { ChartConfig } from './chartHelpers'
import { loadChartJs, type ChartJsInstance } from './chartJs'
import type { DashboardRange } from './useAdminDashboardData'

export { SectionBlock as StatsBlock } from './SectionBlock'

const STYLES = {
  metricBody: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 48, fontWeight: 700, color: 'var(--color-primary)' },
  metricSubtitle: { fontSize: 16, color: 'var(--color-text-light)' },
  metricTrend: { marginTop: 'var(--spacing-sm)', fontSize: 14, textAlign: 'center' },
  tableMessage: { textAlign: 'center', color: 'var(--color-text-light)' },
} satisfies Record<string, CSSProperties>

const DEFAULT_SHELL = { loadingMessage: 'Loading chart...', emptyMessage: 'No chart data available.' }
const toneStyle = (tone?: string) =>
  tone === 'success'
    ? { color: 'var(--color-success)', fontWeight: 600 as const }
    : tone === 'warning'
      ? { color: 'var(--color-warning)', fontWeight: 600 as const }
      : tone === 'error'
        ? { color: 'var(--color-error)', fontWeight: 600 as const }
        : { color: 'var(--color-text-medium)', fontWeight: 600 as const }

export type ChartLegendItem = { label: string; value: string; color?: string; description?: string; details?: Array<{ label: string; value: string }> }
export type ChartLegendConfig = { items: ChartLegendItem[]; ariaLabel?: string }
export type ChartPanel = { title: string; loadingId: string; canvasId: string; chartConfig: ChartConfig | null; legend?: ChartLegendConfig; shell?: Partial<typeof DEFAULT_SHELL> }
export type MetricCardPanel = DashboardDisplayCard & { cardId?: string; titleId?: string; valueId?: string; subtitleId?: string; trendId?: string }

type TableConfig<T> = { bodyId: string; columns: Array<{ header: string; cell: (row: T) => ReactNode; style?: CSSProperties }>; loadingMessage: string; emptyMessage: string; rowKey: (row: T) => string }
type KpiCard = { key: string; label: ReactNode; value: ReactNode; trend?: ReactNode; valueStyle?: CSSProperties; trendClassName?: string; trendStyle?: CSSProperties }

const loadingCards: KpiCard[] = Array.from({ length: loadingKpiCount }, (_, index) => ({ key: `loading-${index}`, label: 'Loading...', value: '--' }))
const buildKpiCards = (range: DashboardRange, analytics: DashboardAnalyticsResponse): KpiCard[] => {
  const { kpi } = analytics
  const timeLabel = rangeLabels[range]
  return [
    { key: 'goods-donation-units', label: `Goods Donation Units (${timeLabel})`, value: kpi.totalDonation.toLocaleString(), trend: kpi.trends.donation, trendClassName: 'kpi-trend trend-up' },
    { key: 'total-inventory-sku', label: 'Total Inventory SKU', value: kpi.totalSku },
    { key: 'packages-distributed', label: `Packages Distributed (${timeLabel})`, value: kpi.totalPackageDistributed, trend: kpi.trends.package, trendClassName: 'kpi-trend trend-up' },
    { key: 'low-stock-items', label: 'Low Stock Items', value: kpi.lowStockCount, trend: kpi.trends.lowStock, trendClassName: 'kpi-trend trend-down', valueStyle: { color: kpi.lowStockCount > 0 ? 'var(--color-warning)' : 'var(--color-success)' } },
    { key: 'expiring-soon-lots', label: 'Expiring Soon Lots', value: kpi.expiringLotCount, trend: kpi.trends.wastage, valueStyle: { color: kpi.expiringLotCount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }, trendStyle: { color: 'var(--color-warning)' } },
    { key: 'redemption-success-rate', label: 'Redemption Success Rate', value: `${kpi.redemptionRate}%` },
  ]
}

const TABLES = {
  expiring: {
    bodyId: 'expiring-lots-body',
    columns: [
      { header: 'Item Name', cell: (row: DashboardExpiringLot) => row.item_name },
      { header: 'Lot Number', cell: (row: DashboardExpiringLot) => row.lot_number },
      { header: 'Expiry Date', cell: (row: DashboardExpiringLot) => row.expiry_date },
      { header: 'Remaining Stock', cell: (row: DashboardExpiringLot) => row.remaining_stock_label },
      { header: 'Days Until Expiry', cell: (row: DashboardExpiringLot) => <span style={toneStyle(row.status_tone)}>{row.days_until_expiry} Day{row.days_until_expiry === 1 ? '' : 's'}</span> },
    ],
    loadingMessage: 'Loading live expiry data...',
    emptyMessage: 'No lots are expiring in the next 30 days.',
    rowKey: (row: DashboardExpiringLot) => `${row.item_name}-${row.lot_number}`,
  },
  verification: {
    bodyId: 'recent-verification-body',
    columns: [
      { header: 'Redemption Code', cell: (row: DashboardVerificationRecord) => row.redemption_code },
      { header: 'Package Type', cell: (row: DashboardVerificationRecord) => row.package_type },
      { header: 'Verified At', cell: (row: DashboardVerificationRecord) => row.verified_at },
      { header: 'Status', cell: (row: DashboardVerificationRecord) => <span style={toneStyle(row.status_tone)}>{row.status}</span> },
    ],
    loadingMessage: 'Loading live verification records...',
    emptyMessage: 'No recent verification records yet.',
    rowKey: (row: DashboardVerificationRecord) => `${row.redemption_code}-${row.verified_at}`,
  },
} satisfies { expiring: TableConfig<DashboardExpiringLot>; verification: TableConfig<DashboardVerificationRecord> }

const renderMessage = (message: string, id?: string) => <div id={id} className="loading">{message}</div>
const renderLegend = (title: string, legend: ChartLegendConfig) => (
  <div className="chart-legend" aria-label={legend.ariaLabel ?? `${title} legend`}>
    {legend.items.map((item) => (
      <div key={`${item.label}-${item.value}`} className={item.color ? 'chart-legend-item' : 'chart-legend-item chart-legend-item--supplemental'}>
        <div className="chart-legend-row">
          <div className="chart-legend-label">
            <span className={item.color ? 'chart-legend-swatch' : 'chart-legend-swatch chart-legend-swatch--neutral'} style={item.color ? { backgroundColor: item.color } : undefined} />
            <span>{item.label}</span>
          </div>
          <span className="chart-legend-value">{item.value}</span>
        </div>
        {item.description ? <p className="chart-legend-description">{item.description}</p> : null}
        {item.details?.length ? <div className="chart-legend-details">{item.details.map((detail) => <div key={`${item.label}-${detail.label}`} className="chart-legend-detail"><span>{detail.label}</span><span className="chart-legend-detail-value">{detail.value}</span></div>)}</div> : null}
      </div>
    ))}
  </div>
)

function DashboardTable<T>({ rows, isLoading, config }: { rows: T[]; isLoading: boolean; config: TableConfig<T> }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>{config.columns.map((column) => <th key={column.header}>{column.header}</th>)}</tr>
        </thead>
        <tbody id={config.bodyId}>
          {isLoading ? <tr><td colSpan={config.columns.length} style={STYLES.tableMessage}>{config.loadingMessage}</td></tr> : !rows.length ? <tr><td colSpan={config.columns.length} style={STYLES.tableMessage}>{config.emptyMessage}</td></tr> : rows.map((row) => <tr key={config.rowKey(row)}>{config.columns.map((column) => <td key={column.header} style={column.style}>{column.cell(row)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function StatsChart({ title, chartConfig, isLoading, loadingId, canvasId, legend, shell }: ChartPanel & { isLoading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<ChartJsInstance | null>(null)
  const [chartError, setChartError] = useState('')
  const messages = { ...DEFAULT_SHELL, ...(shell ?? {}) }
  const showChart = !isLoading && !chartError && Boolean(chartConfig)

  useEffect(() => {
    let active = true
    if (!chartConfig || !canvasRef.current) {
      chartRef.current?.destroy()
      chartRef.current = null
      setChartError('')
      return () => {
        active = false
      }
    }

    loadChartJs()
      .then((Chart) => {
        if (!active || !canvasRef.current) {
          return
        }
        chartRef.current?.destroy()
        chartRef.current = new Chart(canvasRef.current, chartConfig)
        setChartError('')
      })
      .catch((error) => active && setChartError(error instanceof Error ? error.message : 'Failed to load chart.'))

    return () => {
      active = false
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [chartConfig])

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className={showChart && legend?.items.length ? 'chart-card-content chart-card-content--with-legend' : undefined}>
        <div className="chart-container">
          {isLoading ? renderMessage(messages.loadingMessage, loadingId) : chartError ? renderMessage(chartError) : !showChart ? renderMessage(messages.emptyMessage) : null}
          <canvas id={canvasId} ref={canvasRef} style={{ display: showChart ? 'block' : 'none' }} />
        </div>
        {showChart && legend?.items.length ? renderLegend(title, legend) : null}
      </div>
    </div>
  )
}

export const MetricCard = ({ title, value, subtitle, trend, cardId, titleId, valueId, subtitleId, trendId }: MetricCardPanel) => (
  <div className="chart-card" id={cardId}>
    <h3 className="chart-title" id={titleId}>{title}</h3>
    <div className="chart-container" style={STYLES.metricBody}>
      <div id={valueId} style={STYLES.metricValue}>{value}</div>
      <div id={subtitleId} style={STYLES.metricSubtitle}>{subtitle}</div>
      {trend ? <p id={trendId} style={STYLES.metricTrend}>{trend}</p> : null}
    </div>
  </div>
)

export const ExpiryTable = ({ isLoading, rows }: { isLoading: boolean; rows: DashboardExpiringLot[] }) => <DashboardTable rows={rows} isLoading={isLoading} config={TABLES.expiring} />
export const VerificationTable = ({ isLoading, rows }: { isLoading: boolean; rows: DashboardVerificationRecord[] }) => <DashboardTable rows={rows} isLoading={isLoading} config={TABLES.verification} />

export function KpiCards({ range, analytics }: { range: DashboardRange; analytics?: DashboardAnalyticsResponse | null }) {
  const cards = analytics ? buildKpiCards(range, analytics) : loadingCards
  return <div className="kpi-grid">{cards.map((card) => <div key={card.key} className="kpi-card"><div className="kpi-label">{card.label}</div><div className="kpi-value" style={card.valueStyle}>{card.value}</div>{card.trend ? <div className={card.trendClassName ?? 'kpi-trend'} style={card.trendStyle}>{card.trend}</div> : null}</div>)}</div>
}
