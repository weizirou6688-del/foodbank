import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import {
  AdminFilterPillButton,
  AdminMutedText,
  AdminPanel,
  AdminPanelActionButton,
  AdminPageHeading,
  AdminSectionHeading,
  AdminTableCell,
  AdminTableHeaderCell,
  AdminTableMessageRow,
} from '@/features/admin/components/AdminDisplayPrimitives'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import { adminAPI } from '@/shared/lib/api'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import type { DonationListRow } from '@/shared/types/common'

type Period = 'Day' | 'Week' | 'Month'

interface Props {
  onSwitch: (s: 'statistics' | 'food') => void
}

interface PackageStatsRow {
  package_id: number
  package_name: string
  request_count: number
  total_requested_items: number
}

interface StockGapRow {
  package_id: number
  package_name: string
  stock: number
  threshold: number
  gap: number
}

interface DonationSummary {
  total_cash_donations?: number
  total_goods_donations?: number
  average_cash_per_donation?: number
  donations_by_week?: Array<{
    week: string
    cash: number
    goods_count: number
  }>
}

interface PeriodSummary {
  totalCashPence: number
  totalGoodsCount: number
  averageCashPence: number
  cashDonationCount: number
}

const PERIOD_WINDOW_IN_DAYS: Record<Period, number> = {
  Day: 1,
  Week: 7,
  Month: 30,
}

const PERIOD_LABEL: Record<Period, string> = {
  Day: 'last 24 hours',
  Week: 'last 7 days',
  Month: 'last 30 days',
}

export default function AdminStatistics({ onSwitch: _onSwitch }: Props) {
  const [period, setPeriod] = useState<Period>('Day')
  const accessToken = useAuthStore((state) => state.accessToken)
  const [donations, setDonations] = useState<DonationListRow[]>([])
  const [packageStats, setPackageStats] = useState<PackageStatsRow[]>([])
  const [stockGapRows, setStockGapRows] = useState<StockGapRow[]>([])
  const [donationSummary, setDonationSummary] = useState<DonationSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadStatistics = async () => {
    if (!accessToken) {
      setDonations([])
      setPackageStats([])
      setStockGapRows([])
      setDonationSummary(null)
      return
    }

    setIsLoading(true)
    setLoadError('')

    const errors: string[] = []

    const [donationsData, packagesData, stockGapData, summaryData] = await Promise.all([
      adminAPI.getDonations(accessToken).catch((error) => {
        errors.push(error instanceof Error ? error.message : 'Failed to load donations.')
        return []
      }),
      adminAPI.getPackageStats(accessToken).catch((error) => {
        errors.push(error instanceof Error ? error.message : 'Failed to load package statistics.')
        return []
      }),
      adminAPI.getStockGap(accessToken).catch((error) => {
        errors.push(error instanceof Error ? error.message : 'Failed to load stock gap analysis.')
        return []
      }),
      adminAPI.getStats(accessToken).catch((error) => {
        errors.push(error instanceof Error ? error.message : 'Failed to load donation summary.')
        return null
      }),
    ])

    setDonations(Array.isArray(donationsData) ? donationsData : [])
    setPackageStats(Array.isArray(packagesData) ? (packagesData as PackageStatsRow[]) : [])
    setStockGapRows(Array.isArray(stockGapData) ? (stockGapData as StockGapRow[]) : [])
    setDonationSummary(summaryData && typeof summaryData === 'object' ? (summaryData as DonationSummary) : null)
    setLoadError(errors[0] ?? '')
    setIsLoading(false)
  }

  useEffect(() => {
    void loadStatistics()
  }, [accessToken])

  const latestDonations = useMemo(() => donations.slice(0, 12), [donations])
  const topPackages = useMemo(() => packageStats.slice(0, 5), [packageStats])
  const stockGapPreview = useMemo(() => stockGapRows.slice(0, 6), [stockGapRows])

  const periodSummary = useMemo<PeriodSummary | null>(() => {
    if (donations.length === 0) {
      return null
    }

    const now = Date.now()
    const cutoff = now - PERIOD_WINDOW_IN_DAYS[period] * 24 * 60 * 60 * 1000

    let totalCashPence = 0
    let cashDonationCount = 0
    let totalGoodsCount = 0

    donations.forEach((row) => {
      if (!row.created_at) {
        return
      }

      const createdAt = new Date(row.created_at)
      if (Number.isNaN(createdAt.getTime()) || createdAt.getTime() < cutoff) {
        return
      }

      if (row.donation_type === 'cash') {
        if (row.status === 'completed' && typeof row.amount_pence === 'number') {
          totalCashPence += row.amount_pence
          cashDonationCount += 1
        }
        return
      }

      if (row.status === 'received') {
        totalGoodsCount += 1
      }
    })

    return {
      totalCashPence,
      totalGoodsCount,
      averageCashPence: cashDonationCount > 0 ? Math.round(totalCashPence / cashDonationCount) : 0,
      cashDonationCount,
    }
  }, [donations, period])

  const formatDateTime = (value?: string) => {
    if (!value) {
      return '-'
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }
    return parsed.toLocaleString()
  }

  const renderDonationDetail = (row: DonationListRow) => {
    if (row.donation_type === 'cash') {
      const amount = typeof row.amount_pence === 'number' ? (row.amount_pence / 100).toFixed(2) : '0.00'
      return `GBP ${amount}`
    }
    if (Array.isArray(row.items) && row.items.length > 0) {
      return row.items.map((item) => `${item.item_name} x${item.quantity}`).join(', ')
    }
    return row.notes || row.donor_name || 'Goods donation'
  }

  const summaryLine = (() => {
    if (periodSummary) {
      if (periodSummary.cashDonationCount === 0 && periodSummary.totalGoodsCount === 0) {
        return `No completed or received donations were recorded in the ${PERIOD_LABEL[period]}.`
      }

      return `For the ${PERIOD_LABEL[period]}: cash total GBP ${(periodSummary.totalCashPence / 100).toFixed(2)} | Goods donations ${periodSummary.totalGoodsCount} | Avg cash GBP ${(periodSummary.averageCashPence / 100).toFixed(2)}`
    }

    if (!donationSummary) {
      return `Donation summary ${period} view is not available yet.`
    }

    const totalCash = Number(donationSummary.total_cash_donations ?? 0)
    const totalGoods = Number(donationSummary.total_goods_donations ?? 0)
    const averageCash = Number(donationSummary.average_cash_per_donation ?? 0) / 100

    return `Cash total GBP ${(totalCash / 100).toFixed(2)} | Goods donations ${totalGoods} | Avg cash GBP ${averageCash.toFixed(2)}`
  })()

  return (
    <div className="fade-in">
      <AdminPageHeading className="mb-6">
        Statistics
      </AdminPageHeading>

      {loadError && (
        <AdminFeedbackBanner tone="error" message={loadError} onClose={() => setLoadError('')} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-[#1A1A1A]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
          </svg>
          Donation Trends
        </h3>
        <div className="flex flex-wrap gap-2">
          {(['Day', 'Week', 'Month'] as Period[]).map((p) => (
            <AdminFilterPillButton
              key={p}
              onClick={() => setPeriod(p)}
              active={period === p}
            >
              {p}
            </AdminFilterPillButton>
          ))}
        </div>
      </div>

      <AdminPanel className="mb-8">
        <div className="bg-[#F7DC6F]/15 border-[1.5px] border-dashed border-[#F7DC6F] rounded-2xl h-[180px] flex items-center justify-center text-[#1A1A1A] text-sm gap-2 px-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F] shrink-0">
            <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
          </svg>
          {isLoading ? `Loading donation summary for ${period} view...` : summaryLine}
        </div>
      </AdminPanel>

      <div className="grid lg:grid-cols-2 gap-6">
        <AdminPanel>
          <AdminSectionHeading
            className="mb-6"
            icon={(
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
                <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
              </svg>
            )}
          >
            Top Requested Packages
          </AdminSectionHeading>
          <ol className="list-none space-y-0">
            {isLoading && topPackages.length === 0 && (
              <li className="py-3">
                <AdminMutedText>Loading package statistics...</AdminMutedText>
              </li>
            )}
            {!isLoading && topPackages.length === 0 && (
              <li className="py-3">
                <AdminMutedText>No package request data yet.</AdminMutedText>
              </li>
            )}
            {topPackages.map((row) => (
              <li key={row.package_id} className="flex justify-between py-3 border-b border-dashed border-[#E8E8E8] last:border-0 text-[#1A1A1A]">
                <span>{row.package_name}</span>
                <span className="font-bold">{row.request_count} requests</span>
              </li>
            ))}
          </ol>
        </AdminPanel>

        <AdminPanel className="overflow-x-auto">
          <AdminSectionHeading
            className="mb-6"
            icon={(
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                <line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            )}
          >
            Stock Gap Analysis
          </AdminSectionHeading>
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr>
                {['Package', 'Threshold', 'Current', 'Gap'].map((h) => (
                  <AdminTableHeaderCell key={h}>{h}</AdminTableHeaderCell>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && stockGapPreview.length === 0 && (
                <AdminTableMessageRow colSpan={4}>Loading stock gap analysis...</AdminTableMessageRow>
              )}
              {!isLoading && stockGapPreview.length === 0 && (
                <AdminTableMessageRow colSpan={4}>No packages are currently below threshold.</AdminTableMessageRow>
              )}
              {stockGapPreview.map((row) => (
                <tr key={row.package_id}>
                  <AdminTableCell>{row.package_name}</AdminTableCell>
                  <AdminTableCell>{row.threshold}</AdminTableCell>
                  <AdminTableCell>{row.stock}</AdminTableCell>
                  <AdminTableCell className={row.gap > 0 ? 'font-medium text-[#E63946]' : 'font-medium text-[#68CD52]'}>
                    {row.gap > 0 ? `-${row.gap}` : row.gap}
                  </AdminTableCell>
                </tr>
              ))}
            </tbody>
          </table>
          <AdminMutedText className="mt-4">* based on current package stock versus threshold</AdminMutedText>
        </AdminPanel>
      </div>

      <AdminPanel className="mt-8 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <AdminSectionHeading>Recent Donations</AdminSectionHeading>
          <AdminPanelActionButton onClick={() => void loadStatistics()}>
            Refresh
          </AdminPanelActionButton>
        </div>

        {isLoading && <AdminMutedText>Loading donations...</AdminMutedText>}

        {!isLoading && latestDonations.length === 0 && !loadError && (
          <AdminMutedText>No donation records yet.</AdminMutedText>
        )}

        {!isLoading && latestDonations.length > 0 && (
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr>
                <AdminTableHeaderCell>Type</AdminTableHeaderCell>
                <AdminTableHeaderCell>Donor</AdminTableHeaderCell>
                <AdminTableHeaderCell>Email</AdminTableHeaderCell>
                <AdminTableHeaderCell>Details</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Created At</AdminTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {latestDonations.map((row, index) => (
                <tr key={`${row.donation_type}-${row.created_at || index}-${index}`}>
                  <AdminTableCell>{row.donation_type}</AdminTableCell>
                  <AdminTableCell>{row.donor_name || '-'}</AdminTableCell>
                  <AdminTableCell>{row.donor_email || '-'}</AdminTableCell>
                  <AdminTableCell>{renderDonationDetail(row)}</AdminTableCell>
                  <AdminTableCell>{row.status || '-'}</AdminTableCell>
                  <AdminTableCell>{formatDateTime(row.created_at)}</AdminTableCell>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminPanel>
      <PublicSiteFooter />
    </div>
  )
}
