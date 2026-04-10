import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { getAdminButtonClassName } from './AdminButtonStyles'

interface AdminInlineActionsProps {
  children: ReactNode
  className?: string
}

export function AdminInlineActions({ children, className }: AdminInlineActionsProps) {
  return <div className={cn('flex gap-2', className)}>{children}</div>
}

interface AdminInlineActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'neutral' | 'danger'
}

export function AdminInlineActionButton({
  className,
  tone = 'neutral',
  type = 'button',
  ...props
}: AdminInlineActionButtonProps) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({ kind: 'inline', tone, className })}
      {...props}
    />
  )
}
