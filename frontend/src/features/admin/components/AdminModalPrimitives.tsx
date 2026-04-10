import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { getAdminButtonClassName } from './AdminButtonStyles'

interface AdminModalErrorProps {
  message?: string
}

export function AdminModalError({ message }: AdminModalErrorProps) {
  if (!message) {
    return null
  }

  return <p className="text-sm text-[#E63946]">{message}</p>
}

interface AdminModalActionsProps {
  children: ReactNode
  className?: string
  padded?: boolean
}

export function AdminModalActions({
  children,
  className,
  padded = false,
}: AdminModalActionsProps) {
  return (
    <div className={cn('flex justify-end gap-3', padded && 'pt-2', className)}>
      {children}
    </div>
  )
}

export function AdminModalSecondaryButton({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({ kind: 'modalSecondary', className })}
      {...props}
    />
  )
}

interface AdminModalPrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'neutral' | 'danger'
}

export function AdminModalPrimaryButton({
  className,
  tone = 'neutral',
  type = 'button',
  ...props
}: AdminModalPrimaryButtonProps) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({
        kind: 'modalPrimary',
        tone: tone === 'danger' ? 'danger' : 'accent',
        className,
      })}
      {...props}
    />
  )
}
