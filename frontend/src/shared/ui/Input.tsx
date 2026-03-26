import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-[#2D3F3A] uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 px-3.5 rounded-lg border text-sm font-sans',
            'bg-white outline-none transition-colors duration-200',
            'placeholder:text-[#9BADA9]',
            error
              ? 'border-[#E63946] focus:border-[#E63946]'
              : 'border-[#E0E8E6] focus:border-teal',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#E63946]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#9BADA9]">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input
