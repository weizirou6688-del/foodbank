import type { Dispatch, SetStateAction } from "react";
import { adminAPI } from "@/shared/lib/api/admin";
import type { InventoryItem } from "@/shared/types/inventory";
import { resolveScopedFoodBankId } from "./builders";
import type {
  DeleteItemTarget,
  InventoryEditorDraft,
  InventoryStockInDraft,
  ItemEditorTarget,
  PackageRow,
  PageFeedback,
  PendingAction,
} from "./adminFoodManagement.types";
import { makeTaskRunner, type BusySetter, type ErrorSetter } from "./runTask";
import { findPackagesReferencingItem } from "./rules";
import { parseUkDateInput } from "./formatting";
type RunBusyTask = ReturnType<typeof makeTaskRunner>["runBusyTask"];
type RunPendingTask = ReturnType<
  typeof makeTaskRunner
>["runPendingTask"];
type WithScopedInventoryItem = (
  itemId: number,
  onFound: (item: InventoryItem) => void,
) => void;
type CreateAdminInventoryItemActionsParams = {
  accessToken: string | null;
  sessionExpiredMessage: string;
  adminScopeFoodBankId: number | null;
  selectedFoodBankId: number | null;
  scopedInventoryItems: InventoryItem[];
  scopedPackageRows: PackageRow[];
  itemEditorTarget: ItemEditorTarget;
  itemEditorDraft: InventoryEditorDraft;
  setItemEditorError: ErrorSetter;
  setIsItemEditorSubmitting: BusySetter;
  resetItemEditor: (
    target?: ItemEditorTarget,
    item?: InventoryItem | null,
  ) => void;
  closeItemEditor: () => void;
  stockInTarget: InventoryItem | null;
  stockInDraft: InventoryStockInDraft;
  setStockInError: ErrorSetter;
  setIsStockingIn: BusySetter;
  resetStockInEditor: (target?: InventoryItem | null) => void;
  closeStockInEditor: () => void;
  deleteItemTarget: DeleteItemTarget | null;
  setDeleteItemTarget: Dispatch<SetStateAction<DeleteItemTarget | null>>;
  setPendingAction: Dispatch<SetStateAction<PendingAction>>;
  setPageNotice: (tone: PageFeedback["tone"], message: string) => void;
  refreshInventoryAndLots: () => Promise<unknown>;
  deleteItem: (itemId: number) => Promise<unknown>;
};
type ItemEditorSubmission = {
  mode: "create" | "edit";
  itemId: number;
  successMessage: string;
  payload: { name: string; category: string; unit: string; threshold: number };
  foodBankId: number | null;
};
type StockInSubmission = {
  payload: {
    quantity: number;
    reason: "admin manual stock-in";
    expiry_date?: string;
  };
  successMessage: string;
};
function buildItemEditorSubmission({
  adminScopeFoodBankId,
  selectedFoodBankId,
  itemEditorTarget,
  itemEditorDraft,
}: {
  adminScopeFoodBankId: number | null;
  selectedFoodBankId: number | null;
  itemEditorTarget: NonNullable<ItemEditorTarget>;
  itemEditorDraft: InventoryEditorDraft;
}): { error: string } | ItemEditorSubmission {
  const name = itemEditorDraft.name.trim();
  const category = itemEditorDraft.category.trim();
  const unit = itemEditorDraft.unit.trim();
  const threshold = Number(itemEditorDraft.threshold);
  // New items need an explicit food bank assignment, while edits keep the
  // ownership already stored on the backend record.
  const foodBankId =
    itemEditorTarget.mode === "create"
      ? resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)
      : null;
  if (!name || !category || !unit) {
    return { error: "Please complete all item fields before saving." };
  }
  if (!Number.isInteger(threshold) || threshold < 0) {
    return { error: "Safety threshold must be a non-negative integer." };
  }
  if (itemEditorTarget.mode === "create" && !foodBankId) {
    return { error: "Choose a food bank before creating an item." };
  }
  if (itemEditorTarget.mode === "edit" && !itemEditorTarget.itemId) {
    return { error: "Inventory item not found." };
  }
  return {
    mode: itemEditorTarget.mode,
    itemId: itemEditorTarget.itemId ?? 0,
    successMessage:
      itemEditorTarget.mode === "create"
        ? "Inventory item added."
        : "Inventory item saved.",
    payload: { name, category, unit, threshold },
    foodBankId,
  };
}
function buildStockInSubmission({
  stockInTarget,
  stockInDraft,
}: {
  stockInTarget: InventoryItem;
  stockInDraft: InventoryStockInDraft;
}): { error: string } | StockInSubmission {
  const quantity = Number(stockInDraft.quantity);
  const expiryInput = stockInDraft.expiryDate.trim();
  const normalizedExpiryDate = expiryInput
    ? parseUkDateInput(expiryInput)
    : undefined;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive integer." };
  }
  if (expiryInput && !normalizedExpiryDate) {
    return { error: "Expiry date must use DD/MM/YYYY." };
  }
  return {
    payload: {
      quantity,
      reason: "admin manual stock-in",
      expiry_date: normalizedExpiryDate ?? undefined,
    },
    successMessage: `${stockInTarget.name} stock updated.`,
  };
}
type PageNotice = (tone: PageFeedback["tone"], message: string) => void;
function createScopedInventoryItemHelpers({
  scopedInventoryItems,
  setPageNotice,
}: {
  scopedInventoryItems: InventoryItem[];
  setPageNotice: PageNotice;
}) {
  const getScopedInventoryItemOrNotify = (itemId: number) => {
    const item = scopedInventoryItems.find((entry) => entry.id === itemId);
    if (!item) {
      setPageNotice("error", "Inventory item not found.");
    }
    return item ?? null;
  };
  const withScopedInventoryItem = (
    itemId: number,
    onFound: (item: InventoryItem) => void,
  ) => {
    const item = getScopedInventoryItemOrNotify(itemId);
    if (item) {
      onFound(item);
    }
  };
  return { getScopedInventoryItemOrNotify, withScopedInventoryItem };
}
function buildDeleteItemTarget(
  itemId: number,
  itemName: string,
  scopedPackageRows: PackageRow[],
): DeleteItemTarget {
  return {
    id: itemId,
    itemName,
    referencedByPackages: findPackagesReferencingItem(
      scopedPackageRows,
      itemId,
      itemName,
    ),
  };
}
function formatReferencedPackageConflict(target: DeleteItemTarget) {
  const preview = target.referencedByPackages.slice(0, 3).join(", ");
  const suffix = target.referencedByPackages.length > 3 ? ", ..." : "";
  return `Cannot delete this item because it is referenced by: ${preview}${suffix}`;
}
function createDeleteItemOps({
  scopedPackageRows,
  deleteItemTarget,
  setDeleteItemTarget,
  setPageNotice,
  deleteItem,
  runPendingTask,
}: Pick<
  CreateAdminInventoryItemActionsParams,
  | "scopedPackageRows"
  | "deleteItemTarget"
  | "setDeleteItemTarget"
  | "setPageNotice"
  | "deleteItem"
> & { runPendingTask: RunPendingTask }) {
  const submitDeleteItem = async () => {
    const target = deleteItemTarget;
    if (!target) {
      return;
    }
    await runPendingTask({
      action: "delete-item",
      fallbackMessage: "Failed to delete inventory item.",
      task: async () => {
        await deleteItem(target.id);
        setDeleteItemTarget(null);
        setPageNotice("success", `Deleted ${target.itemName}.`);
      },
      onError: (message) => {
        // The API reports a generic conflict here, so reuse the locally derived
        // package references to show admins which packages still depend on it.
        const normalizedMessage = message.toLowerCase();
        const isConflict =
          normalizedMessage.includes("used in packages") ||
          normalizedMessage.includes("conflict");
        setPageNotice(
          "error",
          isConflict && target.referencedByPackages.length > 0
            ? formatReferencedPackageConflict(target)
            : message,
        );
      },
    });
  };
  return {
    handleDeleteItem: (itemId: number, itemName: string) =>
      setDeleteItemTarget(
        buildDeleteItemTarget(itemId, itemName, scopedPackageRows),
      ),
    submitDeleteItem,
  };
}
function createItemEditorOps({
  adminScopeFoodBankId,
  selectedFoodBankId,
  itemEditorTarget,
  itemEditorDraft,
  setItemEditorError,
  setIsItemEditorSubmitting,
  resetItemEditor,
  closeItemEditor,
  setPageNotice,
  refreshInventoryAndLots,
  sessionExpiredMessage,
  runBusyTask,
  withScopedInventoryItem,
}: Pick<
  CreateAdminInventoryItemActionsParams,
  | "adminScopeFoodBankId"
  | "selectedFoodBankId"
  | "itemEditorTarget"
  | "itemEditorDraft"
  | "setItemEditorError"
  | "setIsItemEditorSubmitting"
  | "resetItemEditor"
  | "closeItemEditor"
  | "setPageNotice"
  | "refreshInventoryAndLots"
  | "sessionExpiredMessage"
> & {
  runBusyTask: RunBusyTask;
  withScopedInventoryItem: WithScopedInventoryItem;
}) {
  const openItemEditor = (mode: "create" | "edit", itemId?: number) => {
    if (mode === "create") {
      if (!resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)) {
        setPageNotice("error", "Choose a food bank before creating an item.");
        return;
      }
      resetItemEditor({ mode, itemId: null });
      return;
    }
    if (typeof itemId === "number") {
      withScopedInventoryItem(itemId, (item) =>
        resetItemEditor({ mode, itemId: item.id }, item),
      );
    }
  };
  const submitItemEditor = async () => {
    if (!itemEditorTarget) {
      setItemEditorError(sessionExpiredMessage);
      return;
    }
    const submission = buildItemEditorSubmission({
      adminScopeFoodBankId,
      selectedFoodBankId,
      itemEditorTarget,
      itemEditorDraft,
    });
    if ("error" in submission) {
      setItemEditorError(submission.error);
      return;
    }
    await runBusyTask({
      setBusy: setIsItemEditorSubmitting,
      setError: setItemEditorError,
      fallbackMessage: "Failed to save inventory item.",
      task: async (token) => {
        if (submission.mode === "create") {
          await adminAPI.createInventoryItem(
            {
              ...submission.payload,
              initial_stock: 0,
              food_bank_id: submission.foodBankId!,
            },
            token,
          );
        } else {
          await adminAPI.updateInventoryItem(
            submission.itemId,
            submission.payload,
            token,
          );
        }
        await refreshInventoryAndLots();
        closeItemEditor();
        setPageNotice("success", submission.successMessage);
      },
    });
  };
  return {
    openNewItemEditor: () => openItemEditor("create"),
    openEditItemEditor: ({ id }: { id: number }) => openItemEditor("edit", id),
    submitItemEditor,
  };
}
function createItemStockOps({
  stockInTarget,
  stockInDraft,
  setStockInError,
  setIsStockingIn,
  resetStockInEditor,
  closeStockInEditor,
  setPageNotice,
  refreshInventoryAndLots,
  sessionExpiredMessage,
  runBusyTask,
  withScopedInventoryItem,
}: Pick<
  CreateAdminInventoryItemActionsParams,
  | "stockInTarget"
  | "stockInDraft"
  | "setStockInError"
  | "setIsStockingIn"
  | "resetStockInEditor"
  | "closeStockInEditor"
  | "setPageNotice"
  | "refreshInventoryAndLots"
  | "sessionExpiredMessage"
> & {
  runBusyTask: RunBusyTask;
  withScopedInventoryItem: WithScopedInventoryItem;
}) {
  const submitStockIn = async () => {
    if (!stockInTarget) {
      setStockInError(sessionExpiredMessage);
      return;
    }
    const submission = buildStockInSubmission({ stockInTarget, stockInDraft });
    if ("error" in submission) {
      setStockInError(submission.error);
      return;
    }
    await runBusyTask({
      setBusy: setIsStockingIn,
      setError: setStockInError,
      fallbackMessage: "Failed to stock in inventory item.",
      task: async (token) => {
        await adminAPI.stockInInventoryItem(
          stockInTarget.id,
          submission.payload,
          token,
        );
        await refreshInventoryAndLots();
        closeStockInEditor();
        setPageNotice("success", submission.successMessage);
      },
    });
  };
  return {
    openItemAdjustModal: (itemId: number) =>
      withScopedInventoryItem(itemId, resetStockInEditor),
    submitStockIn,
  };
}
export function makeItemOps({
  accessToken,
  sessionExpiredMessage,
  adminScopeFoodBankId,
  selectedFoodBankId,
  scopedInventoryItems,
  scopedPackageRows,
  itemEditorTarget,
  itemEditorDraft,
  setItemEditorError,
  setIsItemEditorSubmitting,
  resetItemEditor,
  closeItemEditor,
  stockInTarget,
  stockInDraft,
  setStockInError,
  setIsStockingIn,
  resetStockInEditor,
  closeStockInEditor,
  deleteItemTarget,
  setDeleteItemTarget,
  setPendingAction,
  setPageNotice,
  refreshInventoryAndLots,
  deleteItem,
}: CreateAdminInventoryItemActionsParams) {
  const { runBusyTask, runPendingTask } = makeTaskRunner({
    accessToken,
    sessionExpiredMessage,
    setPageNotice,
    setPendingAction,
  });
  const { withScopedInventoryItem } = createScopedInventoryItemHelpers({
    scopedInventoryItems,
    setPageNotice,
  });
  return {
    ...createItemEditorOps({
      adminScopeFoodBankId,
      selectedFoodBankId,
      itemEditorTarget,
      itemEditorDraft,
      setItemEditorError,
      setIsItemEditorSubmitting,
      resetItemEditor,
      closeItemEditor,
      setPageNotice,
      refreshInventoryAndLots,
      sessionExpiredMessage,
      runBusyTask,
      withScopedInventoryItem,
    }),
    ...createItemStockOps({
      stockInTarget,
      stockInDraft,
      setStockInError,
      setIsStockingIn,
      resetStockInEditor,
      closeStockInEditor,
      setPageNotice,
      refreshInventoryAndLots,
      sessionExpiredMessage,
      runBusyTask,
      withScopedInventoryItem,
    }),
    ...createDeleteItemOps({
      scopedPackageRows,
      deleteItemTarget,
      setDeleteItemTarget,
      setPageNotice,
      deleteItem,
      runPendingTask,
    }),
  };
}
