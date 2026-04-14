import type { DashboardChartData } from '@/shared/lib/api/stats'

export type ChartConfig = {
  type: 'bar' | 'doughnut' | 'line' | 'pie'
  data: { labels: string[]; datasets: Array<Record<string, unknown>> }
  options?: Record<string, unknown>
}

const BASE_OPTIONS = { responsive: true, maintainAspectRatio: false }
const Y_SCALE = { beginAtZero: true }

const buildConfig = (
  type: ChartConfig['type'],
  data: DashboardChartData,
  datasets: Array<Record<string, unknown>>,
  options?: Record<string, unknown>,
): ChartConfig => ({ type, data: { labels: data.labels, datasets }, options: { ...BASE_OPTIONS, ...(options ?? {}) } })

export const hasChartData = (data?: DashboardChartData | null): data is DashboardChartData => Boolean(data?.labels.length && data.data.length)
export const pickChartData = (data?: DashboardChartData | null): DashboardChartData | undefined => (hasChartData(data) ? data : undefined)
export const makeDoughnutChart = (data: DashboardChartData, colors: string[], showLegend = true) =>
  buildConfig('doughnut', data, [{ data: data.data, backgroundColor: colors }], { plugins: { legend: { display: showLegend, position: 'bottom' } } })
export const makePieChart = (data: DashboardChartData, colors: string[], showLegend = true) =>
  buildConfig('pie', data, [{ data: data.data, backgroundColor: colors }], { plugins: { legend: { display: showLegend, position: 'bottom' } } })
export const makeLineChart = (
  data: DashboardChartData,
  label: string,
  borderColor: string,
  backgroundColor: string,
  yScaleOverrides?: Record<string, unknown>,
) => buildConfig('line', data, [{ label, data: data.data, borderColor, backgroundColor, fill: true, tension: 0.3 }], { scales: { y: { ...Y_SCALE, ...(yScaleOverrides ?? {}) } } })
export const makeBarChart = (data: DashboardChartData, label: string, backgroundColor: string | string[]) =>
  buildConfig('bar', data, [{ label, data: data.data, backgroundColor }], { scales: { y: { ...Y_SCALE } }, plugins: { legend: { display: false } } })
export const buildChart = <T,>(data: T | undefined, builder: (value: T) => ChartConfig) => (data ? builder(data) : null)
