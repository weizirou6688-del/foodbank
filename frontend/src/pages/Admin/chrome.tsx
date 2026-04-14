import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from './classNames'

export type AdminButtonTone = 'primary' | 'secondary' | 'danger'
type AdminButtonSize = 'md' | 'sm'
type AdminActionGroupVariant = 'table' | 'card'

function getAdminButtonClassName(
  tone: AdminButtonTone = 'primary',
  size: AdminButtonSize = 'md',
  className?: string,
) {
  return cx('btn', `btn-${tone}`, size === 'sm' && 'btn-sm', className)
}

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: AdminButtonTone
  size?: AdminButtonSize
  children: ReactNode
}

export function AdminButton({
  tone = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: AdminButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={getAdminButtonClassName(tone, size, className)}
    >
      {children}
    </button>
  )
}

interface AdminLinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  tone?: AdminButtonTone
  size?: AdminButtonSize
  children: ReactNode
}

export function AdminLinkButton({
  tone = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: AdminLinkButtonProps) {
  return (
    <a {...props} className={getAdminButtonClassName(tone, size, className)}>
      {children}
    </a>
  )
}

export function AdminActionGroup({
  variant = 'table',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: AdminActionGroupVariant
  children: ReactNode
}) {
  return (
    <div
      {...props}
      className={cx(
        variant === 'card' ? 'admin-card-actions' : 'table-actions',
        className,
      )}
    >
      {children}
    </div>
  )
}
