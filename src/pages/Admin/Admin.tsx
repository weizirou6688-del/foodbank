import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminStatistics from './AdminStatistics'
import AdminFoodManagement from './AdminFoodManagement'

type Section = 'statistics' | 'food'

export default function Admin() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('statistics')

  useEffect(() => {
    const s = searchParams.get('section')
    if (s === 'food' || s === 'statistics') setSection(s)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {section === 'statistics' && <AdminStatistics onSwitch={setSection} />}
        {section === 'food'       && <AdminFoodManagement onSwitch={setSection} />}
      </main>
    </div>
  )
}
