import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/app/store/authStore";
import { useFoodBankStore } from "@/app/store/foodBankStore";
import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import { getAdminFoodBankScopeState } from "@/shared/lib/adminScope";
import type { DonationListRow } from "@/shared/types/donations";
import { buildScopedPackageRow } from "./builders";
import type {
  AuthorizedLoadConfig,
  CancelGuard,
  FoodBankOption,
  StateSetter,
  UseAdminFoodManagementDataArgs,
} from "./adminFoodManagement.data.shared";
import {
  loadAdminFoodManagementApplications,
  loadAdminFoodManagementDonations,
  loadAdminFoodManagementFoodBanks,
  loadAdminFoodManagementLots,
  loadAdminFoodManagementScopedPackages,
} from "./adminFoodManagement.data.loaders";
import type { InventoryLotRow, PackageRow } from "./adminFoodManagement.types";
import { captureRequestError } from "./rules";
import {
  sortNamedRows,
} from "./adminFoodManagement.data.shared";
import { runManagedRequest } from "./rules";
type ScopedPackingPackage = { id: number; name: string };
type DataLoader = () => Promise<unknown>;
type CancellableDataLoader = (isCancelled?: CancelGuard) => Promise<unknown>;
const buildFoodBankFilterOptions = (rows: FoodBankOption[]) =>
  sortNamedRows(rows);
const buildScopedPackageRows = (
  details: FoodPackageDetailRecord[],
): PackageRow[] => details.map((detail) => buildScopedPackageRow(detail));
const buildScopedPackingPackages = (
  details: FoodPackageDetailRecord[],
): ScopedPackingPackage[] =>
  details.map((detail) => ({ id: detail.id, name: detail.name }));

type InventoryLoader = () => Promise<unknown>;

function useAdminFoodManagementDataLoaders({
  accessToken,
  loadInventory,
  effectiveFoodBankId,
  setLotRows,
  setIsLoadingLots,
  setLotError,
  setDonations,
  setIsLoadingDonations,
  setDonationError,
  setApplications,
  setIsLoadingApplications,
  setApplicationsError,
  setAvailableFoodBanks,
  setAvailableFoodBanksError,
  setScopedPackageDetails,
  setScopedPackageError,
  setIsLoadingScopedPackages,
  setPackageDetailsById,
}: {
  accessToken: string | null;
  loadInventory: InventoryLoader;
  effectiveFoodBankId: number | null;
  setLotRows: StateSetter<InventoryLotRow[]>;
  setIsLoadingLots: StateSetter<boolean>;
  setLotError: StateSetter<string>;
  setDonations: StateSetter<DonationListRow[]>;
  setIsLoadingDonations: StateSetter<boolean>;
  setDonationError: StateSetter<string>;
  setApplications: StateSetter<AdminApplicationRecord[]>;
  setIsLoadingApplications: StateSetter<boolean>;
  setApplicationsError: StateSetter<string>;
  setAvailableFoodBanks: StateSetter<FoodBankOption[]>;
  setAvailableFoodBanksError: StateSetter<string>;
  setScopedPackageDetails: StateSetter<FoodPackageDetailRecord[]>;
  setScopedPackageError: StateSetter<string>;
  setIsLoadingScopedPackages: StateSetter<boolean>;
  setPackageDetailsById: StateSetter<Record<number, FoodPackageDetailRecord>>;
}) {
  // Centralise token-aware loaders here so the page hook can compose refresh
  // paths without repeating request wiring for every admin data slice.
  const runAuthorizedLoad = useCallback(
    async <Result>(
      {
        request,
        setLoading,
        setError,
        fallbackMessage,
        onSuccess,
        onError,
      }: AuthorizedLoadConfig<Result>,
      isCancelled?: CancelGuard,
    ) => {
      if (!accessToken) {
        return;
      }
      await runManagedRequest({
        request: () => request(accessToken),
        setLoading,
        setError,
        fallbackMessage,
        onSuccess,
        onError,
        isCancelled,
        rethrow: true,
      });
    },
    [accessToken],
  );

  const loadLots = useCallback(
    (isCancelled?: CancelGuard) =>
      loadAdminFoodManagementLots(
        { runAuthorizedLoad, setLotRows, setIsLoadingLots, setLotError },
        isCancelled,
      ),
    [runAuthorizedLoad, setIsLoadingLots, setLotError, setLotRows],
  );

  const loadDonations = useCallback(
    (isCancelled?: CancelGuard) =>
      loadAdminFoodManagementDonations(
        {
          runAuthorizedLoad,
          setDonations,
          setIsLoadingDonations,
          setDonationError,
        },
        isCancelled,
      ),
    [runAuthorizedLoad, setDonationError, setDonations, setIsLoadingDonations],
  );

  const loadApplications = useCallback(
    (isCancelled?: CancelGuard) =>
      loadAdminFoodManagementApplications(
        {
          runAuthorizedLoad,
          setApplications,
          setIsLoadingApplications,
          setApplicationsError,
        },
        isCancelled,
      ),
    [
      runAuthorizedLoad,
      setApplications,
      setApplicationsError,
      setIsLoadingApplications,
    ],
  );

  const loadAvailableFoodBanks = useCallback(
    (isCancelled?: CancelGuard) =>
      loadAdminFoodManagementFoodBanks(
        { setAvailableFoodBanks, setAvailableFoodBanksError },
        isCancelled,
      ),
    [setAvailableFoodBanks, setAvailableFoodBanksError],
  );

  const loadScopedPackages = useCallback(
    (foodBankId: number | null, isCancelled?: CancelGuard) =>
      loadAdminFoodManagementScopedPackages(
        {
          accessToken,
          foodBankId,
          runAuthorizedLoad,
          setScopedPackageDetails,
          setScopedPackageError,
          setIsLoadingScopedPackages,
          setPackageDetailsById,
        },
        isCancelled,
      ),
    [
      accessToken,
      runAuthorizedLoad,
      setIsLoadingScopedPackages,
      setPackageDetailsById,
      setScopedPackageDetails,
      setScopedPackageError,
    ],
  );

  const refreshInventoryAndLots = useCallback(async () => {
    await Promise.all([loadInventory(), loadLots()]);
  }, [loadInventory, loadLots]);

  const refreshLots = useCallback(async () => {
    await loadLots();
  }, [loadLots]);

  const refreshScopedPackages = useCallback(async () => {
    await loadScopedPackages(effectiveFoodBankId);
  }, [effectiveFoodBankId, loadScopedPackages]);

  const reloadAllData = useCallback(async () => {
    await Promise.all([
      loadInventory(),
      loadLots(),
      loadDonations(),
      loadApplications(),
    ]);
  }, [loadApplications, loadDonations, loadInventory, loadLots]);

  return {
    loadLots,
    loadDonations,
    loadApplications,
    loadAvailableFoodBanks,
    loadScopedPackages,
    refreshInventoryAndLots,
    refreshLots,
    refreshScopedPackages,
    reloadAllData,
  };
}

async function loadInitialAdminFoodManagementData({
  setIsLoadingData,
  setLoadError,
  loadInventory,
  loadLots,
  loadDonations,
  loadApplications,
  isCancelled,
}: {
  setIsLoadingData: (value: boolean) => void;
  setLoadError: (value: string) => void;
  loadInventory: DataLoader;
  loadLots: CancellableDataLoader;
  loadDonations: CancellableDataLoader;
  loadApplications: CancellableDataLoader;
  isCancelled: CancelGuard;
}) {
  // First paint should show as much data as possible even if one request
  // fails, so we collect errors instead of aborting the whole batch early.
  setIsLoadingData(true);
  setLoadError("");
  const errors = await Promise.all([
    captureRequestError(() => loadInventory(), "Failed to load inventory."),
    captureRequestError(
      () => loadLots(isCancelled),
      "Failed to load inventory lots.",
    ),
    captureRequestError(
      () => loadDonations(isCancelled),
      "Failed to load donation records.",
    ),
    captureRequestError(
      () => loadApplications(isCancelled),
      "Failed to load redemption code records.",
    ),
  ]);
  if (isCancelled()) {
    return;
  }
  setLoadError(errors.find(Boolean) ?? "");
  setIsLoadingData(false);
}
export function useAdminFoodManagementData({
  adminScope,
  selectedFoodBankId,
}: UseAdminFoodManagementDataArgs) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const inventory = useFoodBankStore((state) => state.inventory);
  const loadInventory = useFoodBankStore((state) => state.loadInventory);
  const deleteItem = useFoodBankStore((state) => state.deleteItem);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lotRows, setLotRows] = useState<InventoryLotRow[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [lotError, setLotError] = useState("");
  const [donations, setDonations] = useState<DonationListRow[]>([]);
  const [isLoadingDonations, setIsLoadingDonations] = useState(false);
  const [donationError, setDonationError] = useState("");
  const [applications, setApplications] = useState<AdminApplicationRecord[]>(
    [],
  );
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState("");
  const [availableFoodBanks, setAvailableFoodBanks] = useState<
    FoodBankOption[]
  >([]);
  const [availableFoodBanksError, setAvailableFoodBanksError] = useState("");
  const [scopedPackageDetails, setScopedPackageDetails] = useState<
    FoodPackageDetailRecord[]
  >([]);
  const [isLoadingScopedPackages, setIsLoadingScopedPackages] = useState(false);
  const [scopedPackageError, setScopedPackageError] = useState("");
  const [packageDetailsById, setPackageDetailsById] = useState<
    Record<number, FoodPackageDetailRecord>
  >({});
  const [isLoadingPackageDetail, setIsLoadingPackageDetail] = useState(false);
  const scopeState = useMemo(
    () => getAdminFoodBankScopeState(adminScope, selectedFoodBankId),
    [adminScope, selectedFoodBankId],
  );
  const foodBankFilterOptions = useMemo(
    () => buildFoodBankFilterOptions(availableFoodBanks),
    [availableFoodBanks],
  );
  const scopedPackageRows = useMemo(
    () => buildScopedPackageRows(scopedPackageDetails),
    [scopedPackageDetails],
  );
  const scopedPackingPackages = useMemo(
    () => buildScopedPackingPackages(scopedPackageDetails),
    [scopedPackageDetails],
  );
  const {
    loadLots,
    loadDonations,
    loadApplications,
    loadAvailableFoodBanks,
    loadScopedPackages,
    refreshInventoryAndLots,
    refreshLots,
    refreshScopedPackages,
    reloadAllData,
  } = useAdminFoodManagementDataLoaders({
    accessToken,
    loadInventory,
    effectiveFoodBankId: scopeState.effectiveFoodBankId,
    setLotRows,
    setIsLoadingLots,
    setLotError,
    setDonations,
    setIsLoadingDonations,
    setDonationError,
    setApplications,
    setIsLoadingApplications,
    setApplicationsError,
    setAvailableFoodBanks,
    setAvailableFoodBanksError,
    setScopedPackageDetails,
    setScopedPackageError,
    setIsLoadingScopedPackages,
    setPackageDetailsById,
  });
  useEffect(() => {
    let cancelled = false;
    void loadInitialAdminFoodManagementData({
      setIsLoadingData,
      setLoadError,
      loadInventory,
      loadLots,
      loadDonations,
      loadApplications,
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [
    loadApplications,
    loadDonations,
    loadInventory,
    loadLots,
    setIsLoadingData,
    setLoadError,
  ]);
  useEffect(() => {
    if (!scopeState.canChooseFoodBank) {
      setAvailableFoodBanks([]);
      setAvailableFoodBanksError("");
      return;
    }
    let cancelled = false;
    void loadAvailableFoodBanks(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [
    loadAvailableFoodBanks,
    scopeState.canChooseFoodBank,
    setAvailableFoodBanks,
    setAvailableFoodBanksError,
  ]);
  useEffect(() => {
    let cancelled = false;
    void loadScopedPackages(scopeState.effectiveFoodBankId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadScopedPackages, scopeState.effectiveFoodBankId]);
  return {
    accessToken,
    deleteItem,
    isLoadingData,
    loadError,
    lotRows,
    isLoadingLots,
    lotError,
    donations,
    isLoadingDonations,
    donationError,
    applications,
    isLoadingApplications,
    applicationsError,
    inventory,
    refreshInventoryAndLots,
    refreshLots,
    reloadAllData,
    availableFoodBanksError,
    effectiveFoodBankId: scopeState.effectiveFoodBankId,
    foodBankFilterOptions,
    isLoadingPackageDetail,
    isLoadingScopedPackages,
    isScopedSelectionRequired: scopeState.isFoodBankSelectionRequired,
    packageDetailsById,
    refreshScopedPackages,
    scopeState,
    scopedPackageDetails,
    scopedPackageError,
    scopedPackageRows,
    scopedPackingPackages,
    setIsLoadingPackageDetail,
    setPackageDetailsById,
  };
}
