import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import { bindIframeSync } from './adminPreviewFrame'
import AdminPreviewPageFrame from './AdminPreviewPageFrame'
import { dataDashboardAdminHtml } from './adminDataDashboardPreview.shared'
import {
  isDashboardPreviewSourceAvailable,
  syncAdminDataDashboardPreviewIframe,
} from './adminDataDashboardPreview.runtime'

export default function AdminDataDashboardPreview() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)
  const adminScope = getAdminScopeMeta(user)
  const iframeKey = `${user?.id ?? 'guest'}:${adminScope.foodBankId ?? 'platform'}:dashboard`
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  useEffect(() => {
    document.title = adminScope.foodBankName
      ? `Data Dashboard - ${adminScope.foodBankName}`
      : 'Data Dashboard - ABC Foodbank'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [adminScope.foodBankName])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !isDashboardPreviewSourceAvailable()) {
      return
    }

    return bindIframeSync(
      iframe,
      () =>
        syncAdminDataDashboardPreviewIframe({
          iframe,
          navigate,
          locationPathname: location.pathname,
          adminScope,
          accessToken,
          isAuthenticated,
          logout,
          setLoginModal,
        }),
      { syncBeforeLoad: true },
    )
  }, [
    accessToken,
    adminScope.foodBankId,
    adminScope.isLocalFoodBankAdmin,
    adminScope.roleLabel,
    isAuthenticated,
    location.pathname,
    logout,
    navigate,
  ])

  return (
    <AdminPreviewPageFrame
      iframeKey={iframeKey}
      iframeRef={iframeRef}
      iframeTitle="Data Dashboard Preview"
      srcDoc={dataDashboardAdminHtml}
      missingSourcePath="scripts/Data_dashboard.html"
      loginModal={loginModal}
      onCloseLoginModal={() => setLoginModal((state) => ({ ...state, open: false }))}
    />
  )
}
