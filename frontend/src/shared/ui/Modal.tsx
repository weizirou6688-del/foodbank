import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
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
        className={`bg-white rounded-2xl shadow-2xl w-full relative overflow-y-auto max-h-[90vh] ${maxWidth}`}
        style={{ borderRadius: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-7 pt-7 pb-0">
            <h2 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-[#1A1A1A] transition-colors p-1 rounded-lg hover:bg-[#F5F5F5]"
              style={{ background: '#F3F4F6', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#6b7280' }}
            >
              &times;
            </button>
          </div>
        )}
        <div className="px-7 pb-7 pt-5">{children}</div>
      </div>
    </div>
  )
}
