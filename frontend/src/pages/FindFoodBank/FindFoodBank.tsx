import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useFoodBankStore } from '@/store/foodBankStore'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LoginModal from '@/components/auth/LoginModal'
import type { FoodBank } from '@/types'
import styles from './FindFoodBank.module.css'

export default function FindFoodBank() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { searchPostcode, searchResults, hasSearched, isSearching, setSearchPostcode, searchFoodBanks, selectFoodBank } = useFoodBankStore()
  const [localPostcode, setLocalPostcode] = useState(searchPostcode)
  const [showLogin, setShowLogin] = useState(false)

  const handleSearch = async () => {
    if (!localPostcode.trim()) return
    setSearchPostcode(localPostcode)
    await searchFoodBanks(localPostcode)
  }

  const handleViewPackages = (fb: FoodBank) => {
    if (!isAuthenticated) { setShowLogin(true); return }
    selectFoodBank(fb)
    navigate('/food-packages')
  }

  return (
    <>
      <div className={styles.page}>
        {/* Page hero */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Find a Food Bank</h1>
          <p className={styles.heroSub}>Enter your postcode to find food banks within 2 miles of you.</p>
        </div>

        <div className={styles.main}>
          {/* Search card */}
          <div className={styles.searchCard}>
            <h2 className={styles.searchTitle}>Search by Postcode</h2>
            <div className={styles.searchRow}>
              <input
                className={styles.postcodeInput}
                placeholder="e.g. SW1A 1AA"
                value={localPostcode}
                onChange={(e) => setLocalPostcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} loading={isSearching} size="lg">
                {isSearching ? 'Searching…' : 'Find Food Banks'}
              </Button>
            </div>
          </div>

          {/* Results */}
          {hasSearched && (
            <>
              {searchResults.length > 0 ? (
                <>
                  <p className={styles.resultsCount}>
                    Found <strong>{searchResults.length}</strong> food bank(s) near <strong>{localPostcode}</strong>
                  </p>
                  <div className={styles.fbGrid}>
                    {searchResults.map((fb) => (
                      <div key={fb.id} className={styles.fbCard}>
                        <h3 className={styles.fbName}>{fb.name}</h3>
                        <p className={styles.fbAddr}>{fb.address}</p>
                        <Badge variant="teal">
                          {typeof fb.distance === 'number' ? `${fb.distance} km away` : 'Nearby'}
                        </Badge>

                        <div className={styles.fbHours}>
                          <strong>Opening Hours</strong>
                          {(fb.hours ?? []).length > 0
                            ? (fb.hours ?? []).map((h) => <p key={h}>{h}</p>)
                            : <p>Please contact this food bank for opening hours.</p>}
                        </div>

                        <div className={styles.fbActions}>
                          <Button size="sm" onClick={() => handleViewPackages(fb)}>
                            View Food Packages
                          </Button>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fb.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.mapLink}
                          >
                            <MapPin size={14} />
                            Google Maps
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}></span>
                  <p>No food banks found near this postcode. Try a different area.</p>
                </div>
              )}
            </>
          )}

          {!hasSearched && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}></span>
              <p>Enter your postcode above to discover nearby food banks.</p>
            </div>
          )}
        </div>
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  )
}
