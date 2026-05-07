import { useCallback, useEffect, useMemo } from "react";
import { useAuthStore } from "@/app/store/authStore";
import { getAdminScopeMeta } from "@/shared/lib/adminScope";
import { useScrollToTopOnMount } from "@/shared/lib/scroll";
import { usePublicImpactMetrics } from "@/shared/lib/usePublicImpactMetrics";
import AdminLayout, { getPageMeta } from "./AdminLayout";
import {
  buildLocalAdminImpactMetrics,
} from "./adminFoodManagement.impactMetrics";
import {
  AdminFoodManagementPageChrome,
  AdminFoodManagementPageSections,
} from "./adminFoodManagement.sections.page";
import { useAdminFoodManagementSectionsModel } from "./adminFoodManagement.sections.model";
import { useAdminFoodManagementData } from "./useAdminFoodManagementData";
import { useAdminFoodManagementUiState } from "./useAdminFoodManagementUiState";

export default function AdminFoodManagement() {
  const pageMeta = getPageMeta("food");
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const adminScope = useMemo(() => getAdminScopeMeta(user), [user]);
  const uiState = useAdminFoodManagementUiState(adminScope.foodBankId);
  const dataState = useAdminFoodManagementData({
    adminScope,
    selectedFoodBankId: uiState.selectedFoodBankId,
  });
  // Local food bank admins see scope-derived impact cards from data already
  // loaded on this page, while broader admins reuse the shared public feed.
  const {
    impactMetrics: publicImpactMetrics,
    status: publicImpactStatus,
    refreshImpactMetrics: refreshPublicImpactMetrics,
  } = usePublicImpactMetrics({
    enabled: !adminScope.isLocalFoodBankAdmin,
    refreshIntervalMs: 15000,
    token: accessToken,
  });
  const localImpactState = useMemo(
    () =>
      buildLocalAdminImpactMetrics({
        donations: dataState.donations,
        applications: dataState.applications,
        scopedPackageDetails: dataState.scopedPackageDetails,
        isLoading:
          dataState.isLoadingDonations ||
          dataState.isLoadingApplications ||
          dataState.isLoadingScopedPackages,
        hasError: Boolean(
          dataState.donationError ||
            dataState.applicationsError ||
            dataState.scopedPackageError,
        ),
      }),
    [
      dataState.applications,
      dataState.applicationsError,
      dataState.donationError,
      dataState.donations,
      dataState.isLoadingApplications,
      dataState.isLoadingDonations,
      dataState.isLoadingScopedPackages,
      dataState.scopedPackageDetails,
      dataState.scopedPackageError,
    ],
  );
  const impactMetrics = adminScope.isLocalFoodBankAdmin
    ? localImpactState.impactMetrics
    : publicImpactMetrics;
  const effectivePublicImpactStatus = adminScope.isLocalFoodBankAdmin
    ? localImpactState.status
    : publicImpactStatus;
  // Keep one refresh function shape for the sections model even though local
  // scope views have nothing extra to fetch from the public metrics endpoint.
  const refreshImpactMetrics = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (adminScope.isLocalFoodBankAdmin) {
        return;
      }
      await refreshPublicImpactMetrics({ silent });
    },
    [adminScope.isLocalFoodBankAdmin, refreshPublicImpactMetrics],
  );
  const sectionsModel = useAdminFoodManagementSectionsModel({
    adminScope,
    adminScopeFoodBankId: adminScope.foodBankId ?? null,
    dataState,
    uiState,
    impactMetrics,
    publicImpactStatus: effectivePublicImpactStatus,
    refreshImpactMetrics,
  });

  useScrollToTopOnMount();

  useEffect(() => {
    document.title = "Inventory Management - ABC Foodbank";
  }, []);

  return (
    <AdminLayout {...pageMeta}>
      <>
        <AdminFoodManagementPageSections {...sectionsModel.sectionsProps} />
        <AdminFoodManagementPageChrome
          editorModalProps={sectionsModel.editorModalProps}
          confirmModalProps={sectionsModel.confirmModalProps}
          detailModalProps={sectionsModel.detailModalProps}
          chrome={sectionsModel.chrome}
        />
      </>
    </AdminLayout>
  );
}
