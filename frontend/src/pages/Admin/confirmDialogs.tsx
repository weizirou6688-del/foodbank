import type { ComponentProps } from 'react'
import { InlineConfirmModal } from './modalBits'
import type {
  CodeVoidTarget,
  DeleteItemTarget,
  DonationDeleteTarget,
  LotDeleteTarget,
  LotStatusTarget,
} from './adminFoodManagement.types'

interface AdminFoodManagementConfirmModalsProps {
  lotStatusTarget: LotStatusTarget | null
  onCloseLotStatus: () => void
  onConfirmLotStatus: () => void
  isLotStatusSubmitting: boolean
  lotDeleteTarget: LotDeleteTarget | null
  onCloseLotDelete: () => void
  onConfirmLotDelete: () => void
  isLotDeleteSubmitting: boolean
  deleteItemTarget: DeleteItemTarget | null
  onCloseDeleteItem: () => void
  onConfirmDeleteItem: () => void
  isDeleteItemSubmitting: boolean
  deleteDonationTarget: DonationDeleteTarget | null
  onCloseDeleteDonation: () => void
  onConfirmDeleteDonation: () => void
  isDeleteDonationSubmitting: boolean
  voidCodeTarget: CodeVoidTarget | null
  onCloseVoidCode: () => void
  onConfirmVoidCode: () => void
  isVoidCodeSubmitting: boolean
}

type ConfirmModalConfig = ComponentProps<typeof InlineConfirmModal>

const createDangerModal = (modal: Omit<ConfirmModalConfig, 'confirmTone'>): ConfirmModalConfig => ({
  confirmTone: 'danger',
  ...modal,
})

export function AdminFoodManagementConfirmModals({
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
  deleteDonationTarget,
  onCloseDeleteDonation,
  onConfirmDeleteDonation,
  isDeleteDonationSubmitting,
  voidCodeTarget,
  onCloseVoidCode,
  onConfirmVoidCode,
  isVoidCodeSubmitting,
}: AdminFoodManagementConfirmModalsProps) {
  const confirmModals: ConfirmModalConfig[] = [
    {
      id: 'mark-wasted-confirm',
      isOpen: lotStatusTarget !== null,
      onClose: onCloseLotStatus,
      title: lotStatusTarget?.currentStatus === 'active' ? 'Mark Lot as Wasted' : 'Reactivate Lot',
      description: !lotStatusTarget ? '' : lotStatusTarget.currentStatus === 'active'
        ? `Mark lot ${lotStatusTarget.lotNumber} as wasted? This will deduct the remaining stock from inventory, and cannot be undone.`
        : `Mark lot ${lotStatusTarget.lotNumber} as active again?`,
      confirmLabel: lotStatusTarget?.currentStatus === 'active' ? 'Mark Wasted' : 'Mark Active',
      submitting: isLotStatusSubmitting,
      confirmTone: lotStatusTarget?.currentStatus === 'active' ? 'danger' : 'primary',
      onConfirm: onConfirmLotStatus,
    },
    createDangerModal({
      id: 'delete-lot-confirm',
      isOpen: lotDeleteTarget !== null,
      onClose: onCloseLotDelete,
      title: 'Delete Expired Lot',
      description: lotDeleteTarget ? `Delete expired lot ${lotDeleteTarget.lotNumber}? This cannot be undone.` : '',
      confirmLabel: 'Delete Lot',
      submitting: isLotDeleteSubmitting,
      onConfirm: onConfirmLotDelete,
    }),
    createDangerModal({
      id: 'delete-item-confirm',
      isOpen: deleteItemTarget !== null,
      onClose: onCloseDeleteItem,
      title: 'Delete Inventory Item',
      description: deleteItemTarget ? `Delete ${deleteItemTarget.itemName}? This cannot be undone.` : '',
      confirmLabel: 'Delete Item',
      submitting: isDeleteItemSubmitting,
      onConfirm: onConfirmDeleteItem,
    }),
    createDangerModal({
      id: 'delete-donation-confirm',
      isOpen: deleteDonationTarget !== null,
      onClose: onCloseDeleteDonation,
      title: 'Delete Donation Record',
      description: deleteDonationTarget ? `Delete donation ${deleteDonationTarget.displayId}? This cannot be undone.` : '',
      confirmLabel: 'Delete Record',
      submitting: isDeleteDonationSubmitting,
      onConfirm: onConfirmDeleteDonation,
    }),
    createDangerModal({
      id: 'void-code-confirm',
      isOpen: voidCodeTarget !== null,
      onClose: onCloseVoidCode,
      title: 'Void Redemption Code',
      description: voidCodeTarget ? `Void code ${voidCodeTarget.record.redemption_code}? This code will no longer be valid for redemption, and cannot be undone.` : '',
      confirmLabel: 'Void Code',
      submitting: isVoidCodeSubmitting,
      onConfirm: onConfirmVoidCode,
    }),
  ]

  return <>{confirmModals.map((modal) => <InlineConfirmModal key={modal.id} {...modal} />)}</>
}
