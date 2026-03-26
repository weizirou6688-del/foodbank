import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFoodBankStore } from '@/store/foodBankStore'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const { setSearchPostcode, searchFoodBanks } = useFoodBankStore()
  const [postcode, setPostcode] = useState('')

  const handleSearch = async () => {
    if (!postcode.trim()) return
    setSearchPostcode(postcode)
    await searchFoodBanks(postcode)
    navigate('/find-foodbank')
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>COMMUNITY FIRST</span>
          <h1 className={styles.heroTitle}>
            Fighting Hunger,<br />
            Building <span>Community</span>
          </h1>
          <p className={styles.heroSub}>
            Find your nearest food bank, donate to those in need, or get support
            for your family — all in one place.
          </p>
          <div className={styles.heroCta}>
            <button
              className={styles.btnPrimary}
              onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Find a Food Bank
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => navigate('/donate/cash')}
            >
              Donate Now
            </button>
          </div>
        </div>
      </section>

      {/* ── Search ── */}
      <section className={styles.searchSection} id="search-section">
        <div className={styles.sectionLabel}>NEAR YOU</div>
        <h2 className={styles.sectionTitle}>Find Your Nearest Food Bank</h2>
        <p className={styles.sectionSub}>Enter your postcode to see food banks within 2 miles.</p>
        <div className={styles.searchBar}>
          <input
            className={styles.postcodeInput}
            placeholder="e.g. SW1A 1AA"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className={styles.searchBtn} onClick={handleSearch}>Search</button>
        </div>
      </section>

      {/* ── How You Can Help ── */}
      <section className={styles.helpSection}>
        <h2 className={styles.helpTitle}>How You Can Help</h2>
        <p className={styles.helpSub}>Every contribution makes a real difference to families in need.</p>
        <div className={styles.helpGrid}>

          {/* Cash — dark card */}
          <div className={styles.cashCard}>
            <div className={styles.cardIconWrap}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.cardIcon}>
                <circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M9 9h4a2 2 0 0 1 0 4H9v2h6"/>
              </svg>
            </div>
            <h3 className={styles.cashCardTitle}>Donate Cash</h3>
            <p className={styles.cashCardDesc}>
              100% of your donation goes directly to supporting local families in need.
            </p>
            <button className={styles.cashCardBtn} onClick={() => navigate('/donate/cash')}>
              Donate Now
            </button>
          </div>

          {/* Goods — yellow card */}
          <div className={styles.goodsCard}>
            <div className={styles.cardIconWrap}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.cardIconDark}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <h3 className={styles.goodsCardTitle}>Donate Goods</h3>
            <p className={styles.goodsCardDesc}>
              Donate non-perishable food items and toiletries to your local food bank.
            </p>
            <button className={styles.goodsCardBtn} onClick={() => navigate('/donate/goods')}>
              Donate Goods
            </button>
          </div>

        </div>
      </section>

    </div>
  )
}
