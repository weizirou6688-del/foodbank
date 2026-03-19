import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useFoodBankStore } from '@/store/foodBankStore'
import { useAuthStore } from '@/store/authStore'
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
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Find a Food Bank</h1>
          <p className={styles.pageSub}>Enter your postcode to find food banks within 2 miles of you.</p>
        </div>

        <div className={styles.main}>
          {/* Search */}
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
              <button className={styles.searchBtn} onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching…' : 'Find Food Banks'}
              </button>
            </div>
          </div>

          {/* Results */}
          {hasSearched && (
            searchResults.length > 0 ? (
              <>
                <p className={styles.resultsCount}>
                  Found <strong>{searchResults.length}</strong> food bank(s) near <strong>{localPostcode}</strong>
                </p>
                <div className={styles.fbGrid}>
                  {searchResults.map((fb) => (
                    <div key={fb.id} className={styles.fbCard}>
                      <h3 className={styles.fbName}>{fb.name}</h3>
                      <p className={styles.fbAddr}>{fb.address}</p>
                      <span className={styles.distanceBadge}>{fb.distance} km away</span>
                      <div className={styles.fbHours}>
                        <strong>Opening Hours</strong>
                        {fb.hours.map((h) => <p key={h}>{h}</p>)}
                      </div>
                      <div className={styles.fbActions}>
                        <button className={styles.viewBtn} onClick={() => handleViewPackages(fb)}>
                          View Food Packages
                        </button>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fb.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          className={styles.mapLink}
                        >
                          <MapPin size={13} /> Google Maps
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="#D1D5DB" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <p>No food banks found near this postcode. Try a different area.</p>
              </div>
            )
          )}

          {!hasSearched && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="#D1D5DB" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              <p>Enter your postcode above to discover nearby food banks.</p>
            </div>
          )}
        </div>
      </div>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  )
}
