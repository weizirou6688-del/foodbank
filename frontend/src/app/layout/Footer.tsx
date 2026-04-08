import { useLocation } from 'react-router-dom'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'

export default function Footer() {
  const location = useLocation()
  const isFindFoodBankPage = location.pathname === '/find-foodbank'
  const isAdminPage = location.pathname === '/admin'
  const isStandaloneAdminPage =
    location.pathname === '/admin-food-management' ||
    location.pathname === '/admin-statistics'

  if (isFindFoodBankPage || isAdminPage || isStandaloneAdminPage) {
    return null
  }

  return <PublicSiteFooter />
}
