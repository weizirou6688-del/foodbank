import { useEffect, useState } from 'react'

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

  if (!isOpen) {
    return null
  }

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
    <div
      className="_modalOverlay_fmbrn_179 fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[90%] max-w-md rounded-[2rem] shadow-2xl border border-[#E8E8E8] bg-white p-6 md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A1A1A]">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-full border border-[#E8E8E8] text-[#1A1A1A]"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">{quantityLabel}</label>
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

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-full border border-[#E8E8E8] text-sm text-[#1A1A1A]"
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
      </div>
    </div>
  )
}
