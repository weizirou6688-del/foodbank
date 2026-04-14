import type { ReactNode } from 'react'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { useScrollToTopOnRouteChange } from '@/shared/lib/scroll'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

type PublicPageShellVariant = 'public' | 'supermarket'

interface PublicPageShellProps {
  children: ReactNode
  className?: string
  mainClassName?: string
  variant?: PublicPageShellVariant
  showFooter?: boolean
  navCenterText?: string
}

const DEFAULT_SHELL_CLASS_NAME = 'public-page-font min-h-screen bg-white flex flex-col'
const DEFAULT_MAIN_CLASS_NAME = 'flex-1'

export default function PublicPageShell({
  children,
  className,
  mainClassName,
  variant = 'public',
  showFooter = true,
  navCenterText,
}: PublicPageShellProps) {
  useScrollToTopOnRouteChange()

  return (
    <div className={className ?? DEFAULT_SHELL_CLASS_NAME}>
      <PrimaryNavbar variant={variant} centerText={navCenterText} />
      <main className={mainClassName ?? DEFAULT_MAIN_CLASS_NAME}>{children}</main>
      {showFooter ? <PublicSiteFooter /> : null}
    </div>
  )
}
