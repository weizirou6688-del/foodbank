import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import AdminPreviewPageFrame from './AdminPreviewPageFrame'
import { bindIframeSync } from './adminPreviewFrame'
import {
  isFoodManagementPreviewSourceAvailable,
  referenceHtmlWithoutScripts,
} from './adminFoodManagementPreview.source'
import { syncAdminFoodManagementPreviewIframe } from './adminFoodManagementPreview.runtime'

interface Props {
  onSwitch?: (s: 'statistics' | 'food') => void
}

export default function AdminFoodManagementPreview({ onSwitch: _onSwitch }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)
  const adminScope = getAdminScopeMeta(user)
  const iframeKey = `${user?.id ?? 'guest'}:${adminScope.foodBankId ?? 'platform'}:food`
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  useEffect(() => {
    document.title = adminScope.foodBankName
      ? `Food Management - ${adminScope.foodBankName}`
      : 'Inventory Management - ABC Foodbank'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [adminScope.foodBankName])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !isFoodManagementPreviewSourceAvailable()) {
      return
    }

    return bindIframeSync(iframe, () =>
      syncAdminFoodManagementPreviewIframe({
        iframe,
        navigate,
        adminScope,
        accessToken,
        isAuthenticated,
        logout,
        setLoginModal,
      }),
    )
  }, [
    accessToken,
    adminScope.foodBankId,
    adminScope.isLocalFoodBankAdmin,
    adminScope.roleLabel,
    isAuthenticated,
    logout,
    navigate,
  ])

  return (
    <AdminPreviewPageFrame
      iframeKey={iframeKey}
      iframeRef={iframeRef}
      iframeTitle="Food Management Preview"
      srcDoc={referenceHtmlWithoutScripts}
      missingSourcePath="scripts/food_management.html"
      loginModal={loginModal}
      onCloseLoginModal={() => setLoginModal((state) => ({ ...state, open: false }))}
    />
  )
}
