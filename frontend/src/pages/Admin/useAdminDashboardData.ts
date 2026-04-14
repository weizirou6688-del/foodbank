import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import { adminAPI } from '@/shared/lib/api/admin'
import type { DashboardAnalyticsResponse } from '@/shared/lib/api/stats'
import { trendGroupingCopy } from './statsConfig'

export type DashboardRange = 'month' | 'quarter' | 'year'

type RangeBounds = { start: Date; end: Date }

const RANGE_BOUNDS: Record<DashboardRange, (today: Date) => RangeBounds> = {
  month: (today) => ({ start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }),
  quarter: (today) => ({ start: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), end: today }),
  year: (today) => ({ start: new Date(today.getFullYear(), 0, 1), end: today }),
}

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate())
const getRangeBounds = (range: DashboardRange) => RANGE_BOUNDS[range](startOfDay(new Date()))
const formatSummaryDate = (value: Date) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function buildRangeSummary(range: DashboardRange) {
  const bounds = getRangeBounds(range)
  const quarterNote =
    range === 'quarter' && getRangeBounds('month').start.getTime() === bounds.start.getTime()
      ? 'The current calendar quarter started this month, so month and quarter can match early in the quarter.'
      : ''

  return [`Live range: ${formatSummaryDate(bounds.start)} to ${formatSummaryDate(bounds.end)}.`, quarterNote, trendGroupingCopy[range]]
    .filter(Boolean)
    .join(' ')
}

export function useAdminDashboardData() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [range, setRange] = useState<DashboardRange>('month')
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const refreshDashboard = useCallback(async (nextRange = range) => {
    if (!accessToken) {
      setAnalytics(null)
      setLoadError('')
      return
    }

    setIsLoading(true)
    setLoadError('')

    try {
      setAnalytics(await adminAPI.getDashboardAnalytics(accessToken, nextRange))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard analytics.')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, range])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  return { range, setRange, analytics, isLoading, loadError, setLoadError, refreshDashboard, rangeSummary: buildRangeSummary(range) }
}
