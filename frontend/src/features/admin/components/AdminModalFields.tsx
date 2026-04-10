import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/cn'

interface AdminModalFieldProps {
  label: string
  htmlFor?: string
  className?: string
  labelClassName?: string
  children: ReactNode
}

export function AdminModalField({
  label,
  htmlFor,
  className,
  labelClassName,
  children,
}: AdminModalFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className={cn('block text-sm font-semibold text-[#1A1A1A] mb-1.5', labelClassName)}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export const AdminModalInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('w-full h-11 px-3 rounded-lg border border-[#E8E8E8] outline-none', className)}
        {...props}
      />
    )
  },
)

AdminModalInput.displayName = 'AdminModalInput'

export const AdminModalSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full h-11 px-3 rounded-lg border border-[#E8E8E8] bg-white outline-none',
          className,
        )}
        {...props}
      />
    )
  },
)

AdminModalSelect.displayName = 'AdminModalSelect'
