import Modal from '@/shared/ui/Modal'

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
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[#4B5563]">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-full border border-[#E8E8E8] text-sm text-[#1A1A1A] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className={`px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60 ${
              confirmTone === 'danger'
                ? 'border border-[#E63946] bg-[#E63946] text-white'
                : 'border border-[#F7DC6F] bg-[#F7DC6F] text-[#1A1A1A]'
            }`}
          >
            {submitting ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
