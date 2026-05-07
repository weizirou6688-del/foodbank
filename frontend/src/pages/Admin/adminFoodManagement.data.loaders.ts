import {
  applicationsAPI,
  type AdminApplicationRecord,
} from "@/shared/lib/api/applications";
import { adminAPI } from "@/shared/lib/api/admin";
import { foodBanksAPI } from "@/shared/lib/api/foodBanks";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import type { DonationListRow } from "@/shared/types/donations";
import {
  extractApplications,
  runManagedRequest,
  sortApplications,
  sortDonations,
} from "./rules";
import type { InventoryLotRow } from "./adminFoodManagement.types";
import {
  extractFoodBanks,
  mergePackageDetailsById,
  sortNamedRows,
  type AuthorizedLoadConfig,
  type CancelGuard,
  type FoodBankOption,
  type StateSetter,
} from "./adminFoodManagement.data.shared";
type RunAuthorizedLoad = <Result>(
  config: AuthorizedLoadConfig<Result>,
  isCancelled?: CancelGuard,
) => Promise<void>;
function applyScopedPackageDetails({
  details,
  setScopedPackageDetails,
  setPackageDetailsById,
}: {
  details: FoodPackageDetailRecord[];
  setScopedPackageDetails: StateSetter<FoodPackageDetailRecord[]>;
  setPackageDetailsById: StateSetter<Record<number, FoodPackageDetailRecord>>;
}) {
  // Cache detail rows by id as well as by current scope so editors can reopen
  // quickly without re-fetching package metadata every time.
  const sortedDetails = sortNamedRows(details);
  setScopedPackageDetails(sortedDetails);
  setPackageDetailsById((current) =>
    mergePackageDetailsById(current, sortedDetails),
  );
}
export function loadAdminFoodManagementLots(
  {
    runAuthorizedLoad,
    setLotRows,
    setIsLoadingLots,
    setLotError,
  }: {
    runAuthorizedLoad: RunAuthorizedLoad;
    setLotRows: StateSetter<InventoryLotRow[]>;
    setIsLoadingLots: StateSetter<boolean>;
    setLotError: StateSetter<string>;
  },
  isCancelled?: CancelGuard,
) {
  return runAuthorizedLoad(
    {
      request: (token) => adminAPI.getInventoryLots(token, true),
      setLoading: setIsLoadingLots,
      setError: setLotError,
      fallbackMessage: "Failed to load inventory lots.",
      onSuccess: (data) =>
        setLotRows(Array.isArray(data) ? (data as InventoryLotRow[]) : []),
    },
    isCancelled,
  );
}
export function loadAdminFoodManagementDonations(
  {
    runAuthorizedLoad,
    setDonations,
    setIsLoadingDonations,
    setDonationError,
  }: {
    runAuthorizedLoad: RunAuthorizedLoad;
    setDonations: StateSetter<DonationListRow[]>;
    setIsLoadingDonations: StateSetter<boolean>;
    setDonationError: StateSetter<string>;
  },
  isCancelled?: CancelGuard,
) {
  return runAuthorizedLoad(
    {
      request: (token) => adminAPI.getDonations(token),
      setLoading: setIsLoadingDonations,
      setError: setDonationError,
      fallbackMessage: "Failed to load donation records.",
      onSuccess: (data) =>
        setDonations(
          sortDonations(Array.isArray(data) ? (data as DonationListRow[]) : []),
        ),
    },
    isCancelled,
  );
}
export function loadAdminFoodManagementApplications(
  {
    runAuthorizedLoad,
    setApplications,
    setIsLoadingApplications,
    setApplicationsError,
  }: {
    runAuthorizedLoad: RunAuthorizedLoad;
    setApplications: StateSetter<AdminApplicationRecord[]>;
    setIsLoadingApplications: StateSetter<boolean>;
    setApplicationsError: StateSetter<string>;
  },
  isCancelled?: CancelGuard,
) {
  return runAuthorizedLoad(
    {
      request: (token) => applicationsAPI.getAdminApplications(token),
      setLoading: setIsLoadingApplications,
      setError: setApplicationsError,
      fallbackMessage: "Failed to load redemption code records.",
      onSuccess: (data) =>
        setApplications(sortApplications(extractApplications(data))),
    },
    isCancelled,
  );
}
export function loadAdminFoodManagementFoodBanks(
  {
    setAvailableFoodBanks,
    setAvailableFoodBanksError,
  }: {
    setAvailableFoodBanks: StateSetter<FoodBankOption[]>;
    setAvailableFoodBanksError: StateSetter<string>;
  },
  isCancelled?: CancelGuard,
) {
  return runManagedRequest({
    request: () => foodBanksAPI.getFoodBanks(),
    fallbackMessage: "Failed to load food banks.",
    onSuccess: (response) => {
      setAvailableFoodBanks(extractFoodBanks(response));
      setAvailableFoodBanksError("");
    },
    onError: (message) => {
      setAvailableFoodBanks([]);
      setAvailableFoodBanksError(message);
    },
    isCancelled,
  });
}
export function loadAdminFoodManagementScopedPackages(
  {
    accessToken,
    foodBankId,
    runAuthorizedLoad,
    setScopedPackageDetails,
    setScopedPackageError,
    setIsLoadingScopedPackages,
    setPackageDetailsById,
  }: {
    accessToken: string | null;
    foodBankId: number | null;
    runAuthorizedLoad: RunAuthorizedLoad;
    setScopedPackageDetails: StateSetter<FoodPackageDetailRecord[]>;
    setScopedPackageError: StateSetter<string>;
    setIsLoadingScopedPackages: StateSetter<boolean>;
    setPackageDetailsById: StateSetter<Record<number, FoodPackageDetailRecord>>;
  },
  isCancelled?: CancelGuard,
) {
  if (!accessToken || foodBankId == null) {
    if (!isCancelled?.()) {
      setScopedPackageDetails([]);
      setScopedPackageError("");
      setIsLoadingScopedPackages(false);
    }
    return Promise.resolve();
  }
  return runAuthorizedLoad(
    {
      request: (token) => adminAPI.listFoodPackages(token, { foodBankId }),
      setLoading: setIsLoadingScopedPackages,
      setError: setScopedPackageError,
      fallbackMessage: "Failed to load food packages.",
      onSuccess: (details) =>
        applyScopedPackageDetails({
          details: Array.isArray(details) ? details : [],
          setScopedPackageDetails,
          setPackageDetailsById,
        }),
      onError: () => setScopedPackageDetails([]),
    },
    isCancelled,
  );
}
