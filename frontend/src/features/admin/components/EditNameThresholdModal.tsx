import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'
import { AdminModalPrimaryButton, AdminModalSecondaryButton } from './AdminModalPrimitives'
import { AdminModalField, AdminModalInput } from './AdminModalFields'
import { AdminModalFormLayout } from './AdminModalLayouts'

interface EditNameThresholdModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  nameLabel: string
  thresholdLabel: string
  initialName: string
  initialThreshold: number
  submitLabel: string
  onSubmit: (name: string, threshold: number) => Promise<void>
}

export default function EditNameThresholdModal({
  isOpen,
  onClose,
  title,
  nameLabel,
  thresholdLabel,
  initialName,
  initialThreshold,
  submitLabel,
  onSubmit,
}: EditNameThresholdModalProps) {
  const [name, setName] = useState(initialName)
  const [threshold, setThreshold] = useState(String(initialThreshold))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setName(initialName)
    setThreshold(String(initialThreshold))
    setSubmitting(false)
    setError('')
  }, [isOpen, initialName, initialThreshold])

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

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name cannot be empty.')
      return
    }

    const parsedThreshold = Number(threshold)
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setError('Threshold must be a non-negative number.')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(trimmedName, parsedThreshold)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="max-w-xl"
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
        <AdminModalField label={nameLabel}>
          <AdminModalInput
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </AdminModalField>

        <AdminModalField label={thresholdLabel}>
          <AdminModalInput
            type="number"
            min={0}
            step={1}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </AdminModalField>
      </AdminModalFormLayout>
    </Modal>
  )
}
