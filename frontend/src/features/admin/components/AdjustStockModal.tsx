import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

interface AdjustStockModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  quantityLabel: string
  submitLabel: string
  onSubmit: (quantity: number) => Promise<void>
}

export default function AdjustStockModal({
  isOpen,
  onClose,
  title,
  quantityLabel,
  submitLabel,
  onSubmit,
}: AdjustStockModalProps) {
  const [quantity, setQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setQuantity('1')
    setSubmitting(false)
    setError('')
  }, [isOpen])

  const handleClose = () => {
    if (submitting) {
      return
    }
    setError('')
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const parsedQuantity = Number(quantity)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Please enter a positive number.')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(parsedQuantity)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stock update failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="max-w-md"
      dialogClassName="border border-[#E8E8E8]"
    >
      <AdminModalFormLayout
        onSubmit={handleSubmit}
        error={error}
        className="space-y-4"
        actionsPadded
        actions={
          <>
            <AdminModalSecondaryButton onClick={handleClose}>
              Cancel
            </AdminModalSecondaryButton>
            <AdminModalPrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : submitLabel}
            </AdminModalPrimaryButton>
          </>
        }
      >
        <AdminModalField label={quantityLabel}>
          <AdminModalInput
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </AdminModalField>
      </AdminModalFormLayout>
    </Modal>
  )
}
