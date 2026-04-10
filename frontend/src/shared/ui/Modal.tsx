import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
  dialogClassName?: string
  bodyClassName?: string
  titleClassName?: string
  showCloseButton?: boolean
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  dialogClassName,
  bodyClassName,
  titleClassName,
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={joinClassNames(
          'bg-white rounded-2xl shadow-2xl w-full relative overflow-y-auto max-h-[90vh]',
          maxWidth,
          dialogClassName,
        )}
        style={{ borderRadius: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-7 pt-7 pb-0">
            <h2
              className={joinClassNames('text-xl font-bold text-[#1A1A1A]', titleClassName)}
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {title}
            </h2>
            {showCloseButton ? (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-[#1A1A1A] transition-colors p-1 rounded-lg hover:bg-[#F5F5F5]"
                style={{ background: '#F3F4F6', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#6b7280' }}
              >
                &times;
              </button>
            ) : null}
          </div>
        )}
        <div className={joinClassNames('px-7 pb-7 pt-5', bodyClassName)}>{children}</div>
      </div>
    </div>
  )
}
