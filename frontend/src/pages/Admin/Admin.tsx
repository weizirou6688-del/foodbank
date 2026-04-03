import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminDataDashboardPreview from './AdminDataDashboardPreview'
import AdminFoodManagementPreview from './AdminFoodManagementPreview'

type Section = 'statistics' | 'food'

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

  if (section === 'food') {
    return <AdminFoodManagementPreview onSwitch={setSection} />
  }

  return <AdminDataDashboardPreview />
}
