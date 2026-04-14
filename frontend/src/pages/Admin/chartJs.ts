export interface ChartJsInstance {
  destroy: () => void
}
type ChartJsConstructor = new (
  item: HTMLCanvasElement,
  config: Record<string, unknown>,
) => ChartJsInstance
declare global {
  interface Window {
    Chart?: ChartJsConstructor
  }
}
const CHART_SCRIPT_ID = 'admin-dashboard-chartjs'
let chartPromise: Promise<ChartJsConstructor> | null = null
export function loadChartJs(): Promise<ChartJsConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Chart.js can only be loaded in the browser'))
  }
  if (window.Chart) {
    return Promise.resolve(window.Chart)
  }
  if (chartPromise) {
    return chartPromise
  }
  chartPromise = new Promise<ChartJsConstructor>((resolve, reject) => {
    const existingScript = document.getElementById(CHART_SCRIPT_ID) as HTMLScriptElement | null
    const resolveChart = () => {
      if (window.Chart) {
        resolve(window.Chart)
        return
      }
      reject(new Error('Chart.js did not initialize correctly'))
    }
    const handleLoad = () => {
      resolveChart()
    }
    const handleError = () => {
      chartPromise = null
      reject(new Error('Failed to load Chart.js'))
    }
    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = CHART_SCRIPT_ID
    script.src = '/vendor/chart.umd.min.js'
    script.async = true
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  })
  return chartPromise
}

