import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import LoginModal from '@/features/auth/components/LoginModal'
import type { FoodBank } from '@/shared/types/foodBanks'
import { MapPin, Search } from '@/shared/ui/InlineIcons'
import PublicPageShell from '@/shared/ui/PublicPageShell'
import FoodBankMap from './FoodBankMap'

const RESULTS_PER_PAGE = 3
const DETAIL_ROW_CLASS_NAME = 'flex items-start gap-2 text-sm text-gray-600'
const DETAIL_ICON_CLASS_NAME = 'mt-0.5 size-4 shrink-0 text-[#F5A623]'

const getFoodBankKey = (foodBank: FoodBank) => `${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`
const getSecondaryLine = (foodBank: FoodBank) => (foodBank.systemMatched ? 'Online application available' : 'Contact this location directly')
const getDistanceLabel = (foodBank: FoodBank) => (typeof foodBank.distance === 'number' ? `${foodBank.distance.toFixed(2)} km away` : 'Nearby location')

function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  )
}

const ExternalLinkIcon = () => <Icon><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>
const MailIcon = () => <Icon className={DETAIL_ICON_CLASS_NAME}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></Icon>
const PhoneIcon = () => <Icon className={DETAIL_ICON_CLASS_NAME}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Icon>
const DistanceIcon = () => <Icon className={DETAIL_ICON_CLASS_NAME}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></Icon>
const PackagesIcon = () => <Icon><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><polyline points="3.29 7 12 12 20.71 7" /><path d="m7.5 4.27 9 5.15" /></Icon>
const GoogleMapsIcon = () => <Icon><polygon points="3 11 22 2 13 21 11 13 3 11" /></Icon>

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className={DETAIL_ROW_CLASS_NAME}>{icon}<span>{children}</span></div>
}

function FoodBankResultCard({
  foodBank,
  isSelected,
  onSelect,
  onViewPackages,
}: {
  foodBank: FoodBank
  isSelected: boolean
  onSelect: () => void
  onViewPackages: (foodBank: FoodBank) => void
}) {
  const details = [
    { key: 'address', icon: <MapPin className={DETAIL_ICON_CLASS_NAME} />, text: foodBank.address },
    { key: 'status', icon: <MailIcon />, text: getSecondaryLine(foodBank) },
    ...(foodBank.phone || foodBank.email ? [{ key: 'contact', icon: <PhoneIcon />, text: foodBank.phone ?? foodBank.email ?? '' }] : []),
    { key: 'distance', icon: <DistanceIcon />, text: getDistanceLabel(foodBank) },
  ]

  return (
    <article
      className={`flex flex-col gap-6 rounded-xl border bg-white px-6 py-6 text-card-foreground transition-shadow hover:shadow-lg ${isSelected ? 'border-[#F5A623] shadow-lg' : 'border-gray-200'}`}
      onClick={onSelect}
    >
      <h4 className="leading-none flex items-start justify-between gap-2">
        <div className="flex-1 text-gray-900">
          {foodBank.url ? (
            <a
              href={foodBank.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-2 transition-colors hover:text-[#F5A623]"
            >
              {foodBank.name}
              <ExternalLinkIcon />
            </a>
          ) : foodBank.name}
        </div>
      </h4>
      <div className="space-y-4">
        {details.map(({ key, icon, text }) => <DetailRow key={key} icon={icon}>{text}</DetailRow>)}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onViewPackages(foodBank)
            }}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-[#F5A623] bg-background px-4 py-2 text-sm font-medium text-[#F5A623] transition-all hover:bg-[#F9F7F2]"
          >
            <PackagesIcon />
            View packages
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(foodBank.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#F5A623] px-4 py-2 text-sm font-medium text-gray-900"
          >
            <GoogleMapsIcon />
            Google Maps
          </a>
        </div>
      </div>
    </article>
  )
}

function PaginationControls({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const buttons: Array<{ key: string; label: string; page: number; disabled?: boolean; active?: boolean }> = [
    { key: 'prev', label: 'Prev', page: Math.max(1, currentPage - 1), disabled: currentPage === 1 },
    ...Array.from({ length: totalPages }, (_, index) => ({ key: `page-${index + 1}`, label: String(index + 1), page: index + 1, active: currentPage === index + 1 })),
    { key: 'next', label: 'Next', page: Math.min(totalPages, currentPage + 1), disabled: currentPage === totalPages },
  ]
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {buttons.map(({ key, label, page, disabled = false, active = false }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPageChange(page)}
          disabled={disabled}
          className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm ${active ? 'border-[#F5A623] bg-[#F5A623] text-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function FindFoodBank() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const {
    searchPostcode,
    searchResults,
    searchedLocation,
    hasSearched,
    isSearching,
    searchError,
    setSearchPostcode,
    searchFoodBanks,
    selectFoodBank,
  } = useFoodBankStore()
  const [localPostcode, setLocalPostcode] = useState(searchPostcode)
  const [selectedFoodBankKey, setSelectedFoodBankKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
    setSelectedFoodBankKey((current) => {
      if (current && searchResults.some((foodBank) => getFoodBankKey(foodBank) === current)) {
        return current
      }
      return searchResults[0] ? getFoodBankKey(searchResults[0]) : null
    })
  }, [searchResults])

  const handleSearch = async () => {
    const trimmed = localPostcode.trim()
    if (!trimmed) return
    setSearchPostcode(trimmed)
    await searchFoodBanks(trimmed)
  }

  const handleViewPackages = (foodBank: FoodBank) => {
    if (foodBank.id <= 0) return
    selectFoodBank(foodBank)

    if (!isAuthenticated) {
      setIsLoginModalOpen(true)
      return
    }

    navigate('/food-packages')
  }

  const totalPages = Math.max(1, Math.ceil(searchResults.length / RESULTS_PER_PAGE))
  const displayedResults = searchResults.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)
  const summary = hasSearched
    ? `Found ${searchResults.length} result(s)${localPostcode.trim() ? ` near ${localPostcode.trim()}` : ''}.`
    : 'Run a postcode search to load nearby locations into the map and list.'

  return (
    <>
      <PublicPageShell>
        <div className="bg-white">
          <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8 md:pt-16">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="mb-4 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
                Find a food bank <span className="text-gray-900">near you</span>
              </h1>
              <p className="mx-auto max-w-3xl text-base leading-7 text-gray-600 md:text-lg">
                Search by postcode to see nearby locations and whether a site can accept online package applications.
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto flex-1 w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">Search by postcode</h2>
            <p className="mb-4 text-sm text-gray-600">Enter your postcode to find nearby food banks</p>
            <form className="flex w-full gap-2" onSubmit={(event) => { event.preventDefault(); void handleSearch() }}>
              <div className="relative flex-1">
                <input
                  type="text"
                  className="flex h-9 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-1 pr-10 text-base outline-none md:text-sm"
                  placeholder="e.g., SW1A 1AA"
                  value={localPostcode}
                  onChange={(event) => setLocalPostcode(event.target.value)}
                />
                <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              </div>
              <button type="submit" disabled={isSearching} className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#F5A623] px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50">
                {isSearching ? 'Searching...' : 'Find Food Banks'}
              </button>
            </form>
          </div>
          <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 font-semibold text-gray-900">Food bank locations</h3>
                <div className="flex-1" style={{ minHeight: '760px' }}>
                  <FoodBankMap
                    foodBanks={searchResults}
                    searchedLocation={searchedLocation}
                    selectedFoodBankKey={selectedFoodBankKey}
                    onSelectFoodBank={(foodBank) => setSelectedFoodBankKey(getFoodBankKey(foodBank))}
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h3 className="mb-4 font-semibold text-gray-900">Nearby food banks</h3>
                  <p className="text-sm text-gray-600">{summary}</p>
                </div>
                <div className="space-y-4">
                  {displayedResults.map((foodBank) => {
                    const key = getFoodBankKey(foodBank)
                    return (
                      <FoodBankResultCard
                        key={key}
                        foodBank={foodBank}
                        isSelected={selectedFoodBankKey === key}
                        onSelect={() => setSelectedFoodBankKey(key)}
                        onViewPackages={handleViewPackages}
                      />
                    )
                  })}
                  {hasSearched && searchResults.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm leading-6 text-gray-600">
                      {searchError ? `Search error: ${searchError}` : 'No nearby food banks were found for this postcode. Try another postcode or a nearby area.'}
                    </div>
                  ) : null}
                </div>
                <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            </div>
          </div>
        </div>
      </PublicPageShell>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialTab="signin"
        redirectTo="/food-packages"
      />
    </>
  )
}
