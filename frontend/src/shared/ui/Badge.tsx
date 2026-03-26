import { cn } from '@/shared/lib/cn'
import type { ReactNode } from 'react'

type BadgeVariant = 'teal' | 'amber' | 'danger' | 'gray' | 'navy'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  teal:   'bg-[#E8F8F6] text-teal',
  amber:  'bg-[#FFF8E7] text-[#8A5700]',
  danger: 'bg-[#FFEBEE] text-[#E63946]',
  gray:   'bg-[#F0F4F3] text-[#5A706B]',
  navy:   'bg-[#0D1B2A] text-white',
}

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('inline-block px-2.5 py-1 rounded-md text-xs font-semibold', variantClasses[variant], className)}>
      {children}
    </span>
  )
}
