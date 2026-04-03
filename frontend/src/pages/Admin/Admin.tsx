import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminStatistics from './AdminStatistics'
import AdminFoodManagementPreview from './AdminFoodManagementPreview'

type Section = 'statistics' | 'food'

export default function Admin() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('food')

  useEffect(() => {
    const s = searchParams.get('section')
    if (s === 'statistics') {
      setSection('statistics')
      return
    }

    setSection('food')
  }, [searchParams])

  if (section === 'food') {
    return <AdminFoodManagementPreview onSwitch={setSection} />
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {section === 'statistics' && <AdminStatistics onSwitch={setSection} />}
      </main>
    </div>
  )
}
