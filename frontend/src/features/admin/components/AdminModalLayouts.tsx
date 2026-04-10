import type { FormHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { AdminModalActions, AdminModalError } from './AdminModalPrimitives'

interface AdminModalFormLayoutProps {
  description?: string
  error?: string
  actions: ReactNode
  children?: ReactNode
  className?: string
  actionsPadded?: boolean
  onSubmit?: FormHTMLAttributes<HTMLFormElement>['onSubmit']
}

export function AdminModalFormLayout({
  description,
  error,
  actions,
  children,
  className,
  actionsPadded = false,
  onSubmit,
}: AdminModalFormLayoutProps) {
  const content = (
    <>
      {description ? <p className="text-sm leading-6 text-[#4B5563]">{description}</p> : null}
      {children}
      <AdminModalError message={error} />
      <AdminModalActions padded={actionsPadded}>{actions}</AdminModalActions>
    </>
  )

  if (onSubmit) {
    return (
      <form className={cn('space-y-5', className)} onSubmit={onSubmit}>
        {content}
      </form>
    )
  }

  return <div className={cn('space-y-5', className)}>{content}</div>
}
