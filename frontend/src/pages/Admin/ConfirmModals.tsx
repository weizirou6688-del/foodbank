import type { ComponentProps } from "react";
import { AdminConfirmModalShell } from "./modalBits.editors.containers";
import type {
  CodeVoidTarget,
  DeleteItemTarget,
  DonationDeleteTarget,
  LotDeleteTarget,
  LotStatusTarget,
  PackageDeleteTarget,
} from "./adminFoodManagement.types";
type ConfirmModalConfig = ComponentProps<typeof AdminConfirmModalShell>;
export type AdminFoodManagementConfirmModalsProps = {
  lotStatusTarget: LotStatusTarget | null;
  onCloseLotStatus: () => void;
  onConfirmLotStatus: () => void;
  isLotStatusSubmitting: boolean;
  lotDeleteTarget: LotDeleteTarget | null;
  onCloseLotDelete: () => void;
  onConfirmLotDelete: () => void;
  isLotDeleteSubmitting: boolean;
  deleteItemTarget: DeleteItemTarget | null;
  onCloseDeleteItem: () => void;
  onConfirmDeleteItem: () => void;
  isDeleteItemSubmitting: boolean;
  deletePackageTarget: PackageDeleteTarget | null;
  onCloseDeletePackage: () => void;
  onConfirmDeletePackage: () => void;
  isDeletePackageSubmitting: boolean;
  deleteDonationTarget: DonationDeleteTarget | null;
  onCloseDeleteDonation: () => void;
  onConfirmDeleteDonation: () => void;
  isDeleteDonationSubmitting: boolean;
  voidCodeTarget: CodeVoidTarget | null;
  onCloseVoidCode: () => void;
  onConfirmVoidCode: () => void;
  isVoidCodeSubmitting: boolean;
};
function buildConfirmModalConfigs({
  lotStatusTarget,
  onCloseLotStatus,
  onConfirmLotStatus,
  isLotStatusSubmitting,
  lotDeleteTarget,
  onCloseLotDelete,
  onConfirmLotDelete,
  isLotDeleteSubmitting,
  deleteItemTarget,
  onCloseDeleteItem,
  onConfirmDeleteItem,
  isDeleteItemSubmitting,
  deletePackageTarget,
  onCloseDeletePackage,
  onConfirmDeletePackage,
  isDeletePackageSubmitting,
  deleteDonationTarget,
  onCloseDeleteDonation,
  onConfirmDeleteDonation,
  isDeleteDonationSubmitting,
  voidCodeTarget,
  onCloseVoidCode,
  onConfirmVoidCode,
  isVoidCodeSubmitting,
}: AdminFoodManagementConfirmModalsProps): ConfirmModalConfig[] {
  // Keep destructive-dialog copy declarative so page chrome can render every
  // confirm modal in one place without scattering the wording.
  return [
    {
      id: "mark-wasted-confirm",
      isOpen: lotStatusTarget !== null,
      onClose: onCloseLotStatus,
      title:
        lotStatusTarget?.currentStatus === "active"
          ? "Mark Lot as Wasted"
          : "Reactivate Lot",
      description: !lotStatusTarget
        ? ""
        : lotStatusTarget.currentStatus === "active"
          ? `Mark lot ${lotStatusTarget.lotNumber} as wasted? This will deduct the remaining stock from inventory, and cannot be undone.`
          : `Mark lot ${lotStatusTarget.lotNumber} as active again?`,
      confirmLabel:
        lotStatusTarget?.currentStatus === "active"
          ? "Mark Wasted"
          : "Mark Active",
      submitting: isLotStatusSubmitting,
      confirmTone:
        lotStatusTarget?.currentStatus === "active" ? "danger" : "primary",
      onConfirm: onConfirmLotStatus,
    },
    {
      id: "delete-lot-confirm",
      isOpen: lotDeleteTarget !== null,
      onClose: onCloseLotDelete,
      title: "Delete Expired Lot",
      description: lotDeleteTarget
        ? `Delete expired lot ${lotDeleteTarget.lotNumber}? This cannot be undone.`
        : "",
      confirmLabel: "Delete Lot",
      submitting: isLotDeleteSubmitting,
      confirmTone: "danger",
      onConfirm: onConfirmLotDelete,
    },
    {
      id: "delete-item-confirm",
      isOpen: deleteItemTarget !== null,
      onClose: onCloseDeleteItem,
      title: "Delete Inventory Item",
      description: deleteItemTarget
        ? `Delete ${deleteItemTarget.itemName}? This cannot be undone.`
        : "",
      confirmLabel: "Delete Item",
      submitting: isDeleteItemSubmitting,
      confirmTone: "danger",
      onConfirm: onConfirmDeleteItem,
    },
    {
      id: "delete-package-confirm",
      isOpen: deletePackageTarget !== null,
      onClose: onCloseDeletePackage,
      title: "Remove Food Package",
      description: deletePackageTarget
        ? `Remove ${deletePackageTarget.name} from active packages? Existing application history will be kept, and referenced packages will be archived instead of permanently deleted.`
        : "",
      confirmLabel: "Remove Package",
      submitting: isDeletePackageSubmitting,
      confirmTone: "danger",
      onConfirm: onConfirmDeletePackage,
    },
    {
      id: "delete-donation-confirm",
      isOpen: deleteDonationTarget !== null,
      onClose: onCloseDeleteDonation,
      title: "Delete Donation Record",
      description: deleteDonationTarget
        ? `Delete donation ${deleteDonationTarget.displayId}? This cannot be undone.`
        : "",
      confirmLabel: "Delete Record",
      submitting: isDeleteDonationSubmitting,
      confirmTone: "danger",
      onConfirm: onConfirmDeleteDonation,
    },
    {
      id: "void-code-confirm",
      isOpen: voidCodeTarget !== null,
      onClose: onCloseVoidCode,
      title: "Void Redemption Code",
      description: voidCodeTarget
        ? `Void code ${voidCodeTarget.record.redemption_code}? This code will no longer be valid for redemption, and cannot be undone.`
        : "",
      confirmLabel: "Void Code",
      submitting: isVoidCodeSubmitting,
      confirmTone: "danger",
      onConfirm: onConfirmVoidCode,
    },
  ];
}
export function AdminFoodManagementConfirmModals({
  ...props
}: AdminFoodManagementConfirmModalsProps) {
  const confirmModals = buildConfirmModalConfigs(props);
  return (
    <>
      {confirmModals.map((modal) => (
        <AdminConfirmModalShell key={modal.id} {...modal} />
      ))}
    </>
  );
}
