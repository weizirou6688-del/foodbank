import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalFormLayout } from './AdminModalLayouts'

interface ConfirmActionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel: string
  confirmTone?: 'neutral' | 'danger'
  submitting?: boolean
  onConfirm: () => Promise<void>
}

export default function ConfirmActionModal({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel,
  confirmTone = 'neutral',
  submitting,
  onConfirm,
}: ConfirmActionModalProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title={title}>
      <AdminModalFormLayout
        description={message}
        actions={
          <>
          <AdminModalSecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </AdminModalSecondaryButton>
          <AdminModalPrimaryButton
            onClick={() => void handleConfirm()}
            disabled={submitting}
            tone={confirmTone}
          >
            {submitting ? 'Working...' : confirmLabel}
          </AdminModalPrimaryButton>
          </>
        }
      />
    </Modal>
  )
}
