interface AdminFeedbackBannerProps {
  tone: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}

export default function AdminFeedbackBanner({
  tone,
  message,
  onClose,
}: AdminFeedbackBannerProps) {
  return (
    <div
      className={`mb-6 rounded-xl px-4 py-3 text-sm ${
        tone === 'success'
          ? 'border border-[#2A9D8F]/30 bg-[#2A9D8F]/[0.08] text-[#1F6F66]'
          : tone === 'info'
            ? 'border border-[#457B9D]/30 bg-[#457B9D]/[0.08] text-[#1D4E6D]'
            : 'border border-[#E63946]/30 bg-[#E63946]/[0.08] text-[#E63946]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-current/70 hover:text-current"
        >
          x
        </button>
      </div>
    </div>
  )
}
