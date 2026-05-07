import { useEffect, useMemo } from "react";
import type { AdminScopeMeta } from "@/shared/lib/adminScope";
import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import type { DonationListRow } from "@/shared/types/donations";
import type { InventoryItem } from "@/shared/types/inventory";
import type { usePublicImpactMetrics } from "@/shared/lib/usePublicImpactMetrics";
import { buildScopedInventoryItems, buildScopedSectionBindings } from "./builders";
import { filterApplications, filterDonations } from "./rules";
import { makeItemOps } from "./itemOps";
import { makeLotOps } from "./lotOps";
import { makePackageOps } from "./packageOps";
import type {
  DonationDonorType,
  DonationStatusFilter,
  PackingStockCheckRow,
} from "./adminFoodManagement.types";
import type {
  AdminFoodManagementChromeBindings,
  AdminFoodManagementDetailModalProps,
  AdminFoodManagementEditorModalProps,
  AdminFoodManagementSectionsModel,
  AdminFoodManagementSectionsProps,
} from "./adminFoodManagement.sections.shared";
import {
  donorEmailPattern,
  inventoryEditorCategories,
  packageEditorCategories,
  sessionExpiredMessage,
} from "./adminFoodManagement.sections.shared";
import { useAdminDonationCodeActions } from "./useAdminDonationCodeActions";
import type { useAdminFoodManagementData } from "./useAdminFoodManagementData";
import type { useAdminFoodManagementUiState } from "./useAdminFoodManagementUiState";

type AdminFoodManagementDataState = ReturnType<typeof useAdminFoodManagementData>;
type AdminFoodManagementUiState = ReturnType<
  typeof useAdminFoodManagementUiState
>;
type AdminDonationCodeActions = ReturnType<typeof useAdminDonationCodeActions>;
type PublicImpactMetricsState = Pick<
  ReturnType<typeof usePublicImpactMetrics>,
  "impactMetrics" | "status"
>;

type CreateInventoryActionsContext = {
  adminScopeFoodBankId: number | null;
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  derivedState: AdminFoodManagementDerivedState;
};

type AdminFoodManagementInventoryActions = ReturnType<
  typeof createAdminFoodManagementInventoryActions
>;

type AdminFoodManagementDerivedState = ReturnType<
  typeof useAdminFoodManagementSectionDerivations
>;

const buildItemOptions = (inventory: InventoryItem[]) =>
  Array.from(
    new Set(inventory.map((item) => item.name.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

const buildPackingStockCheckRows = ({
  packPackageId,
  packageDetailsById,
  scopedInventoryItems,
}: {
  packPackageId: number | "";
  packageDetailsById: Record<number, FoodPackageDetailRecord>;
  scopedInventoryItems: InventoryItem[];
}): PackingStockCheckRow[] => {
  const detail = packPackageId ? packageDetailsById[packPackageId] : undefined;
  if (!detail) {
    return [];
  }
  return detail.package_items.map((item) => {
    const inventoryItem = scopedInventoryItems.find(
      (entry) => entry.id === item.inventory_item_id,
    );
    return {
      itemId: item.inventory_item_id,
      name: item.inventory_item_name,
      requiredQuantity: item.quantity,
      availableQuantity: inventoryItem?.stock ?? 0,
      unit: inventoryItem?.unit ?? item.inventory_item_unit ?? "units",
    };
  });
};

const buildSelectedIdSet = (selectedIds: string[]) => new Set(selectedIds);

function useAdminFoodManagementSectionDerivations({
  dataState,
  uiState,
}: {
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
}) {
  // Derive filtered tables and scoped options in one memo so the rendering
  // layer receives a stable, already-scoped view model.
  const {
    applications,
    availableFoodBanksError,
    donations,
    foodBankFilterOptions,
    inventory,
    packageDetailsById,
    scopeState,
    scopedPackageError,
  } = dataState;
  const {
    codeSearch,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    packPackageId,
    selectedCodeIds,
    selectedDonationIds,
    selectedFoodBankId,
    setSelectedFoodBankId,
  } = uiState;

  return useMemo(() => {
    const scopedInventoryItems = buildScopedInventoryItems(
      inventory,
      scopeState,
    );
    const sectionScopeProps = buildScopedSectionBindings({
      scopeState,
      foodBankFilterOptions,
      selectedFoodBankId,
      setSelectedFoodBankId,
      availableFoodBanksError,
      scopedPackageError,
    });
    const itemOptions = buildItemOptions(inventory);
    const filteredDonations = filterDonations(
      donations,
      donationSearch,
      donationDonorTypeFilter,
      donationStatusFilter,
    );
    const filteredApplications = filterApplications(applications, codeSearch);
    const selectedDonationIdSet = buildSelectedIdSet(selectedDonationIds);
    const selectedCodeIdSet = buildSelectedIdSet(selectedCodeIds);
    const packingStockCheckRows = buildPackingStockCheckRows({
      packPackageId,
      packageDetailsById,
      scopedInventoryItems,
    });
    return {
      filteredApplications,
      filteredDonations,
      itemOptions,
      packingStockCheckRows,
      scopedInventoryItems,
      sectionScopeProps,
      selectedCodeIdSet,
      selectedDonationIdSet,
    };
  }, [
    applications,
    availableFoodBanksError,
    codeSearch,
    donations,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    foodBankFilterOptions,
    inventory,
    packPackageId,
    packageDetailsById,
    scopeState,
    scopedPackageError,
    selectedCodeIds,
    selectedDonationIds,
    selectedFoodBankId,
    setSelectedFoodBankId,
  ]);
}

function useResetSelectionEffects({
  donations,
  donationSearch,
  donationDonorTypeFilter,
  donationStatusFilter,
  setSelectedDonationIds,
  applications,
  codeSearch,
  setSelectedCodeIds,
}: {
  donations: DonationListRow[];
  donationSearch: string;
  donationDonorTypeFilter: DonationDonorType | "all";
  donationStatusFilter: DonationStatusFilter;
  setSelectedDonationIds: (value: string[]) => void;
  applications: AdminApplicationRecord[];
  codeSearch: string;
  setSelectedCodeIds: (value: string[]) => void;
}) {
  useEffect(() => {
    setSelectedDonationIds([]);
  }, [
    donations,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    setSelectedDonationIds,
  ]);

  useEffect(() => {
    setSelectedCodeIds([]);
  }, [applications, codeSearch, setSelectedCodeIds]);
}

function useRefreshImpactMetricsEffect({
  applications,
  donations,
  isLoadingApplications,
  isLoadingDonations,
  refreshImpactMetrics,
}: {
  applications: AdminApplicationRecord[];
  donations: DonationListRow[];
  isLoadingApplications: boolean;
  isLoadingDonations: boolean;
  refreshImpactMetrics: ReturnType<
    typeof usePublicImpactMetrics
  >["refreshImpactMetrics"];
}) {
  useEffect(() => {
    if (isLoadingDonations || isLoadingApplications) {
      return;
    }
    void refreshImpactMetrics({ silent: true });
  }, [
    applications,
    donations,
    isLoadingApplications,
    isLoadingDonations,
    refreshImpactMetrics,
  ]);
}

function useFoodBankScopeEffects({
  adminScopeFoodBankId,
  hasFixedFoodBank,
  canChooseFoodBank,
  isFoodBankSelectionRequired,
  selectedFoodBankId,
  setSelectedFoodBankId,
  setInventorySearch,
}: {
  adminScopeFoodBankId: number | null;
  hasFixedFoodBank: boolean;
  canChooseFoodBank: boolean;
  isFoodBankSelectionRequired: boolean;
  selectedFoodBankId: number | null;
  setSelectedFoodBankId: (value: number | null) => void;
  setInventorySearch: (value: string) => void;
}) {
  useEffect(() => {
    if (hasFixedFoodBank) {
      setSelectedFoodBankId(adminScopeFoodBankId);
    } else if (!canChooseFoodBank) {
      setSelectedFoodBankId(null);
    }
  }, [
    adminScopeFoodBankId,
    canChooseFoodBank,
    hasFixedFoodBank,
    setSelectedFoodBankId,
  ]);

  useEffect(() => {
    if (isFoodBankSelectionRequired) {
      setInventorySearch("");
    }
  }, [isFoodBankSelectionRequired, selectedFoodBankId, setInventorySearch]);
}

function useAdminFoodManagementSectionEffects({
  adminScope,
  dataState,
  uiState,
  refreshImpactMetrics,
}: {
  adminScope: AdminScopeMeta;
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  refreshImpactMetrics: ReturnType<
    typeof usePublicImpactMetrics
  >["refreshImpactMetrics"];
}) {
  const {
    applications,
    donations,
    isLoadingApplications,
    isLoadingDonations,
    scopeState,
  } = dataState;
  const {
    codeSearch,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    selectedFoodBankId,
    setInventorySearch,
    setSelectedCodeIds,
    setSelectedDonationIds,
    setSelectedFoodBankId,
  } = uiState;

  useResetSelectionEffects({
    donations,
    donationSearch,
    donationDonorTypeFilter,
    donationStatusFilter,
    setSelectedDonationIds,
    applications,
    codeSearch,
    setSelectedCodeIds,
  });
  useRefreshImpactMetricsEffect({
    applications,
    donations,
    isLoadingApplications,
    isLoadingDonations,
    refreshImpactMetrics,
  });
  useFoodBankScopeEffects({
    adminScopeFoodBankId: adminScope.foodBankId,
    hasFixedFoodBank: scopeState.hasFixedFoodBank,
    canChooseFoodBank: scopeState.canChooseFoodBank,
    isFoodBankSelectionRequired: scopeState.isFoodBankSelectionRequired,
    selectedFoodBankId,
    setSelectedFoodBankId,
    setInventorySearch,
  });
}

function createInventoryItemActions({
  adminScopeFoodBankId,
  dataState,
  uiState,
  derivedState,
}: CreateInventoryActionsContext) {
  return makeItemOps({
    accessToken: dataState.accessToken,
    sessionExpiredMessage,
    adminScopeFoodBankId,
    selectedFoodBankId: uiState.selectedFoodBankId,
    scopedInventoryItems: derivedState.scopedInventoryItems,
    scopedPackageRows: dataState.scopedPackageRows,
    itemEditorTarget: uiState.itemEditorTarget,
    itemEditorDraft: uiState.itemEditorDraft,
    setItemEditorError: uiState.setItemEditorError,
    setIsItemEditorSubmitting: uiState.setIsItemEditorSubmitting,
    resetItemEditor: uiState.resetItemEditor,
    closeItemEditor: uiState.closeItemEditor,
    stockInTarget: uiState.stockInTarget,
    stockInDraft: uiState.stockInDraft,
    setStockInError: uiState.setStockInError,
    setIsStockingIn: uiState.setIsStockingIn,
    resetStockInEditor: uiState.resetStockInEditor,
    closeStockInEditor: uiState.closeStockInEditor,
    deleteItemTarget: uiState.deleteItemTarget,
    setDeleteItemTarget: uiState.setDeleteItemTarget,
    setPendingAction: uiState.setPendingAction,
    setPageNotice: uiState.setPageNotice,
    refreshInventoryAndLots: dataState.refreshInventoryAndLots,
    deleteItem: dataState.deleteItem,
  });
}

function createInventoryPackageActions({
  adminScopeFoodBankId,
  dataState,
  uiState,
}: CreateInventoryActionsContext) {
  return makePackageOps({
    accessToken: dataState.accessToken,
    sessionExpiredMessage,
    adminScopeFoodBankId,
    selectedFoodBankId: uiState.selectedFoodBankId,
    scopedPackageDetails: dataState.scopedPackageDetails,
    packageDetailsById: dataState.packageDetailsById,
    setPackageDetailsById: dataState.setPackageDetailsById,
    setIsLoadingPackageDetail: dataState.setIsLoadingPackageDetail,
    packageEditorTarget: uiState.packageEditorTarget,
    packageEditorDraft: uiState.packageEditorDraft,
    setPackageEditorError: uiState.setPackageEditorError,
    setIsPackageEditorSubmitting: uiState.setIsPackageEditorSubmitting,
    resetPackageEditor: uiState.resetPackageEditor,
    closePackageEditor: uiState.closePackageEditor,
    deletePackageTarget: uiState.deletePackageTarget,
    setDeletePackageTarget: uiState.setDeletePackageTarget,
    packPackageId: uiState.packPackageId,
    packQuantity: uiState.packQuantity,
    setPackPackageId: uiState.setPackPackageId,
    setPackFeedback: uiState.setPackFeedback,
    setIsPacking: uiState.setIsPacking,
    resetPackingEditor: uiState.resetPackingEditor,
    setPendingAction: uiState.setPendingAction,
    setPageNotice: uiState.setPageNotice,
    refreshInventoryAndLots: dataState.refreshInventoryAndLots,
    refreshScopedPackages: dataState.refreshScopedPackages,
  });
}

function createInventoryLotActions({
  dataState,
  uiState,
}: CreateInventoryActionsContext) {
  return makeLotOps({
    accessToken: dataState.accessToken,
    sessionExpiredMessage,
    lotRows: dataState.lotRows,
    lotExpiryTarget: uiState.lotExpiryTarget,
    setLotExpiryTarget: uiState.setLotExpiryTarget,
    setLotExpiryError: uiState.setLotExpiryError,
    closeLotExpiryEditor: uiState.closeLotExpiryEditor,
    lotStatusTarget: uiState.lotStatusTarget,
    setLotStatusTarget: uiState.setLotStatusTarget,
    lotDeleteTarget: uiState.lotDeleteTarget,
    setLotDeleteTarget: uiState.setLotDeleteTarget,
    setIsDeletingLot: uiState.setIsDeletingLot,
    setPendingAction: uiState.setPendingAction,
    setPageNotice: uiState.setPageNotice,
    refreshInventoryAndLots: dataState.refreshInventoryAndLots,
    refreshLots: dataState.refreshLots,
  });
}

function createAdminFoodManagementInventoryActions({
  adminScopeFoodBankId,
  dataState,
  uiState,
  derivedState,
}: CreateInventoryActionsContext) {
  return {
    ...createInventoryItemActions({
      adminScopeFoodBankId,
      dataState,
      uiState,
      derivedState,
    }),
    ...createInventoryPackageActions({
      adminScopeFoodBankId,
      dataState,
      uiState,
      derivedState,
    }),
    ...createInventoryLotActions({
      adminScopeFoodBankId,
      dataState,
      uiState,
      derivedState,
    }),
  };
}

function useAdminFoodManagementActionBindings({
  adminScopeFoodBankId,
  dataState,
  uiState,
  derivedState,
}: {
  adminScopeFoodBankId: number | null;
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  derivedState: AdminFoodManagementDerivedState;
}) {
  const inventoryActions = createAdminFoodManagementInventoryActions({
    adminScopeFoodBankId,
    dataState,
    uiState,
    derivedState,
  });
  const donationActions = useAdminDonationCodeActions({
    accessToken: dataState.accessToken,
    sessionExpiredMessage,
    donorEmailPattern,
    uiState,
    dataState,
    filteredDonations: derivedState.filteredDonations,
    filteredApplications: derivedState.filteredApplications,
    selectedDonationIdSet: derivedState.selectedDonationIdSet,
    selectedCodeIdSet: derivedState.selectedCodeIdSet,
  });

  return { inventoryActions, donationActions };
}

function buildSectionsProps({
  adminScope,
  dataState,
  uiState,
  derivedState,
  inventoryActions,
  donationActions,
  impactMetrics,
  publicImpactStatus,
}: {
  adminScope: AdminScopeMeta;
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  derivedState: AdminFoodManagementDerivedState;
  inventoryActions: AdminFoodManagementInventoryActions;
  donationActions: AdminDonationCodeActions;
  impactMetrics: PublicImpactMetricsState["impactMetrics"];
  publicImpactStatus: PublicImpactMetricsState["status"];
}): AdminFoodManagementSectionsProps {
  return {
    sharedPublicImpact: {
      impactMetrics,
      publicImpactStatus,
      isLocalFoodBankView: adminScope.isLocalFoodBankAdmin,
      foodBankName: adminScope.foodBankName,
    },
    loadError: dataState.loadError,
    pageFeedback: uiState.pageFeedback,
    onClosePageFeedback: uiState.clearPageFeedback,
    donations: {
      heading: "Donation Records",
      search: uiState.donationSearch,
      donorTypeFilter: uiState.donationDonorTypeFilter,
      statusFilter: uiState.donationStatusFilter,
      donations: derivedState.filteredDonations,
      selectedDonationIds: derivedState.selectedDonationIdSet,
      isLoadingDonations: dataState.isLoadingDonations,
      donationError: dataState.donationError,
      onSearchChange: uiState.setDonationSearch,
      onDonorTypeFilterChange: uiState.setDonationDonorTypeFilter,
      onStatusFilterChange: uiState.setDonationStatusFilter,
      onNewDonation: donationActions.openNewDonationEditor,
      onToggleDonationSelection: donationActions.toggleDonationSelection,
      onToggleAllDonations: donationActions.toggleAllDonations,
      onViewDonation: donationActions.openDonationView,
      onEditDonation: donationActions.openEditDonationEditor,
      onReceiveDonation: (donation) => {
        void donationActions.receiveDonation(donation);
      },
      onDeleteDonation: donationActions.openDeleteDonationConfirm,
      onBatchDelete: () => {
        void donationActions.submitBatchDeleteDonations();
      },
      onBatchReceive: () => {
        void donationActions.submitBatchReceiveDonations();
      },
      isBatchDeleteBusy: uiState.isActionBusy("donation-batch-delete"),
      isBatchReceiveBusy: uiState.isActionBusy("donation-batch-receive"),
    },
    items: {
      search: uiState.inventorySearch,
      inventoryItems: derivedState.scopedInventoryItems,
      isLoadingData: dataState.isLoadingData,
      onSearchChange: uiState.setInventorySearch,
      onAddItem: inventoryActions.openNewItemEditor,
      onEditItem: inventoryActions.openEditItemEditor,
      onAdjustItem: inventoryActions.openItemAdjustModal,
      onDeleteItem: inventoryActions.handleDeleteItem,
      ...derivedState.sectionScopeProps.inventory,
    },
    packages: {
      heading: "Food Package",
      addButtonLabel: "New Food Package",
      packageRows: dataState.scopedPackageRows,
      isLoadingData:
        dataState.isLoadingData || dataState.isLoadingScopedPackages,
      onAddPackage: inventoryActions.openNewPackageEditor,
      onEditPackage: (target) => {
        void inventoryActions.openEditPackageEditor(target);
      },
      onDeletePackage: inventoryActions.openDeletePackageConfirm,
      onOpenPackTab: inventoryActions.openPackTab,
      ...derivedState.sectionScopeProps.packages,
    },
    lots: {
      heading: "Lot Records",
      inventoryItems: dataState.inventory,
      lotRows: dataState.lotRows,
      isLoadingLots: dataState.isLoadingLots,
      lotError: dataState.lotError,
      onEditExpiry: inventoryActions.handleLotExpiryEdit,
      onToggleStatus: inventoryActions.handleLotStatusToggle,
      onDeleteLot: inventoryActions.openDeleteLotConfirm,
      onBatchWasteLots: inventoryActions.submitBatchWasteLots,
      onBatchDeleteLots: inventoryActions.submitBatchDeleteLots,
    },
    codes: {
      heading: "Redemption Code Records",
      search: uiState.codeSearch,
      applications: derivedState.filteredApplications,
      selectedCodeIds: derivedState.selectedCodeIdSet,
      isLoadingApplications: dataState.isLoadingApplications,
      applicationsError: dataState.applicationsError,
      onSearchChange: uiState.setCodeSearch,
      onOpenVerify: () => uiState.setIsCodeVerifyOpen(true),
      onToggleCodeSelection: donationActions.toggleCodeSelection,
      onToggleAllCodes: donationActions.toggleAllCodes,
      onViewCode: donationActions.openCodeView,
      onVoidCode: donationActions.openVoidCodeConfirm,
      onBatchVoid: () => {
        void donationActions.submitBatchVoidCodes();
      },
      isBatchVoidBusy: uiState.isActionBusy("code-batch-void"),
    },
  };
}

function buildEditorModalProps({
  dataState,
  uiState,
  derivedState,
  inventoryActions,
  donationActions,
}: {
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  derivedState: AdminFoodManagementDerivedState;
  inventoryActions: AdminFoodManagementInventoryActions;
  donationActions: AdminDonationCodeActions;
}): AdminFoodManagementEditorModalProps {
  return {
    inventoryItemEditor: {
      id:
        uiState.itemEditorTarget?.mode === "edit"
          ? "edit-item-editor"
          : "new-item-editor",
      isOpen: uiState.itemEditorTarget !== null,
      isEditing: uiState.itemEditorTarget?.mode === "edit",
      draft: uiState.itemEditorDraft,
      error: uiState.itemEditorError,
      submitting: uiState.isItemEditorSubmitting,
      categoryOptions: inventoryEditorCategories,
      onClose: uiState.closeItemEditor,
      onFieldChange: uiState.updateItemDraftField,
      onSubmit: inventoryActions.submitItemEditor,
    },
    inventoryStockIn: {
      isOpen: uiState.stockInTarget !== null,
      itemName: uiState.stockInTarget?.name ?? "",
      draft: uiState.stockInDraft,
      error: uiState.stockInError,
      submitting: uiState.isStockingIn,
      onClose: uiState.closeStockInEditor,
      onFieldChange: uiState.updateStockInDraftField,
      onSubmit: inventoryActions.submitStockIn,
    },
    packageEditor: {
      id:
        uiState.packageEditorTarget?.mode === "edit"
          ? "edit-package-editor"
          : "new-package-editor",
      isOpen: uiState.packageEditorTarget !== null,
      isEditing: uiState.packageEditorTarget?.mode === "edit",
      draft: uiState.packageEditorDraft,
      inventoryItems: derivedState.scopedInventoryItems,
      error: uiState.packageEditorError,
      submitting: uiState.isPackageEditorSubmitting,
      categoryOptions: packageEditorCategories,
      onClose: uiState.closePackageEditor,
      onFieldChange: uiState.updatePackageDraftField,
      onRowChange: uiState.updatePackageDraftRow,
      onAddRow: uiState.addPackageDraftRow,
      onRemoveRow: uiState.removePackageDraftRow,
      onSubmit: inventoryActions.submitPackageEditor,
    },
    packing: {
      isOpen: uiState.packPackageId !== "",
      packages: dataState.scopedPackingPackages,
      selectedPackageId: uiState.packPackageId,
      quantity: uiState.packQuantity,
      stockCheckRows: derivedState.packingStockCheckRows,
      feedback: uiState.packFeedback,
      loadingStockCheck: dataState.isLoadingPackageDetail,
      submitting: uiState.isPacking,
      onClose: uiState.closePackingEditor,
      onPackageChange: inventoryActions.handlePackingPackageChange,
      onQuantityChange: uiState.setPackQuantity,
      onSubmit: inventoryActions.handlePackPackage,
    },
    lotExpiry: {
      isOpen: uiState.lotExpiryTarget !== null,
      target: uiState.lotExpiryTarget,
      expiryValue: uiState.lotExpiryTarget?.expiryDate ?? "",
      error: uiState.lotExpiryError,
      submitting: uiState.isActionBusy("lot-expiry"),
      onClose: uiState.closeLotExpiryEditor,
      onExpiryChange: (value) =>
        uiState.setLotExpiryTarget((current) =>
          current ? { ...current, expiryDate: value } : current,
        ),
      onSubmit: inventoryActions.submitLotExpiryEdit,
    },
    donationEditor: {
      isOpen: uiState.donationEditorTarget !== null,
      isEditing: uiState.donationEditorTarget?.mode === "edit",
      draft: uiState.donationDraft,
      itemOptions: derivedState.itemOptions,
      error: uiState.donationEditorError,
      submitting: uiState.isActionBusy("donation-save"),
      onClose: uiState.closeDonationEditor,
      onFieldChange: uiState.updateDonationDraftField,
      onItemChange: uiState.updateDonationDraftItem,
      onAddItem: uiState.addDonationDraftItem,
      onRemoveItem: uiState.removeDonationDraftItem,
      onSubmit: donationActions.submitDonationEditor,
    },
  };
}

function buildConfirmModalProps({
  uiState,
  inventoryActions,
  donationActions,
}: {
  uiState: AdminFoodManagementUiState;
  inventoryActions: AdminFoodManagementInventoryActions;
  donationActions: AdminDonationCodeActions;
}): AdminFoodManagementSectionsModel["confirmModalProps"] {
  return {
    lotStatusTarget: uiState.lotStatusTarget,
    onCloseLotStatus: () => uiState.setLotStatusTarget(null),
    onConfirmLotStatus: inventoryActions.submitLotStatusToggle,
    isLotStatusSubmitting: uiState.isActionBusy("lot-status"),
    lotDeleteTarget: uiState.lotDeleteTarget,
    onCloseLotDelete: () => uiState.setLotDeleteTarget(null),
    onConfirmLotDelete: inventoryActions.submitDeleteLot,
    isLotDeleteSubmitting: uiState.isDeletingLot,
    deleteItemTarget: uiState.deleteItemTarget,
    onCloseDeleteItem: () => uiState.setDeleteItemTarget(null),
    onConfirmDeleteItem: inventoryActions.submitDeleteItem,
    isDeleteItemSubmitting: uiState.isActionBusy("delete-item"),
    deletePackageTarget: uiState.deletePackageTarget,
    onCloseDeletePackage: () => uiState.setDeletePackageTarget(null),
    onConfirmDeletePackage: inventoryActions.submitDeletePackage,
    isDeletePackageSubmitting: uiState.isActionBusy("package-delete"),
    deleteDonationTarget: uiState.deleteDonationTarget,
    onCloseDeleteDonation: () => uiState.setDeleteDonationTarget(null),
    onConfirmDeleteDonation: donationActions.submitDeleteDonation,
    isDeleteDonationSubmitting: uiState.isActionBusy("donation-delete"),
    voidCodeTarget: uiState.voidCodeTarget,
    onCloseVoidCode: () => uiState.setVoidCodeTarget(null),
    onConfirmVoidCode: donationActions.submitVoidCode,
    isVoidCodeSubmitting: uiState.isActionBusy("code-void"),
  };
}

function buildDetailModalProps({
  uiState,
  donationActions,
}: {
  uiState: AdminFoodManagementUiState;
  donationActions: AdminDonationCodeActions;
}): AdminFoodManagementDetailModalProps {
  return {
    donationDetails: {
      donation: uiState.donationViewTarget,
      isOpen: uiState.donationViewTarget !== null,
      onClose: () => uiState.setDonationViewTarget(null),
    },
    codeVerify: {
      isOpen: uiState.isCodeVerifyOpen,
      code: uiState.verifyCodeInput,
      result: uiState.codeVerifyResult,
      checking: uiState.isActionBusy("code-check"),
      redeeming: uiState.isActionBusy("code-redeem"),
      onClose: uiState.closeCodeVerifyModal,
      onCodeChange: uiState.setVerifyCodeInput,
      onCheck: donationActions.checkRedemptionCode,
      onRedeem: donationActions.redeemVerifiedCode,
    },
    codeDetails: {
      record: uiState.codeViewTarget,
      isOpen: uiState.codeViewTarget !== null,
      onClose: () => uiState.setCodeViewTarget(null),
    },
  };
}

function buildChromeBindings(
  uiState: AdminFoodManagementUiState,
): AdminFoodManagementChromeBindings {
  return {
    overlay: {
      isVisible: uiState.isAnyInlineEditorOpen,
      onClose: uiState.closeAllInlineEditors,
    },
    toast: {
      isVisible: uiState.isToastVisible,
      message: uiState.toastMessage,
    },
  };
}

export function useAdminFoodManagementSectionsModel({
  adminScope,
  adminScopeFoodBankId,
  dataState,
  uiState,
  impactMetrics,
  publicImpactStatus,
  refreshImpactMetrics,
}: {
  adminScope: AdminScopeMeta;
  adminScopeFoodBankId: number | null;
  dataState: AdminFoodManagementDataState;
  uiState: AdminFoodManagementUiState;
  impactMetrics: PublicImpactMetricsState["impactMetrics"];
  publicImpactStatus: PublicImpactMetricsState["status"];
  refreshImpactMetrics: ReturnType<
    typeof usePublicImpactMetrics
  >["refreshImpactMetrics"];
}): AdminFoodManagementSectionsModel {
  // Treat this as the composition root for the workspace: data, ui state,
  // derived selections, and action bindings all meet here before rendering.
  const derivedState = useAdminFoodManagementSectionDerivations({
    dataState,
    uiState,
  });
  const { inventoryActions, donationActions } =
    useAdminFoodManagementActionBindings({
      adminScopeFoodBankId,
      dataState,
      uiState,
      derivedState,
    });

  useAdminFoodManagementSectionEffects({
    adminScope,
    dataState,
    uiState,
    refreshImpactMetrics,
  });

  return {
    sectionsProps: buildSectionsProps({
      adminScope,
      dataState,
      uiState,
      derivedState,
      inventoryActions,
      donationActions,
      impactMetrics,
      publicImpactStatus,
    }),
    editorModalProps: buildEditorModalProps({
      dataState,
      uiState,
      derivedState,
      inventoryActions,
      donationActions,
    }),
    confirmModalProps: buildConfirmModalProps({
      uiState,
      inventoryActions,
      donationActions,
    }),
    detailModalProps: buildDetailModalProps({ uiState, donationActions }),
    chrome: buildChromeBindings(uiState),
  };
}
