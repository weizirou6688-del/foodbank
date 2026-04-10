import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

interface DatePromptModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  initialValue: string
  submitLabel: string
  submitting?: boolean
  onSubmit: (value: string) => Promise<void>
}

export default function DatePromptModal({
  isOpen,
  onClose,
  title,
  description,
  initialValue,
  submitLabel,
  submitting,
  onSubmit,
}: DatePromptModalProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setValue(initialValue)
    setError('')
  }, [isOpen, initialValue])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setError('Expiry date format must be YYYY-MM-DD.')
      return
    }

    setError('')
    await onSubmit(trimmed)
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
        <AdminModalField label="Expiry Date">
          <AdminModalInput
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </AdminModalField>
      </AdminModalFormLayout>
    </Modal>
  )
}
