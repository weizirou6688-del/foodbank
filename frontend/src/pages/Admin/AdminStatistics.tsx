import { useEffect } from 'react'
import { useScrollToTopOnMount } from '@/shared/lib/scroll'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import AdminPageShell from './AdminPageShell'
import { getPageMeta } from './pageMeta'
import {
  makeDonationView,
  makeExpiryView,
  makeInventoryView,
  makePackageView,
  makeRedemptionView,
} from './statsView'
import {
  DonationSection,
  DistributionSection,
  InventorySection,
  StatsKpiSection,
  VerificationSection,
  WasteSection,
} from './statsSections'
import { useAdminDashboardData } from './useAdminDashboardData'

export default function AdminStatistics() {
  const pageMeta = getPageMeta('statistics')
  const {
    range,
    setRange,
    analytics,
    isLoading,
    loadError,
    setLoadError,
    refreshDashboard,
    rangeSummary,
  } = useAdminDashboardData()

  useScrollToTopOnMount()

  useEffect(() => {
    document.title = 'Data Dashboard - ABC Foodbank'
  }, [])

  const { primaryPanels: donationPrimaryPanels, secondaryPanels: donationSecondaryPanels, averageDonationCard } =
    makeDonationView(analytics)
  const { panels: inventoryPanels } = makeInventoryView(analytics)
  const {
    primaryPanels: packagePrimaryPanels,
    packageTypePanel,
    averageSupportCard,
    itemsPerPackageCard,
  } = makePackageView(analytics)
  const { panels: expiryPanels, expiringLots } = makeExpiryView(analytics)
  const { panels: redemptionPanels, recentVerificationRecords } = makeRedemptionView(analytics)

  return (
    <AdminPageShell
      section="statistics"
      {...pageMeta}
    >
      {loadError ? (
        <section className="section">
          <div className="container">
            <AdminFeedbackBanner tone="error" message={loadError} onClose={() => setLoadError('')} />
          </div>
        </section>
      ) : null}
      <StatsKpiSection
        range={range}
        setRange={setRange}
        refreshDashboard={refreshDashboard}
        rangeSummary={rangeSummary}
        analytics={analytics}
      />
      <DonationSection
        primaryPanels={donationPrimaryPanels}
        secondaryPanels={donationSecondaryPanels}
        averageDonationCard={averageDonationCard}
        isLoading={isLoading}
      />
      <InventorySection
        panels={inventoryPanels}
        isLoading={isLoading}
      />
      <DistributionSection
        primaryPanels={packagePrimaryPanels}
        packageTypePanel={packageTypePanel}
        averageSupportCard={averageSupportCard}
        itemsPerPackageCard={itemsPerPackageCard}
        isLoading={isLoading}
      />
      <WasteSection
        panels={expiryPanels}
        expiringLots={expiringLots}
        isLoading={isLoading}
      />
      <VerificationSection
        panels={redemptionPanels}
        verificationRows={recentVerificationRecords}
        isLoading={isLoading}
      />
    </AdminPageShell>
  )
}

