import type { Dispatch, SetStateAction } from "react";
import { adminAPI } from "@/shared/lib/api/admin";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import { buildPackageDraft, resolveScopedFoodBankId } from "./builders";
import type {
  PackageDeleteTarget,
  PackageEditorTarget,
  PackageEditorDraft,
  PageFeedback,
  PendingAction,
} from "./adminFoodManagement.types";
import { makeTaskRunner, type BusySetter, type ErrorSetter } from "./runTask";
import { toErrorMessage } from "./rules";
type GetToken = ReturnType<typeof makeTaskRunner>["getToken"];
type RunBusyTask = ReturnType<typeof makeTaskRunner>["runBusyTask"];
type RunPendingTask = ReturnType<typeof makeTaskRunner>["runPendingTask"];
type LoadPackageDetail = (
  packageId: number,
) => Promise<FoodPackageDetailRecord | null>;
type CreateAdminPackageActionsParams = {
  accessToken: string | null;
  sessionExpiredMessage: string;
  adminScopeFoodBankId: number | null;
  selectedFoodBankId: number | null;
  scopedPackageDetails: FoodPackageDetailRecord[];
  packageDetailsById: Record<number, FoodPackageDetailRecord>;
  setPackageDetailsById: Dispatch<
    SetStateAction<Record<number, FoodPackageDetailRecord>>
  >;
  setIsLoadingPackageDetail: BusySetter;
  packageEditorTarget: PackageEditorTarget;
  packageEditorDraft: PackageEditorDraft;
  setPackageEditorError: ErrorSetter;
  setIsPackageEditorSubmitting: BusySetter;
  resetPackageEditor: (
    target?: PackageEditorTarget,
    draft?: PackageEditorDraft,
  ) => void;
  closePackageEditor: () => void;
  deletePackageTarget: PackageDeleteTarget | null;
  setDeletePackageTarget: Dispatch<SetStateAction<PackageDeleteTarget | null>>;
  packPackageId: number | "";
  packQuantity: string;
  setPackPackageId: Dispatch<SetStateAction<number | "">>;
  setPackFeedback: ErrorSetter;
  setIsPacking: BusySetter;
  resetPackingEditor: (
    packageId?: number | "",
    quantity?: string,
    feedback?: string,
  ) => void;
  setPendingAction: Dispatch<SetStateAction<PendingAction>>;
  setPageNotice: (tone: PageFeedback["tone"], message: string) => void;
  refreshInventoryAndLots: () => Promise<unknown>;
  refreshScopedPackages: () => Promise<unknown>;
};
type SetPackageDetailsById = (
  updater: (
    current: Record<number, FoodPackageDetailRecord>,
  ) => Record<number, FoodPackageDetailRecord>,
) => void;
type PageNotice = (tone: PageFeedback["tone"], message: string) => void;
type PackagePayloadRow = { item_id: number; quantity: number };
type PackageEditorSubmission = {
  mode: "create" | "edit";
  packageId: number;
  successMessage: string;
  payload: {
    name: string;
    category: string;
    threshold: number;
    contents: PackagePayloadRow[];
  };
  foodBankId: number | null;
};
function createPackageDetailStateHelpers(
  setPackageDetailsById: SetPackageDetailsById,
) {
  const cachePackageDetail = (detail: FoodPackageDetailRecord) => {
    setPackageDetailsById((current) => ({ ...current, [detail.id]: detail }));
    return detail;
  };
  const clearPackageDetail = (packageId: number) =>
    setPackageDetailsById((current) => {
      if (!(packageId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[packageId];
      return next;
    });
  return { cachePackageDetail, clearPackageDetail };
}
function createPackageDetailLoader({
  scopedPackageDetails,
  packageDetailsById,
  cachePackageDetail,
  getToken,
  setIsLoadingPackageDetail,
  setPageNotice,
}: {
  scopedPackageDetails: FoodPackageDetailRecord[];
  packageDetailsById: Record<number, FoodPackageDetailRecord>;
  cachePackageDetail: (
    detail: FoodPackageDetailRecord,
  ) => FoodPackageDetailRecord;
  getToken: () => string | null;
  setIsLoadingPackageDetail: BusySetter;
  setPageNotice: PageNotice;
}) {
  return async function loadPackageDetail(packageId: number) {
    // Prefer the scoped list and cache before refetching so opening editors does
    // not issue extra requests for package data already on the current screen.
    const scopedDetail = scopedPackageDetails.find(
      (entry) => entry.id === packageId,
    );
    if (scopedDetail) {
      return cachePackageDetail(scopedDetail);
    }
    const cachedDetail = packageDetailsById[packageId];
    if (cachedDetail) {
      return cachedDetail;
    }
    const token = getToken();
    if (!token) {
      return null;
    }
    setIsLoadingPackageDetail(true);
    try {
      return cachePackageDetail(
        await adminAPI.getFoodPackageDetail(packageId, token),
      );
    } catch (error) {
      setPageNotice(
        "error",
        toErrorMessage(error, "Failed to load package details."),
      );
      return null;
    } finally {
      setIsLoadingPackageDetail(false);
    }
  };
}
function buildPackageEditorSubmission({
  adminScopeFoodBankId,
  selectedFoodBankId,
  packageEditorTarget,
  packageEditorDraft,
}: {
  adminScopeFoodBankId: number | null;
  selectedFoodBankId: number | null;
  packageEditorTarget: PackageEditorTarget;
  packageEditorDraft: PackageEditorDraft;
}): { error: string } | PackageEditorSubmission {
  if (!packageEditorTarget) {
    return { error: "Session expired. Please refresh and try again." };
  }
  const name = packageEditorDraft.name.trim();
  const category = packageEditorDraft.category.trim();
  const threshold = Number(packageEditorDraft.threshold);
  const contents = packageEditorDraft.contents.map((row) => ({
    item_id: Number(row.itemId),
    quantity: Number(row.quantity),
  }));
  const foodBankId =
    packageEditorTarget.mode === "create"
      ? resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)
      : null;
  if (!name || !category) {
    return { error: "Please complete all package fields before saving." };
  }
  if (!Number.isInteger(threshold) || threshold < 0) {
    return { error: "Safety threshold must be a non-negative integer." };
  }
  if (
    contents.some((row) => !Number.isInteger(row.item_id) || row.item_id <= 0)
  ) {
    return { error: "Choose an inventory item for every package row." };
  }
  if (
    contents.some((row) => !Number.isInteger(row.quantity) || row.quantity <= 0)
  ) {
    return { error: "Each package row needs a positive quantity." };
  }
  if (packageEditorTarget.mode === "create" && !foodBankId) {
    return { error: "Choose a food bank before creating a package." };
  }
  if (packageEditorTarget.mode === "edit" && !packageEditorTarget.packageId) {
    return { error: "Package not found." };
  }
  return {
    mode: packageEditorTarget.mode,
    packageId: packageEditorTarget.packageId ?? 0,
    successMessage:
      packageEditorTarget.mode === "create"
        ? "Package added."
        : "Package saved.",
    payload: { name, category, threshold, contents },
    foodBankId,
  };
}
function parsePackQuantity(packQuantity: string) {
  const buildError = (error: string): { error: string } => ({ error });
  const quantity = Number(packQuantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return buildError("Quantity must be a positive integer.");
  }
  return { quantity } as { quantity: number };
}
function createPackageEditorOps({
  adminScopeFoodBankId,
  selectedFoodBankId,
  packageEditorTarget,
  packageEditorDraft,
  setPackageEditorError,
  setIsPackageEditorSubmitting,
  resetPackageEditor,
  closePackageEditor,
  setPageNotice,
  refreshInventoryAndLots,
  refreshScopedPackages,
  sessionExpiredMessage,
  runBusyTask,
  loadPackageDetail,
  clearPackageDetail,
}: Pick<
  CreateAdminPackageActionsParams,
  | "adminScopeFoodBankId"
  | "selectedFoodBankId"
  | "packageEditorTarget"
  | "packageEditorDraft"
  | "setPackageEditorError"
  | "setIsPackageEditorSubmitting"
  | "resetPackageEditor"
  | "closePackageEditor"
  | "setPageNotice"
  | "refreshInventoryAndLots"
  | "refreshScopedPackages"
  | "sessionExpiredMessage"
> & {
  runBusyTask: RunBusyTask;
  loadPackageDetail: LoadPackageDetail;
  clearPackageDetail: (packageId: number) => void;
}) {
  const openPackageEditor = async (
    mode: "create" | "edit",
    packageId?: number,
  ) => {
    if (mode === "create") {
      if (!resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)) {
        setPageNotice("error", "Choose a food bank before creating a package.");
        return;
      }
      resetPackageEditor({ mode, packageId: null });
      return;
    }
    if (typeof packageId !== "number") {
      return;
    }
    const detail = await loadPackageDetail(packageId);
    if (detail) {
      resetPackageEditor(
        { mode, packageId: detail.id },
        buildPackageDraft(detail),
      );
    }
  };
  const submitPackageEditor = async () => {
    const submission = buildPackageEditorSubmission({
      adminScopeFoodBankId,
      selectedFoodBankId,
      packageEditorTarget,
      packageEditorDraft,
    });
    if ("error" in submission) {
      setPackageEditorError(
        !packageEditorTarget ? sessionExpiredMessage : submission.error,
      );
      return;
    }
    await runBusyTask({
      setBusy: setIsPackageEditorSubmitting,
      setError: setPackageEditorError,
      fallbackMessage: "Failed to save package.",
      task: async (token) => {
        if (submission.mode === "create") {
          await adminAPI.createFoodPackage(
            { ...submission.payload, food_bank_id: submission.foodBankId! },
            token,
          );
        } else {
          await adminAPI.updateFoodPackage(
            submission.packageId,
            submission.payload,
            token,
          );
          clearPackageDetail(submission.packageId);
        }
        // Saving a package can change both package availability and the
        // inventory-backed lot view, so refresh both slices together.
        await Promise.all([refreshInventoryAndLots(), refreshScopedPackages()]);
        closePackageEditor();
        setPageNotice("success", submission.successMessage);
      },
    });
  };
  return {
    openNewPackageEditor: () => void openPackageEditor("create"),
    openEditPackageEditor: (target: { id: number }) =>
      openPackageEditor("edit", target.id),
    submitPackageEditor,
  };
}
function createPackagePackingOps({
  packPackageId,
  packQuantity,
  setPackPackageId,
  setPackFeedback,
  setIsPacking,
  resetPackingEditor,
  refreshInventoryAndLots,
  refreshScopedPackages,
  loadPackageDetail,
  getToken,
}: Pick<
  CreateAdminPackageActionsParams,
  | "packPackageId"
  | "packQuantity"
  | "setPackPackageId"
  | "setPackFeedback"
  | "setIsPacking"
  | "resetPackingEditor"
  | "refreshInventoryAndLots"
  | "refreshScopedPackages"
> & { loadPackageDetail: LoadPackageDetail; getToken: GetToken }) {
  const openPackingEditor = async (packageId: number) => {
    const detail = await loadPackageDetail(packageId);
    if (detail) {
      resetPackingEditor(detail.id);
    }
  };
  const handlePackPackage = async () => {
    const token = getToken(setPackFeedback);
    if (!token) {
      return;
    }
    if (packPackageId === "") {
      setPackFeedback("Please select a package first.");
      return;
    }
    const quantityResult = parsePackQuantity(packQuantity);
    if ("error" in quantityResult) {
      setPackFeedback(quantityResult.error);
      return;
    }
    setIsPacking(true);
    setPackFeedback("");
    try {
      await adminAPI.packPackage(packPackageId, quantityResult.quantity, token);
      // Packing consumes lot stock and package stock in one operation, so both
      // admin datasets need a follow-up refresh before the modal stays useful.
      await Promise.all([refreshInventoryAndLots(), refreshScopedPackages()]);
      setPackFeedback("Package packed successfully.");
    } catch (error) {
      setPackFeedback(toErrorMessage(error, "Failed to pack package."));
    } finally {
      setIsPacking(false);
    }
  };
  return {
    handlePackingPackageChange: (value: number | "") => {
      setPackPackageId(value);
      if (typeof value === "number") {
        void loadPackageDetail(value);
      }
    },
    openPackTab: (packageId: number) => void openPackingEditor(packageId),
    handlePackPackage,
  };
}
function createPackageDeleteOps({
  deletePackageTarget,
  setDeletePackageTarget,
  setPageNotice,
  refreshScopedPackages,
  clearPackageDetail,
  runPendingTask,
}: Pick<
  CreateAdminPackageActionsParams,
  | "deletePackageTarget"
  | "setDeletePackageTarget"
  | "setPageNotice"
  | "refreshScopedPackages"
> & {
  clearPackageDetail: (packageId: number) => void;
  runPendingTask: RunPendingTask;
}) {
  const submitDeletePackage = async () => {
    const target = deletePackageTarget;
    if (!target) {
      return;
    }
    await runPendingTask({
      action: "package-delete",
      fallbackMessage: "Failed to remove package.",
      task: async (token) => {
        await adminAPI.deleteFoodPackage(target.id, token);
      },
      afterSuccess: async () => {
        clearPackageDetail(target.id);
        await refreshScopedPackages();
      },
      onSuccess: () => {
        setDeletePackageTarget(null);
        setPageNotice(
          "success",
          `${target.name} was removed from the active package list.`,
        );
      },
    });
  };
  return {
    openDeletePackageConfirm: (target: { id: number; name: string }) =>
      setDeletePackageTarget(target),
    submitDeletePackage,
  };
}
export function makePackageOps({
  accessToken,
  sessionExpiredMessage,
  adminScopeFoodBankId,
  selectedFoodBankId,
  scopedPackageDetails,
  packageDetailsById,
  setPackageDetailsById,
  setIsLoadingPackageDetail,
  packageEditorTarget,
  packageEditorDraft,
  setPackageEditorError,
  setIsPackageEditorSubmitting,
  resetPackageEditor,
  closePackageEditor,
  deletePackageTarget,
  setDeletePackageTarget,
  packPackageId,
  packQuantity,
  setPackPackageId,
  setPackFeedback,
  setIsPacking,
  resetPackingEditor,
  setPendingAction,
  setPageNotice,
  refreshInventoryAndLots,
  refreshScopedPackages,
}: CreateAdminPackageActionsParams) {
  const { getToken, runBusyTask, runPendingTask } = makeTaskRunner({
    accessToken,
    sessionExpiredMessage,
    setPageNotice,
    setPendingAction,
  });
  const { cachePackageDetail, clearPackageDetail } =
    createPackageDetailStateHelpers(setPackageDetailsById);
  const loadPackageDetail = createPackageDetailLoader({
    scopedPackageDetails,
    packageDetailsById,
    cachePackageDetail,
    getToken: () => getToken(),
    setIsLoadingPackageDetail,
    setPageNotice,
  });
  return {
    ...createPackageEditorOps({
      adminScopeFoodBankId,
      selectedFoodBankId,
      packageEditorTarget,
      packageEditorDraft,
      setPackageEditorError,
      setIsPackageEditorSubmitting,
      resetPackageEditor,
      closePackageEditor,
      setPageNotice,
      refreshInventoryAndLots,
      refreshScopedPackages,
      sessionExpiredMessage,
      runBusyTask,
      loadPackageDetail,
      clearPackageDetail,
    }),
    ...createPackagePackingOps({
      packPackageId,
      packQuantity,
      setPackPackageId,
      setPackFeedback,
      setIsPacking,
      resetPackingEditor,
      refreshInventoryAndLots,
      refreshScopedPackages,
      loadPackageDetail,
      getToken,
    }),
    ...createPackageDeleteOps({
      deletePackageTarget,
      setDeletePackageTarget,
      setPageNotice,
      refreshScopedPackages,
      clearPackageDetail,
      runPendingTask,
    }),
  };
}
