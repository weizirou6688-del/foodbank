import type { Dispatch, SetStateAction } from "react";
import { adminAPI } from "@/shared/lib/api/admin";
import { buildLotReference } from "./builders";
import type {
  InventoryLotRow,
  LotDeleteTarget,
  LotExpiryTarget,
  LotStatusTarget,
  PageFeedback,
  PendingAction,
} from "./adminFoodManagement.types";
import { makeTaskRunner, type BusySetter } from "./runTask";
import { formatUkDateInput, parseUkDateInput } from "./formatting";
import { toErrorMessage } from "./rules";
type LotBaseTarget = Pick<LotDeleteTarget, "id" | "itemName" | "lotNumber">;
type CreateAdminLotActionsParams = {
  accessToken: string | null;
  sessionExpiredMessage: string;
  lotRows: InventoryLotRow[];
  lotExpiryTarget: LotExpiryTarget | null;
  setLotExpiryTarget: Dispatch<SetStateAction<LotExpiryTarget | null>>;
  setLotExpiryError: Dispatch<SetStateAction<string>>;
  closeLotExpiryEditor: () => void;
  lotStatusTarget: LotStatusTarget | null;
  setLotStatusTarget: Dispatch<SetStateAction<LotStatusTarget | null>>;
  lotDeleteTarget: LotDeleteTarget | null;
  setLotDeleteTarget: Dispatch<SetStateAction<LotDeleteTarget | null>>;
  setIsDeletingLot: BusySetter;
  setPendingAction: Dispatch<SetStateAction<PendingAction>>;
  setPageNotice: (tone: PageFeedback["tone"], message: string) => void;
  refreshInventoryAndLots: () => Promise<unknown>;
  refreshLots: () => Promise<unknown>;
};
const findLotById = (lotRows: InventoryLotRow[], lotId: number) =>
  lotRows.find((entry) => entry.id === lotId) ?? null;
const buildLotTarget = (lot: InventoryLotRow): LotBaseTarget => ({
  id: lot.id,
  itemName: lot.item_name,
  lotNumber: buildLotReference(lot),
});
async function runLotBatchTask({
  getToken,
  lotRows,
  lotIds,
  fallbackMessage,
  emptyMessage,
  successMessage,
  filter,
  task,
  refreshInventoryAndLots,
  setPageNotice,
}: {
  getToken: () => string | null;
  lotRows: InventoryLotRow[];
  lotIds: number[];
  fallbackMessage: string;
  emptyMessage: string;
  successMessage: string;
  filter: (lot: InventoryLotRow) => boolean;
  task: (lot: InventoryLotRow, token: string) => Promise<unknown>;
  refreshInventoryAndLots: () => Promise<unknown>;
  setPageNotice: (tone: PageFeedback["tone"], message: string) => void;
}) {
  const token = getToken();
  if (!token) {
    return;
  }
  // Re-check the selected ids against the latest lot snapshot so batch actions
  // skip rows that have already moved out of the eligible state.
  const targetLots = lotRows.filter(
    (lot) => lotIds.includes(lot.id) && filter(lot),
  );
  if (targetLots.length === 0) {
    setPageNotice("error", emptyMessage);
    return;
  }
  try {
    await Promise.all(targetLots.map((lot) => task(lot, token)));
    await refreshInventoryAndLots();
    setPageNotice("success", successMessage);
  } catch (error) {
    setPageNotice("error", toErrorMessage(error, fallbackMessage));
  }
}
export function makeLotOps({
  accessToken,
  sessionExpiredMessage,
  lotRows,
  lotExpiryTarget,
  setLotExpiryTarget,
  setLotExpiryError,
  closeLotExpiryEditor,
  lotStatusTarget,
  setLotStatusTarget,
  lotDeleteTarget,
  setLotDeleteTarget,
  setIsDeletingLot,
  setPendingAction,
  setPageNotice,
  refreshInventoryAndLots,
  refreshLots,
}: CreateAdminLotActionsParams) {
  const { getToken, runBusyTask, runPendingTask } = makeTaskRunner({
    accessToken,
    sessionExpiredMessage,
    setPageNotice,
    setPendingAction,
  });
  const getLotOrNotify = (lotId: number) => {
    const lot = findLotById(lotRows, lotId);
    if (!lot) {
      setPageNotice("error", "Inventory lot not found.");
    }
    return lot ?? null;
  };
  const submitLotExpiryEdit = async () => {
    if (!lotExpiryTarget) {
      setLotExpiryError(sessionExpiredMessage);
      return;
    }
    const normalizedExpiryDate = parseUkDateInput(lotExpiryTarget.expiryDate);
    if (!normalizedExpiryDate) {
      setLotExpiryError("Expiry date must use DD/MM/YYYY.");
      return;
    }
    await runPendingTask({
      action: "lot-expiry",
      fallbackMessage: "Failed to update expiry date.",
      onError: setLotExpiryError,
      task: async (token) => {
        setLotExpiryError("");
        await adminAPI.adjustInventoryLot(
          lotExpiryTarget.id,
          { expiry_date: normalizedExpiryDate },
          token,
        );
        await refreshLots();
        closeLotExpiryEditor();
        setPageNotice("success", "Lot expiry date updated.");
      },
    });
  };
  return {
    handleLotExpiryEdit: (lotId: number, currentExpiryDate: string) => {
      const lot = getLotOrNotify(lotId);
      if (!lot || !getToken()) {
        return;
      }
      setLotExpiryTarget({
        ...buildLotTarget(lot),
        quantity: lot.quantity,
        expiryDate: formatUkDateInput(currentExpiryDate),
      });
      setLotExpiryError("");
    },
    submitLotExpiryEdit,
    handleLotStatusToggle: (
      lotId: number,
      currentStatus: LotStatusTarget["currentStatus"],
    ) => {
      const lot = getLotOrNotify(lotId);
      if (!lot || !getToken()) {
        return;
      }
      if (currentStatus === "expired") {
        // Expired lots are terminal here; admins need to edit the expiry date so
        // the backend can recalculate the status from the new date.
        setPageNotice(
          "info",
          "Expired lots cannot be reactivated. Please adjust expiry date first.",
        );
        return;
      }
      setLotStatusTarget({ ...buildLotTarget(lot), currentStatus });
    },
    openDeleteLotConfirm: (lotId: number) => {
      const lot = getLotOrNotify(lotId);
      if (lot) {
        setLotDeleteTarget(buildLotTarget(lot));
      }
    },
    submitLotStatusToggle: async () => {
      if (!lotStatusTarget) {
        return;
      }
      const nextStatus =
        lotStatusTarget.currentStatus === "active" ? "wasted" : "active";
      await runPendingTask({
        action: "lot-status",
        fallbackMessage: "Failed to update lot status.",
        task: async (token) => {
          await adminAPI.adjustInventoryLot(
            lotStatusTarget.id,
            { status: nextStatus },
            token,
          );
          await refreshLots();
          setLotStatusTarget(null);
          setPageNotice("success", "Lot status updated.");
        },
      });
    },
    submitDeleteLot: async () => {
      if (!lotDeleteTarget) {
        return;
      }
      await runBusyTask({
        setBusy: setIsDeletingLot,
        fallbackMessage: "Failed to delete lot.",
        task: async (token) => {
          await adminAPI.deleteInventoryLot(lotDeleteTarget.id, token);
          await refreshInventoryAndLots();
          setLotDeleteTarget(null);
          setPageNotice("success", "Lot deleted.");
        },
      });
    },
    submitBatchWasteLots: (lotIds: number[]) =>
      runLotBatchTask({
        getToken,
        lotRows,
        lotIds,
        fallbackMessage: "Failed to update selected lots.",
        emptyMessage: "Select at least one active lot.",
        successMessage: "Selected lots marked as wasted.",
        filter: (lot) => lot.status === "active",
        task: (lot, token) =>
          adminAPI.adjustInventoryLot(lot.id, { status: "wasted" }, token),
        refreshInventoryAndLots,
        setPageNotice,
      }),
    submitBatchDeleteLots: (lotIds: number[]) =>
      runLotBatchTask({
        getToken,
        lotRows,
        lotIds,
        fallbackMessage: "Failed to delete selected lots.",
        emptyMessage: "Select at least one inactive lot to delete.",
        successMessage: "Selected lots deleted.",
        filter: (lot) => lot.status !== "active",
        task: (lot, token) => adminAPI.deleteInventoryLot(lot.id, token),
        refreshInventoryAndLots,
        setPageNotice,
      }),
  };
}
