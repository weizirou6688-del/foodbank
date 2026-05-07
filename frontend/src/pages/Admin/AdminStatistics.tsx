import { useEffect } from "react";
import AdminFeedbackBanner from "@/features/admin/components/AdminFeedbackBanner";
import { useScrollToTopOnMount } from "@/shared/lib/scroll";
import AdminLayout from "./AdminLayout";
import adminStyles from "./admin.module.css";
import { useAdminStatisticsPageModel } from "./adminStatistics.pageModel";
import {
  DonationSection,
  DistributionSection,
  InventorySection,
  StatsKpiSection,
  VerificationSection,
  WasteSection,
} from "./statsSections.analytics";

export default function AdminStatistics() {
  const model = useAdminStatisticsPageModel();

  useScrollToTopOnMount();

  useEffect(() => {
    document.title = "Data Dashboard - ABC Foodbank";
  }, []);

  return (
    <AdminLayout {...model.pageMeta}>
      <>
        {model.loadError ? (
          <section className={adminStyles.section}>
            <div className={adminStyles.container}>
              <AdminFeedbackBanner
                tone="error"
                message={model.loadError}
                onClose={model.clearLoadError}
              />
            </div>
          </section>
        ) : null}
        <StatsKpiSection {...model.kpiSectionProps} />
        <DonationSection {...model.donationSectionProps} />
        <InventorySection {...model.inventorySectionProps} />
        <DistributionSection {...model.distributionSectionProps} />
        <WasteSection {...model.wasteSectionProps} />
        <VerificationSection {...model.verificationSectionProps} />
      </>
    </AdminLayout>
  );
}
