import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import type { FoodBank } from '@/shared/types/common'
import FoodBankMap from './FoodBankMap'

const getFoodBankKey = (foodBank: FoodBank) =>
  `${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`

const RESULTS_PER_PAGE = 3

export default function FindFoodBank() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
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
    setCurrentPage(1)
  }, [searchResults])

  const handleSearch = async () => {
    const trimmed = localPostcode.trim()
    if (!trimmed) return
    setSearchPostcode(trimmed)
    await searchFoodBanks(trimmed)
  }

  const handleViewPackages = (foodBank: FoodBank) => {
    if (foodBank.id <= 0) {
      return
    }

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
      <div className="home-figma-font min-h-screen bg-white flex flex-col">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-xl font-semibold text-gray-900"
                >
                  ABC Foodbank
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => navigate('/donate/cash')}
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
                >
                  Donate Cash
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/donate/goods')}
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
                >
                  Donate Goods
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/find-foodbank')}
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
                >
                  Get Supports
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm"
                >
                  Volunteering
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all h-9 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-sm font-medium px-4"
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogin(true)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all border bg-background hover:bg-accent h-9 px-4 py-2 border-gray-300 text-sm"
                >
                  Sign In
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="lg:hidden inline-flex items-center justify-center rounded-md size-9"
                aria-label="Sign in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        <div className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                Food security, <span className="text-yellow-500">engineered</span>
              </h1>
              <p className="text-base text-gray-600">
                Search by postcode to find food banks near you, check opening information, and see
                whether a location can accept online package applications.
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
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 whitespace-nowrap disabled:opacity-50"
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
                    const openingLine =
                      (foodBank.hours ?? []).length > 0
                        ? foodBank.hours?.[0] ?? 'Opening hours unavailable'
                        : 'Please contact this food bank directly'
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
                            ? 'border-yellow-500 shadow-lg'
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
                                  className="text-gray-900 hover:text-yellow-600 transition-colors inline-flex items-center gap-2"
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-yellow-600">
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>{foodBank.address}</span>
                          </div>

                          {(foodBank.hours ?? []).length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-yellow-600">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                              <span>{openingLine}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-yellow-600">
                              <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                            </svg>
                            <span>{secondaryLine}</span>
                          </div>

                          {(foodBank.phone || foodBank.email) && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-yellow-600">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                              </svg>
                              <span>{foodBank.phone ?? foodBank.email}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 mt-0.5 flex-shrink-0 text-yellow-600">
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
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border bg-background h-9 px-4 py-2 flex-1 border-yellow-600 text-yellow-600 hover:bg-yellow-50"
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
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all h-9 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900"
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
                              ? 'border-yellow-500 bg-yellow-400 text-gray-900'
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

        <footer className="bg-gray-900 text-white mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 pb-12 border-b border-gray-800">
              <div>
                <h2 className="text-2xl font-bold mb-4">ABC Foodbank</h2>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  Building the infrastructure for food security. A transparent platform connecting
                  communities with local resources.
                </p>
                <div className="mb-6">
                  <h3 className="text-white font-semibold mb-2 text-sm uppercase tracking-wide">
                    Contact Office
                  </h3>
                  <p className="text-gray-400 text-sm">Penglais, Aberystwyth SY23 3FL</p>
                </div>
                <div className="flex gap-3">
                  <a href="#twitter" className="bg-gray-800 hover:bg-gray-700 p-2 rounded transition-colors" aria-label="Twitter">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a href="#linkedin" className="bg-gray-800 hover:bg-gray-700 p-2 rounded transition-colors" aria-label="LinkedIn">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                  <a href="#instagram" className="bg-gray-800 hover:bg-gray-700 p-2 rounded transition-colors" aria-label="Instagram">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                <div>
                  <h3 className="font-semibold mb-4 text-white text-sm uppercase tracking-wide">
                    Platform
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      <button type="button" onClick={() => navigate('/donate/cash')} className="hover:text-white transition-colors">
                        Donate Cash
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => navigate('/donate/goods')} className="hover:text-white transition-colors">
                        Donate Goods
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => navigate('/find-foodbank')} className="hover:text-white transition-colors">
                        Get Supports
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => navigate('/')} className="hover:text-white transition-colors">
                        Volunteering
                      </button>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 text-white text-sm uppercase tracking-wide">
                    Resources
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      <button type="button" onClick={() => setShowLogin(true)} className="hover:text-white transition-colors">
                        Sign In
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => navigate('/')} className="hover:text-white transition-colors">
                        Volunteer
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={() => navigate('/')} className="hover:text-white transition-colors">
                        Support
                      </button>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 text-white text-sm uppercase tracking-wide">
                    Legal
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      <a href="#privacy" className="hover:text-white transition-colors">
                        Privacy
                      </a>
                    </li>
                    <li>
                      <a href="#security" className="hover:text-white transition-colors">
                        Security
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">© 2026 ABC Foodbank. All rights reserved.</p>
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>
        </footer>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  )
}
