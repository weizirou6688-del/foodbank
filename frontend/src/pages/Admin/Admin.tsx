import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminDataDashboardPreview from './AdminDataDashboardPreview'
import AdminFoodManagementPreview from './AdminFoodManagementPreview'

type Section = 'statistics' | 'food'

export default function Admin() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('statistics')

  useEffect(() => {
    const s = searchParams.get('section')
    if (s === 'food') {
      setSection('food')
      return
    }

    setSection('statistics')
  }, [searchParams])

  if (section === 'food') {
    return <AdminFoodManagementPreview onSwitch={setSection} />
  }

  return <AdminDataDashboardPreview />
}
