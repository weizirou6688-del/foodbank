import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import type { DonationListRow } from "@/shared/types/donations";
import type { InventoryItem } from "@/shared/types/inventory";
import {
  appendListItem,
  assignField,
  createDonationDraftItem,
  createEmptyDonationDraft,
  createEmptyInventoryDraft,
  createEmptyPackageDraft,
  createEmptyStockInDraft,
  createPackageDraftRow,
  removeKeyedListItem,
  updateKeyedListField,
} from "./builders";
import type {
  ActiveItemEditorTarget,
  ActivePackageEditorTarget,
  CodeVerifyResult,
  CodeVoidTarget,
  DeleteItemTarget,
  DonationDeleteTarget,
  DonationDonorType,
  DonationEditorDraft,
  DonationEditorItemDraft,
  DonationEditorTarget,
  DonationStatusFilter,
  InventoryEditorDraft,
  InventoryStockInDraft,
  ItemEditorTarget,
  LotDeleteTarget,
  LotExpiryTarget,
  LotStatusTarget,
  PageFeedback,
  PackageEditorDraft,
  PackageEditorRowDraft,
  PackageEditorTarget,
  PackageDeleteTarget,
  PendingAction,
} from "./adminFoodManagement.types";
type StateSetter<T> = Dispatch<SetStateAction<T>>;

// Most admin editors are list-based forms, so these helpers keep field updates
// and row mutations consistent across items, packages, and donations.
const createDraftFieldUpdater =
  <T extends object>(setDraft: StateSetter<T>) =>
  <TField extends keyof T>(field: TField, value: T[TField]) => {
    setDraft((current) => assignField(current, field, value));
  };

const createDraftCollectionFieldUpdater =
  <
    TDraft extends object,
    TCollectionKey extends keyof TDraft,
    TRow extends { key: string },
  >(
    setDraft: StateSetter<TDraft>,
    collectionKey: TCollectionKey,
  ) =>
  <TField extends Exclude<keyof TRow, "key">>(
    rowKey: string,
    field: TField,
    value: TRow[TField],
  ) => {
    setDraft(
      (current) =>
        ({
          ...current,
          [collectionKey]: updateKeyedListField(
            current[collectionKey] as TRow[],
            rowKey,
            field,
            value,
          ),
        }) as TDraft,
    );
  };

const createDraftCollectionAppender =
  <TDraft extends object, TCollectionKey extends keyof TDraft, TRow>(
    setDraft: StateSetter<TDraft>,
    collectionKey: TCollectionKey,
    createRow: () => TRow,
  ) =>
  () => {
    setDraft(
      (current) =>
        ({
          ...current,
          [collectionKey]: appendListItem(
            current[collectionKey] as TRow[],
            createRow(),
          ),
        }) as TDraft,
    );
  };

const createDraftCollectionRemover =
  <
    TDraft extends object,
    TCollectionKey extends keyof TDraft,
    TRow extends { key: string },
  >(
    setDraft: StateSetter<TDraft>,
    collectionKey: TCollectionKey,
  ) =>
  (rowKey: string) => {
    setDraft(
      (current) =>
        ({
          ...current,
          [collectionKey]: removeKeyedListItem(
            current[collectionKey] as TRow[],
            rowKey,
          ),
        }) as TDraft,
    );
  };

function useDismissableTargetState<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, setTarget, close: () => setTarget(null) };
}

function useTargetWithErrorState<T>() {
  const targetState = useDismissableTargetState<T>();
  const [error, setError] = useState("");
  return {
    ...targetState,
    error,
    setError,
    close: () => {
      targetState.close();
      setError("");
    },
  };
}

function useResettableEditorState<TTarget, TDraft>(
  createClosedDraft: () => TDraft,
) {
  const targetState = useDismissableTargetState<TTarget>();
  const [draft, setDraft] = useState<TDraft>(createClosedDraft);
  const [error, setError] = useState("");
  const reset = (
    target: TTarget | null = null,
    nextDraft = createClosedDraft(),
  ) => {
    targetState.setTarget(target);
    setDraft(nextDraft);
    setError("");
  };
  return {
    ...targetState,
    draft,
    setDraft,
    error,
    setError,
    reset,
    close: () => reset(),
  };
}

function useResettableValueState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  return {
    value,
    setValue,
    reset: (nextValue = initialValue) => setValue(nextValue),
  };
}

function useInventoryItemEditorUiState() {
  const itemEditorState = useResettableEditorState<
    ActiveItemEditorTarget,
    InventoryEditorDraft
  >(() => createEmptyInventoryDraft());
  const [isItemEditorSubmitting, setIsItemEditorSubmitting] = useState(false);
  const updateItemDraftField = createDraftFieldUpdater(
    itemEditorState.setDraft,
  );
  const resetItemEditor = (
    target: ItemEditorTarget = null,
    item?: InventoryItem | null,
  ) => itemEditorState.reset(target, createEmptyInventoryDraft(item));
  return {
    itemEditorTarget: itemEditorState.target,
    itemEditorDraft: itemEditorState.draft,
    itemEditorError: itemEditorState.error,
    setItemEditorError: itemEditorState.setError,
    isItemEditorSubmitting,
    setIsItemEditorSubmitting,
    resetItemEditor,
    closeItemEditor: itemEditorState.close,
    updateItemDraftField,
  };
}

function useInventoryStockInUiState() {
  const stockInState = useResettableEditorState<
    InventoryItem,
    InventoryStockInDraft
  >(createEmptyStockInDraft);
  const [isStockingIn, setIsStockingIn] = useState(false);
  const updateStockInDraftField = createDraftFieldUpdater(
    stockInState.setDraft,
  );
  const resetStockInEditor = (target: InventoryItem | null = null) =>
    stockInState.reset(target, createEmptyStockInDraft());
  return {
    stockInTarget: stockInState.target,
    stockInDraft: stockInState.draft,
    stockInError: stockInState.error,
    setStockInError: stockInState.setError,
    isStockingIn,
    setIsStockingIn,
    resetStockInEditor,
    closeStockInEditor: stockInState.close,
    updateStockInDraftField,
  };
}

function useInventoryPackageEditorUiState() {
  const packageEditorState = useResettableEditorState<
    ActivePackageEditorTarget,
    PackageEditorDraft
  >(createEmptyPackageDraft);
  const [isPackageEditorSubmitting, setIsPackageEditorSubmitting] =
    useState(false);
  const updatePackageDraftValue = createDraftFieldUpdater(
    packageEditorState.setDraft,
  );
  const updatePackageDraftRow = createDraftCollectionFieldUpdater<
    PackageEditorDraft,
    "contents",
    PackageEditorRowDraft
  >(packageEditorState.setDraft, "contents");
  const addPackageDraftRow = createDraftCollectionAppender<
    PackageEditorDraft,
    "contents",
    PackageEditorRowDraft
  >(packageEditorState.setDraft, "contents", createPackageDraftRow);
  const removePackageDraftRow = createDraftCollectionRemover<
    PackageEditorDraft,
    "contents",
    PackageEditorRowDraft
  >(packageEditorState.setDraft, "contents");
  const resetPackageEditor = (
    target: PackageEditorTarget = null,
    draft = createEmptyPackageDraft(),
  ) => packageEditorState.reset(target, draft);
  const updatePackageDraftField = (
    field: keyof Omit<PackageEditorDraft, "contents">,
    value: string,
  ) => updatePackageDraftValue(field, value);
  return {
    packageEditorTarget: packageEditorState.target,
    packageEditorDraft: packageEditorState.draft,
    packageEditorError: packageEditorState.error,
    setPackageEditorError: packageEditorState.setError,
    isPackageEditorSubmitting,
    setIsPackageEditorSubmitting,
    resetPackageEditor,
    closePackageEditor: packageEditorState.close,
    updatePackageDraftField,
    updatePackageDraftRow,
    addPackageDraftRow,
    removePackageDraftRow,
  };
}

function useAdminFoodManagementInventoryUiState(
  initialFoodBankId: number | null,
) {
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedFoodBankId, setSelectedFoodBankId] = useState<number | null>(
    initialFoodBankId,
  );
  const itemEditorState = useInventoryItemEditorUiState();
  const stockInState = useInventoryStockInUiState();
  const packageEditorState = useInventoryPackageEditorUiState();
  const packageIdState = useResettableValueState<number | "">("");
  const quantityState = useResettableValueState("1");
  const feedbackState = useResettableValueState("");
  const [isPacking, setIsPacking] = useState(false);
  const resetPackingEditor = (
    packageId: number | "" = "",
    quantity = "1",
    feedback = "",
  ) => {
    packageIdState.reset(packageId);
    quantityState.reset(quantity);
    feedbackState.reset(feedback);
  };
  const lotExpiryState = useTargetWithErrorState<LotExpiryTarget>();
  const lotStatusState = useDismissableTargetState<LotStatusTarget>();
  const lotDeleteState = useDismissableTargetState<LotDeleteTarget>();
  const [isDeletingLot, setIsDeletingLot] = useState(false);
  const deleteItemState = useDismissableTargetState<DeleteItemTarget>();
  const deletePackageState = useDismissableTargetState<PackageDeleteTarget>();
  return {
    inventorySearch,
    setInventorySearch,
    selectedFoodBankId,
    setSelectedFoodBankId,
    ...itemEditorState,
    ...stockInState,
    ...packageEditorState,
    packPackageId: packageIdState.value,
    setPackPackageId: packageIdState.setValue,
    packQuantity: quantityState.value,
    setPackQuantity: quantityState.setValue,
    packFeedback: feedbackState.value,
    setPackFeedback: feedbackState.setValue,
    isPacking,
    setIsPacking,
    resetPackingEditor,
    closePackingEditor: () => resetPackingEditor(),
    lotExpiryTarget: lotExpiryState.target,
    setLotExpiryTarget: lotExpiryState.setTarget,
    lotExpiryError: lotExpiryState.error,
    setLotExpiryError: lotExpiryState.setError,
    closeLotExpiryEditor: lotExpiryState.close,
    lotStatusTarget: lotStatusState.target,
    setLotStatusTarget: lotStatusState.setTarget,
    lotDeleteTarget: lotDeleteState.target,
    setLotDeleteTarget: lotDeleteState.setTarget,
    isDeletingLot,
    setIsDeletingLot,
    deleteItemTarget: deleteItemState.target,
    setDeleteItemTarget: deleteItemState.setTarget,
    deletePackageTarget: deletePackageState.target,
    setDeletePackageTarget: deletePackageState.setTarget,
  };
}
function useAdminFoodManagementFeedbackUiState() {
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [toastMessage, setToastMessage] = useState("Saved successfully.");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const setPageNotice = (tone: PageFeedback["tone"], message: string) =>
    setPageFeedback({ tone, message });
  const clearPageFeedback = () => setPageFeedback(null);
  const isActionBusy = (action: PendingAction) => pendingAction === action;
  useEffect(() => {
    if (pageFeedback?.tone !== "success") {
      return;
    }
    setToastMessage(pageFeedback.message);
    setIsToastVisible(true);
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
      setPageFeedback((current) =>
        current?.tone === "success" ? null : current,
      );
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [pageFeedback]);
  return {
    pageFeedback,
    setPageNotice,
    clearPageFeedback,
    pendingAction,
    setPendingAction,
    isActionBusy,
    toastMessage,
    isToastVisible,
  };
}
function useAdminFoodManagementCodeUiState() {
  const [codeSearch, setCodeSearch] = useState("");
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [isCodeVerifyOpen, setIsCodeVerifyOpen] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState("");
  const [codeVerifyResult, setCodeVerifyResult] =
    useState<CodeVerifyResult | null>(null);
  const codeViewState = useDismissableTargetState<AdminApplicationRecord>();
  const voidCodeState = useDismissableTargetState<CodeVoidTarget>();
  const closeCodeVerifyModal = () => {
    setIsCodeVerifyOpen(false);
    setVerifyCodeInput("");
    setCodeVerifyResult(null);
  };
  return {
    codeSearch,
    setCodeSearch,
    selectedCodeIds,
    setSelectedCodeIds,
    isCodeVerifyOpen,
    setIsCodeVerifyOpen,
    verifyCodeInput,
    setVerifyCodeInput,
    codeVerifyResult,
    setCodeVerifyResult,
    codeViewTarget: codeViewState.target,
    setCodeViewTarget: codeViewState.setTarget,
    voidCodeTarget: voidCodeState.target,
    setVoidCodeTarget: voidCodeState.setTarget,
    closeCodeVerifyModal,
  };
}
function useAdminFoodManagementDonationUiState() {
  const [donationSearch, setDonationSearch] = useState("");
  const [donationDonorTypeFilter, setDonationDonorTypeFilter] = useState<
    DonationDonorType | "all"
  >("all");
  const [donationStatusFilter, setDonationStatusFilter] =
    useState<DonationStatusFilter>("all");
  const [selectedDonationIds, setSelectedDonationIds] = useState<string[]>([]);
  const donationEditorState = useResettableEditorState<
    DonationEditorTarget,
    DonationEditorDraft
  >(createEmptyDonationDraft);
  const donationViewState = useDismissableTargetState<DonationListRow>();
  const deleteDonationState = useDismissableTargetState<DonationDeleteTarget>();
  const updateDonationDraftValue = createDraftFieldUpdater(
    donationEditorState.setDraft,
  );
  const updateDonationDraftItem = createDraftCollectionFieldUpdater<
    DonationEditorDraft,
    "items",
    DonationEditorItemDraft
  >(donationEditorState.setDraft, "items");
  const addDonationDraftItem = createDraftCollectionAppender<
    DonationEditorDraft,
    "items",
    DonationEditorItemDraft
  >(donationEditorState.setDraft, "items", createDonationDraftItem);
  const removeDonationDraftItem = createDraftCollectionRemover<
    DonationEditorDraft,
    "items",
    DonationEditorItemDraft
  >(donationEditorState.setDraft, "items");
  const resetDonationEditor = (
    target: DonationEditorTarget | null = null,
    draft = createEmptyDonationDraft(),
  ) => donationEditorState.reset(target, draft);
  const updateDonationDraftField = (
    field: keyof Omit<DonationEditorDraft, "items">,
    value: string,
  ) => updateDonationDraftValue(field, value);
  return {
    donationSearch,
    setDonationSearch,
    donationDonorTypeFilter,
    setDonationDonorTypeFilter,
    donationStatusFilter,
    setDonationStatusFilter,
    selectedDonationIds,
    setSelectedDonationIds,
    donationEditorTarget: donationEditorState.target,
    donationDraft: donationEditorState.draft,
    donationEditorError: donationEditorState.error,
    setDonationEditorError: donationEditorState.setError,
    donationViewTarget: donationViewState.target,
    setDonationViewTarget: donationViewState.setTarget,
    deleteDonationTarget: deleteDonationState.target,
    setDeleteDonationTarget: deleteDonationState.setTarget,
    resetDonationEditor,
    closeDonationEditor: donationEditorState.close,
    updateDonationDraftField,
    updateDonationDraftItem,
    addDonationDraftItem,
    removeDonationDraftItem,
  };
}
export function useAdminFoodManagementUiState(
  initialFoodBankId: number | null,
) {
  // This hook is the single place that knows which inline editor, confirm
  // modal, or toast is currently active in the workspace.
  const inventoryState =
    useAdminFoodManagementInventoryUiState(initialFoodBankId);
  const donationState = useAdminFoodManagementDonationUiState();
  const codeState = useAdminFoodManagementCodeUiState();
  const feedbackState = useAdminFoodManagementFeedbackUiState();
  const isAnyInlineEditorOpen = [
    inventoryState.itemEditorTarget !== null,
    inventoryState.stockInTarget !== null,
    inventoryState.packageEditorTarget !== null,
    inventoryState.packPackageId !== "",
    inventoryState.lotExpiryTarget !== null,
    inventoryState.lotStatusTarget !== null,
    inventoryState.lotDeleteTarget !== null,
    inventoryState.deleteItemTarget !== null,
    inventoryState.deletePackageTarget !== null,
    donationState.donationEditorTarget !== null,
    donationState.donationViewTarget !== null,
    donationState.deleteDonationTarget !== null,
    codeState.isCodeVerifyOpen,
    codeState.codeViewTarget !== null,
    codeState.voidCodeTarget !== null,
  ].some(Boolean);
  const isInlineCloseDisabled = [
    inventoryState.isItemEditorSubmitting,
    inventoryState.isStockingIn,
    inventoryState.isPackageEditorSubmitting,
    inventoryState.isPacking,
    inventoryState.isDeletingLot,
    feedbackState.isActionBusy("lot-expiry"),
    feedbackState.isActionBusy("lot-status"),
    feedbackState.isActionBusy("delete-item"),
    feedbackState.isActionBusy("package-delete"),
    feedbackState.isActionBusy("donation-save"),
    feedbackState.isActionBusy("donation-delete"),
    feedbackState.isActionBusy("code-check"),
    feedbackState.isActionBusy("code-redeem"),
    feedbackState.isActionBusy("code-void"),
  ].some(Boolean);
  const closeAllInlineEditors = () => {
    if (isInlineCloseDisabled) {
      return;
    }
    inventoryState.closeItemEditor();
    inventoryState.closeStockInEditor();
    inventoryState.closePackageEditor();
    inventoryState.closePackingEditor();
    inventoryState.closeLotExpiryEditor();
    inventoryState.setLotStatusTarget(null);
    inventoryState.setLotDeleteTarget(null);
    inventoryState.setDeleteItemTarget(null);
    inventoryState.setDeletePackageTarget(null);
    donationState.closeDonationEditor();
    donationState.setDonationViewTarget(null);
    donationState.setDeleteDonationTarget(null);
    codeState.closeCodeVerifyModal();
    codeState.setCodeViewTarget(null);
    codeState.setVoidCodeTarget(null);
  };
  useEffect(() => {
    document.body.classList.toggle("modal-open", isAnyInlineEditorOpen);
    return () => document.body.classList.remove("modal-open");
  }, [isAnyInlineEditorOpen]);
  return {
    ...inventoryState,
    ...feedbackState,
    ...donationState,
    ...codeState,
    isAnyInlineEditorOpen,
    closeAllInlineEditors,
  };
}
