import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

interface QuantityPromptModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  submitLabel: string
  submitting?: boolean
  onSubmit: (quantity: number) => Promise<void>
}

export default function QuantityPromptModal({
  isOpen,
  onClose,
  title,
  description,
  submitLabel,
  submitting,
  onSubmit,
}: QuantityPromptModalProps) {
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setQuantity('1')
    setError('')
  }, [isOpen])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantity must be a positive integer.')
      return
    }

    setError('')
    await onSubmit(parsedQuantity)
  }

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title={title}>
      <AdminModalFormLayout
        description={description}
        error={error}
        onSubmit={handleSubmit}
        actions={
          <>
            <AdminModalSecondaryButton onClick={onClose} disabled={submitting}>
              Cancel
            </AdminModalSecondaryButton>
            <AdminModalPrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : submitLabel}
            </AdminModalPrimaryButton>
          </>
        }
      >
        <AdminModalField label="Quantity">
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
