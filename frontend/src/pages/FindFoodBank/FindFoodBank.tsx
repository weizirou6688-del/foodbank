import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PrimaryNavbar from '@/app/layout/PrimaryNavbar'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import type { FoodBank } from '@/shared/types/common'
import FoodBankMap from './FoodBankMap'

const getFoodBankKey = (foodBank: FoodBank) =>
  `${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`

const RESULTS_PER_PAGE = 3

export default function FindFoodBank() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  // This page keeps only visual state locally. Search data itself lives in the
  // store so it can be reused by the map and the package page.
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
  const [showLogin, setShowLogin] = useState(false)
  const [selectedFoodBankKey, setSelectedFoodBankKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    // Keep one selected result in sync with the current search results so card
    // highlighting and map marker emphasis always refer to the same location.
    if (searchResults.length === 0) {
      setSelectedFoodBankKey(null)
      return
    }

    setSelectedFoodBankKey((current) => {
      if (current && searchResults.some((foodBank) => getFoodBankKey(foodBank) === current)) {
        return current
      }
      return getFoodBankKey(searchResults[0])
    })
  }, [searchResults])

  useEffect(() => {
    // New searches always start from page 1 to avoid pagination carrying over
    // from a previous result set.
    setCurrentPage(1)
  }, [searchResults])

  const handleSearch = async () => {
    const trimmed = localPostcode.trim()
    if (!trimmed) return
    // We store the cleaned postcode centrally before firing the async search so
    // the UI and the store agree on which query is active.
    setSearchPostcode(trimmed)
    await searchFoodBanks(trimmed)
  }

  const handleViewPackages = (foodBank: FoodBank) => {
    // External search results do not always correspond to an internal
    // package-enabled bank, so invalid ids are blocked here.
    if (foodBank.id <= 0) {
      return
    }

    // The original package flow is login-protected, so the redesigned page
    // preserves that behaviour instead of routing anonymously.
    if (!isAuthenticated) {
      setShowLogin(true)
      return
    }

    selectFoodBank(foodBank)
    navigate('/food-packages')
  }

  const totalPages = Math.max(1, Math.ceil(searchResults.length / RESULTS_PER_PAGE))
  const displayedResults = searchResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE,
  )
  return (
    <>
      <div className="public-page-font min-h-screen bg-white flex flex-col">
        <PrimaryNavbar variant="public" />

        <div className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16 pb-8">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 mb-4">
                Find a food bank <span className="text-[#F5A623]">near you</span>
              </h1>
              <p className="max-w-3xl mx-auto text-base md:text-lg text-gray-600 leading-7">
                Search by postcode to see nearby locations, opening information, and whether a
                site can accept online package applications.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full flex-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Search by postcode</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter your postcode to find nearby food banks
            </p>
            <form
              className="flex gap-2 w-full"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSearch()
              }}
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  className="flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-white outline-none pr-10 border-gray-300 md:text-sm"
                  placeholder="e.g., SW1A 1AA"
                  value={localPostcode}
                  onChange={(event) => setLocalPostcode(event.target.value)}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 bg-[#F5A623] hover:bg-[#F5A623] text-gray-900 whitespace-nowrap disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Find Food Banks'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
                <h3 className="font-semibold text-gray-900 mb-4">Food bank locations</h3>
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Nearby food banks</h3>
                  <p className="text-sm text-gray-600">
                    {hasSearched
                      ? `Found ${searchResults.length} result(s)${localPostcode.trim() ? ` near ${localPostcode.trim()}` : ''}.`
                      : 'Run a postcode search to load nearby locations into the map and list.'}
                  </p>
                </div>

                <div className="space-y-4">
                  {displayedResults.map((foodBank) => {
                    const key = getFoodBankKey(foodBank)
                    const isSelected = selectedFoodBankKey === key
                    // Cards stay compact by showing only the first parsed
                    // opening-hours line even though the source can hold more.
                    const openingLine =
                      (foodBank.hours ?? []).length > 0
                        ? foodBank.hours?.[0] ?? 'Opening hours unavailable'
                        : 'Please contact this food bank directly'
                    // This secondary line guarantees that each card still shows
                    // one useful operational detail when some fields are missing.
                    const secondaryLine =
                      foodBank.phone
                        ? `Phone: ${foodBank.phone}`
                        : foodBank.email
                          ? `Email: ${foodBank.email}`
                          : foodBank.systemMatched
                            ? 'Online application available'
                            : 'Contact this location directly'

                    return (
                      <article
                        key={key}
                        className={`bg-card text-card-foreground flex flex-col gap-6 rounded-xl border hover:shadow-lg transition-shadow ${
                          isSelected
                            ? 'border-[#F5A623] shadow-lg'
                            : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedFoodBankKey(key)}
                      >
                        <div className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6">
                          <h4 className="leading-none flex items-start justify-between gap-2">
                            <div className="flex-1">
                              {foodBank.url ? (
                                <a
                                  href={foodBank.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="text-gray-900 hover:text-[#F5A623] transition-colors inline-flex items-center gap-2"
                                >
                                  {foodBank.name}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                    <path d="M15 3h6v6"></path>
                                    <path d="M10 14 21 3"></path>
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                  </svg>
                                </a>
                              ) : (
                                <span className="text-gray-900 inline-flex items-center gap-2">
                                  {foodBank.name}
                                </span>
                              )}
                            </div>
                          </h4>
                        </div>

                        <div className="px-6 [&:last-child]:pb-6 space-y-4">
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-[#F5A623]">
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>{foodBank.address}</span>
                          </div>

                          {(foodBank.hours ?? []).length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-[#F5A623]">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                              <span>{openingLine}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-[#F5A623]">
                              <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                            </svg>
                            <span>{secondaryLine}</span>
                          </div>

                          {(foodBank.phone || foodBank.email) && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-[#F5A623]">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                              </svg>
                              <span>{foodBank.phone ?? foodBank.email}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-[#F5A623]">
                              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>
                              {typeof foodBank.distance === 'number'
                                ? `${foodBank.distance.toFixed(2)} km away`
                                : 'Nearby location'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleViewPackages(foodBank)
                              }}
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border bg-background h-9 px-4 py-2 flex-1 border-[#F5A623] text-[#F5A623] hover:bg-[#F9F7F2]"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
                                <path d="M12 22V12"></path>
                                <polyline points="3.29 7 12 12 20.71 7"></polyline>
                                <path d="m7.5 4.27 9 5.15"></path>
                              </svg>
                              View packages
                            </button>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(foodBank.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-[#F5A623] hover:bg-[#F5A623] text-gray-900"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                              </svg>
                              Google Maps
                            </a>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                  {hasSearched && searchResults.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600 leading-6">
                      {searchError
                        ? `Search error: ${searchError}`
                        : 'No nearby food banks were found for this postcode. Try another postcode or a nearby area.'}
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => {
                      const pageNumber = index + 1
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`inline-flex items-center justify-center rounded-md border h-9 min-w-9 px-3 text-sm ${
                            currentPage === pageNumber
                              ? 'border-[#F5A623] bg-[#F5A623] text-gray-900'
                              : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <PublicSiteFooter />
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  )
}



