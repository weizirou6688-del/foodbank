import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicImpact } from '@/shared/lib/api/stats'

export type PublicImpactMetricCard = {
  change: string
  value: string
  label: string
  note: string
  positive?: boolean
}

export type PublicImpactMetricsStatus = 'loading' | 'ready' | 'error'

const DEFAULT_RANGE = 'month' as const
const DEFAULT_REFRESH_INTERVAL_MS = 30_000

export const DEFAULT_PUBLIC_IMPACT_METRICS: PublicImpactMetricCard[] = [
  { change: '+18%', value: '28,600', label: 'Network Food Units Distributed', note: 'Platform Total', positive: true },
  { change: '+8.2%', value: '1,240+', label: 'Households Supported Across the Network', note: 'Platform Total', positive: true },
  { change: '+42 pickups', value: '320', label: 'Completed Food Pickups Across the Network', note: 'This Month', positive: true },
  { change: '+15%', value: '12,500', label: 'Goods Donation Units Coordinated', note: 'This Year', positive: true },
]

interface UsePublicImpactMetricsOptions {
  enabled?: boolean
  range?: 'month' | 'quarter' | 'year'
  refreshIntervalMs?: number
}

const mapPublicImpactMetrics = (
  metrics: Array<{
    change: string
    value: string
    label: string
    note: string
    positive?: boolean
  }>,
): PublicImpactMetricCard[] => metrics.map((metric) => ({
  change: metric.change,
  value: metric.value,
  label: metric.label,
  note: metric.note,
  positive: metric.positive,
}))

export function usePublicImpactMetrics({
  enabled = true,
  range = DEFAULT_RANGE,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: UsePublicImpactMetricsOptions = {}) {
  const [impactMetrics, setImpactMetrics] = useState<PublicImpactMetricCard[]>(DEFAULT_PUBLIC_IMPACT_METRICS)
  const [status, setStatus] = useState<PublicImpactMetricsStatus>(enabled ? 'loading' : 'ready')
  const isMountedRef = useRef(true)
  const requestIdRef = useRef(0)

  const refreshImpactMetrics = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!enabled) return

    if (!silent) {
      setStatus((current) => (current === 'ready' ? current : 'loading'))
    }

    const requestId = ++requestIdRef.current

    try {
      const response = await getPublicImpact(range)
      if (!isMountedRef.current || requestId !== requestIdRef.current) return
      if (!Array.isArray(response.impactMetrics) || response.impactMetrics.length === 0) {
        setStatus('error')
        return
      }

      setImpactMetrics(mapPublicImpactMetrics(response.impactMetrics))
      setStatus('ready')
    } catch {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return
      setStatus('error')
    }
  }, [enabled, range])

  useEffect(() => {
    isMountedRef.current = true
    if (!enabled) {
      setStatus('ready')
      return () => {
        isMountedRef.current = false
      }
    }

    setStatus('loading')
    void refreshImpactMetrics()

    return () => {
      isMountedRef.current = false
    }
  }, [enabled, refreshImpactMetrics])

  useEffect(() => {
    if (!enabled || refreshIntervalMs <= 0) return

    const refreshVisibleMetrics = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void refreshImpactMetrics({ silent: true })
    }

    const intervalId = window.setInterval(refreshVisibleMetrics, refreshIntervalMs)
    window.addEventListener('focus', refreshVisibleMetrics)
    document.addEventListener('visibilitychange', refreshVisibleMetrics)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleMetrics)
      document.removeEventListener('visibilitychange', refreshVisibleMetrics)
    }
  }, [enabled, refreshImpactMetrics, refreshIntervalMs])

  return { impactMetrics, status, refreshImpactMetrics }
}
