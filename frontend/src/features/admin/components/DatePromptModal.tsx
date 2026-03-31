import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'

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
      <form className="space-y-5" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[#4B5563]">{description}</p>
        <div>
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Expiry Date</label>
          <input
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none"
          />
        </div>
        {error && <p className="text-sm text-[#E63946]">{error}</p>}
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
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-full border border-[#F7DC6F] bg-[#F7DC6F] text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
          >
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
