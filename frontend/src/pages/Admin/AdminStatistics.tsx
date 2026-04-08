import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
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
  const stockGapTopRows = useMemo(() => stockGapRows.slice(0, 6), [stockGapRows])

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
      <h2 className="text-2xl md:text-[1.6rem] font-bold text-[#1A1A1A] border-l-[6px] border-[#F7DC6F] pl-4 mb-6" style={{ fontFamily: 'serif' }}>
        Statistics
      </h2>

      {loadError && (
        <div className="mb-6 rounded-xl border border-[#E63946]/30 bg-[#E63946]/[0.08] px-4 py-3 text-sm text-[#E63946]">
          {loadError}
        </div>
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
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-colors ${
                period === p
                  ? 'bg-[#F7DC6F] border-[#F7DC6F] text-[#1A1A1A] hover:bg-[#F0C419]'
                  : 'bg-transparent border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm mb-8">
        <div className="bg-[#F7DC6F]/15 border-[1.5px] border-dashed border-[#F7DC6F] rounded-2xl h-[180px] flex items-center justify-center text-[#1A1A1A] text-sm gap-2 px-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F] shrink-0">
            <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
          </svg>
          {isLoading ? `Loading donation summary for ${period} view...` : summaryLine}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-[#1A1A1A]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
              <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
            Top Requested Packages
          </h3>
          <ol className="list-none space-y-0">
            {isLoading && topPackages.length === 0 && (
              <li className="py-3 text-sm text-gray-500">Loading package statistics...</li>
            )}
            {!isLoading && topPackages.length === 0 && (
              <li className="py-3 text-sm text-gray-500">No package request data yet.</li>
            )}
            {topPackages.map((row) => (
              <li key={row.package_id} className="flex justify-between py-3 border-b border-dashed border-[#E8E8E8] last:border-0 text-[#1A1A1A]">
                <span>{row.package_name}</span>
                <span className="font-bold">{row.request_count} requests</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm overflow-x-auto">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-[#1A1A1A]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F7DC6F]">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            Stock Gap Analysis
          </h3>
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr>
                {['Package', 'Threshold', 'Current', 'Gap'].map((h) => (
                  <th key={h} className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && stockGapTopRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-gray-500">Loading stock gap analysis...</td>
                </tr>
              )}
              {!isLoading && stockGapTopRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-gray-500">No packages are currently below threshold.</td>
                </tr>
              )}
              {stockGapTopRows.map((row) => (
                <tr key={row.package_id}>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.package_name}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.threshold}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.stock}</td>
                  <td className={`py-3 border-b border-[#E8E8E8] font-medium ${row.gap > 0 ? 'text-[#E63946]' : 'text-[#68CD52]'}`}>{row.gap > 0 ? `-${row.gap}` : row.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-sm text-gray-500">* based on current package stock versus threshold</div>
        </div>
      </div>

      <div className="mt-8 bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-[#1A1A1A]">Recent Donations</h3>
          <button
            onClick={() => void loadStatistics()}
            className="px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading donations...</p>}

        {!isLoading && latestDonations.length === 0 && !loadError && (
          <p className="text-sm text-gray-500">No donation records yet.</p>
        )}

        {!isLoading && latestDonations.length > 0 && (
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Type</th>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Donor</th>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Email</th>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Details</th>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Status</th>
                <th className="py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]">Created At</th>
              </tr>
            </thead>
            <tbody>
              {latestDonations.map((row, index) => (
                <tr key={`${row.donation_type}-${row.created_at || index}-${index}`}>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.donation_type}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.donor_name || '-'}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.donor_email || '-'}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{renderDonationDetail(row)}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{row.status || '-'}</td>
                  <td className="py-3 border-b border-[#E8E8E8] text-[#1A1A1A]">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <PublicSiteFooter />
    </div>
  )
}
