import { useLocation } from 'react-router-dom'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

export default function Footer() {
  const location = useLocation()
  const isFindFoodBankPage = location.pathname === '/find-foodbank'
  const isAdminPage = location.pathname === '/admin'
  const isStandalonePreviewPage =
    location.pathname === '/food-management-preview' ||
    location.pathname === '/data-dashboard-preview'

  if (isFindFoodBankPage || isAdminPage || isStandalonePreviewPage) {
    return null
  }

  return <PublicSiteFooter />
}
