import { useEffect, useState } from 'react'
import Modal from '@/shared/ui/Modal'

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
      <form className="space-y-5" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[#4B5563]">{description}</p>
        <div>
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">Quantity</label>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
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
