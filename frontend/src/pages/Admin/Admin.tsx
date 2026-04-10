import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

const AdminDataDashboardPreview = lazy(() => import('./AdminDataDashboardPreview'))
const AdminFoodManagementPreview = lazy(() => import('./AdminFoodManagementPreview'))
const AdminStatistics = lazy(() => import('./AdminStatistics'))
const AdminFoodManagement = lazy(() => import('./AdminFoodManagement'))

type Section = 'statistics' | 'food'
type RenderMode = 'preview' | 'react'

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
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('food')
  const [renderMode, setRenderMode] = useState<RenderMode>('preview')

  useEffect(() => {
    const s = searchParams.get('section')
    const render = searchParams.get('render')

    if (render === 'react') {
      setRenderMode('react')
    } else {
      setRenderMode('preview')
    }

    if (s === 'food') {
      setSection('food')
      return
    }

    if (s === 'statistics') {
      setSection('statistics')
      return
    }

    setSection('food')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('section', 'food')
    if (render === 'react') {
      nextParams.set('render', 'react')
    } else {
      nextParams.delete('render')
    }
    navigate(`/admin?${nextParams.toString()}`, { replace: true })
  }, [navigate, searchParams])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const preload = () => {
      if (renderMode === 'react') {
        if (section === 'food') {
          void import('./AdminStatistics')
          return
        }

        void import('./AdminFoodManagement')
        return
      }

      if (section === 'food') {
        void import('./AdminDataDashboardPreview')
        return
      }

      void import('./AdminFoodManagementPreview')
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
  }, [renderMode, section])

  return (
    <Suspense fallback={<AdminSectionFallback />}>
      {renderMode === 'react'
        ? section === 'food'
          ? <AdminFoodManagement onSwitch={setSection} />
          : <AdminStatistics onSwitch={setSection} />
        : section === 'food'
          ? <AdminFoodManagementPreview onSwitch={setSection} />
          : <AdminDataDashboardPreview />}
    </Suspense>
  )
}
