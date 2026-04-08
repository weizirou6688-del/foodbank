import { useLocation } from 'react-router-dom'
import PrimaryNavbar from './PrimaryNavbar'

export default function Navbar() {
  const location = useLocation()
  const hiddenPaths = new Set([
    '/home',
    '/find-foodbank',
    '/admin',
    '/admin-food-management',
    '/admin-statistics',
    '/supermarket',
  ])

  if (hiddenPaths.has(location.pathname)) {
    return null
  }

  return <PrimaryNavbar variant="public" />
}
