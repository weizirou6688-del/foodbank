interface AdminFeedbackBannerProps {
  tone: 'success' | 'error' | 'info'
  message: string
  onClose?: () => void
}
const FEEDBACK_BANNER_TONE_CLASS_NAME = {
  success: 'border border-[#2A9D8F]/30 bg-[#2A9D8F]/[0.08] text-[#1F6F66]',
  info: 'border border-[#457B9D]/30 bg-[#457B9D]/[0.08] text-[#1D4E6D]',
  error: 'border border-[#E63946]/30 bg-[#E63946]/[0.08] text-[#E63946]',
} as const
export default function AdminFeedbackBanner({
  tone,
  message,
  onClose,
}: AdminFeedbackBannerProps) {
  const className = `mb-6 rounded-xl px-4 py-3 text-sm ${FEEDBACK_BANNER_TONE_CLASS_NAME[tone]}`
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4">
        <span>{message}</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-current/70 hover:text-current"
          >
            x
          </button>
        ) : null}
      </div>
    </div>
  )
}
