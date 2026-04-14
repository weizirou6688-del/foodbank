import { Suspense, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import {
  getPrefetchTab,
  makeWorkspaceUrl,
  pickActiveTab,
} from './workspaceTabs'

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number
    cancelIdleCallback?: (handle: number) => void
  }
function AdminSectionFallback() {
  return (
    <>
      <div className="min-h-[40vh] flex items-center justify-center px-6 text-sm text-slate-600">
        Loading admin section...
      </div>
      <PublicSiteFooter />
    </>
  )
}
export default function Admin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const userRole = useAuthStore((state) => state.user?.role)
  const sectionParam = searchParams.get('section')
  const activeSection = pickActiveTab(userRole, sectionParam)
  const ActiveSectionComponent = activeSection.component

  useEffect(() => {
    if (sectionParam === activeSection.key) {
      return
    }
    navigate(makeWorkspaceUrl(activeSection.key, location.pathname), { replace: true })
  }, [activeSection.key, location.pathname, navigate, sectionParam])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const preloadTarget = getPrefetchTab(activeSection.key, userRole)

    if (!preloadTarget) {
      return
    }

    const preload = () => {
      void preloadTarget.preload()
    }

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleHandle = idleWindow.requestIdleCallback(preload)
      return () => {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleHandle)
        }
      }
    }
    const timeoutHandle = window.setTimeout(preload, 300)
    return () => window.clearTimeout(timeoutHandle)
  }, [activeSection.key, userRole])

  return (
    <Suspense fallback={<AdminSectionFallback />}>
      <ActiveSectionComponent />
    </Suspense>
  )
}
