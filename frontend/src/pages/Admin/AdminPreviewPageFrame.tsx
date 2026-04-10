import type { Ref } from 'react'
import LoginModal from '@/features/auth/components/LoginModal'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { ADMIN_PREVIEW_IFRAME_STYLE } from './adminPreviewFrame'

type LoginModalState = {
  open: boolean
  tab: 'signin' | 'register'
}

interface AdminPreviewPageFrameProps {
  iframeKey: string
  iframeRef: Ref<HTMLIFrameElement>
  iframeTitle: string
  srcDoc: string
  missingSourcePath: string
  loginModal: LoginModalState
  onCloseLoginModal: () => void
}

export default function AdminPreviewPageFrame({
  iframeKey,
  iframeRef,
  iframeTitle,
  srcDoc,
  missingSourcePath,
  loginModal,
  onCloseLoginModal,
}: AdminPreviewPageFrameProps) {
  if (!srcDoc.trim()) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-slate-600">
          Unable to load `{missingSourcePath}`. Save the file content and refresh this page.
        </div>
        <PublicSiteFooter />
        <LoginModal
          isOpen={loginModal.open}
          onClose={onCloseLoginModal}
          initialTab={loginModal.tab}
        />
      </>
    )
  }

  return (
    <>
      <iframe
        key={iframeKey}
        ref={iframeRef}
        title={iframeTitle}
        srcDoc={srcDoc}
        style={ADMIN_PREVIEW_IFRAME_STYLE}
      />
      <PublicSiteFooter />
      <LoginModal
        isOpen={loginModal.open}
        onClose={onCloseLoginModal}
        initialTab={loginModal.tab}
      />
    </>
  )
}
