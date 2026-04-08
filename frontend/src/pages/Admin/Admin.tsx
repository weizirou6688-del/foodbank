import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

const AdminFoodManagementWorkspace = lazy(() => import('./AdminFoodManagementWorkspace'))
const AdminStatistics = lazy(() => import('./AdminStatistics'))

type Section = 'statistics' | 'food'

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

  useEffect(() => {
    const s = searchParams.get('section')
    if (s === 'food') {
      setSection('food')
      return
    }

    if (s === 'statistics') {
      setSection('statistics')
      return
    }

    setSection('food')
    navigate('/admin?section=food', { replace: true })
  }, [navigate, searchParams])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const preload = () => {
      if (section === 'food') {
        void import('./AdminStatistics')
        return
      }

      void import('./AdminFoodManagementWorkspace')
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
  }, [section])

  return (
    <Suspense fallback={<AdminSectionFallback />}>
      {section === 'food' ? (
        <AdminFoodManagementWorkspace />
      ) : (
        <AdminStatistics
          onSwitch={(nextSection) => {
            setSection(nextSection)
            navigate(`/admin?section=${nextSection}`)
          }}
        />
      )}
    </Suspense>
  )
}
