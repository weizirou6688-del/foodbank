import { useState, useEffect, useRef } from 'react'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import { useAuthStore } from '@/app/store/authStore'
import { WEEKLY_COLLECTION_LIMIT } from '@/shared/config/businessRules'
import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import styles from './FoodPackages.module.css'
const DEFAULT_PKG_IMAGES = [
  'https://images.unsplash.com/photo-1559837957-bab8edc53c85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80',
  'https://images.unsplash.com/photo-1714224247661-ee250f55a842?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80',
  'https://images.unsplash.com/photo-1653174577821-9ab410d92d44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80',
  'https://images.unsplash.com/photo-1599297914860-1ccd36987a52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600&q=80',
]

const MAX_INDIVIDUAL = 5
const ITEMS_PER_PAGE = 6

interface Selection { packageId: number; qty: number }

interface ItemSelection { itemId: number; qty: number }

export default function FoodPackages() {
  const { user } = useAuthStore()
  const {
    selectedFoodBank,
    packages,
    availableItems,
    weeklyCollected,
    loadUserCollections,
    loadPackages,
    loadAvailableItems,
    applyPackages,
  } = useFoodBankStore()

  const [pkgQty, setPkgQty] = useState<Record<number, number>>({})
  const [foodSel, setFoodSel] = useState<Record<string, number>>({})
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (user) loadUserCollections(user.email) }, [user, loadUserCollections])
  useEffect(() => {
    let cancelled = false
    setIsBootstrapping(true)

    Promise.allSettled([loadPackages(), loadAvailableItems()]).then((results) => {
      if (cancelled) {
        return
      }

      const firstFailure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      )

      if (firstFailure) {
        const reason = firstFailure.reason
        setErrorMsg(reason instanceof Error ? reason.message : 'Failed to load food support options')
      }

      setIsBootstrapping(false)
    })

    return () => {
      cancelled = true
    }
  }, [selectedFoodBank?.id, loadPackages, loadAvailableItems])

  useEffect(() => {
    const categoryExists = availableItems.some((item) => item.category === category)
    if (category !== 'All' && !categoryExists) {
      setCategory('All')
      setPage(1)
    }
  }, [availableItems, category])

  const remainingPackageSlots = Math.max(0, WEEKLY_COLLECTION_LIMIT - weeklyCollected)

  useEffect(() => {
    if (showSuccess) {
      return
    }

    setPkgQty((prev) => {
      const packagesById = new Map(packages.map((pkg) => [pkg.id, pkg]))
      let remainingSlots = remainingPackageSlots
      let changed = false
      const next: Record<number, number> = {}

      for (const [rawId, rawQty] of Object.entries(prev)) {
        const packageId = Number(rawId)
        const pkg = packagesById.get(packageId)

        if (!pkg || pkg.stock <= 0 || remainingSlots <= 0) {
          changed = true
          continue
        }

        const cappedQty = Math.min(rawQty, pkg.stock, remainingSlots)
        if (cappedQty !== rawQty) {
          changed = true
        }

        if (cappedQty > 0) {
          next[packageId] = cappedQty
          remainingSlots -= cappedQty
        }
      }

      return changed ? next : prev
    })
  }, [packages, remainingPackageSlots, showSuccess])

  useEffect(() => {
    if (showSuccess) {
      return
    }

    setFoodSel((prev) => {
      const itemsById = new Map(availableItems.map((item) => [String(item.id), item]))
      let selectedTypes = 0
      let changed = false
      const next: Record<string, number> = {}

      for (const [itemId, rawQty] of Object.entries(prev)) {
        const item = itemsById.get(itemId)
        if (!item || item.stock <= 0 || selectedTypes >= MAX_INDIVIDUAL) {
          changed = true
          continue
        }

        const cappedQty = Math.min(rawQty, item.stock, MAX_INDIVIDUAL)
        if (cappedQty !== rawQty) {
          changed = true
        }

        if (cappedQty > 0) {
          next[itemId] = cappedQty
          selectedTypes += 1
        }
      }

      return changed ? next : prev
    })
  }, [availableItems, showSuccess])

  useEffect(() => {
    if (errorMsg && !showSuccess) {
      setErrorMsg('')
    }
  }, [pkgQty, foodSel])

  const foodBank = selectedFoodBank
  const displayPackages = packages
  const categories = ['All', ...Array.from(new Set(availableItems.map((item) => item.category)))]
  const totalPkgs = Object.values(pkgQty).reduce((s, q) => s + q, 0)
  const remaining = remainingPackageSlots
  const totalFoods = Object.keys(foodSel).length
  const totalFoodUnits = Object.values(foodSel).reduce((sum, qty) => sum + qty, 0)
  const atFoodLimit = totalFoods >= MAX_INDIVIDUAL
  const packageLimitReached = remainingPackageSlots === 0
  const interactionsDisabled = isBootstrapping || loading || showSuccess
  const filteredFoods = category === 'All'
    ? availableItems
    : availableItems.filter((item) => item.category === category)
  const totalPages = Math.ceil(filteredFoods.length / ITEMS_PER_PAGE)
  const pagedFoods = filteredFoods.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const hasAny = totalPkgs > 0 || totalFoods > 0

  useEffect(() => {
    if (totalPages === 0 && page !== 1) {
      setPage(1)
      return
    }

    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  if (isBootstrapping && !foodBank) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ maxWidth: 720, margin: '5rem auto', background: '#F2F4F3', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.5rem' }}>Loading Food Support Options</h2>
          <p style={{ fontSize: '1rem', color: '#6B7280' }}>Connecting this page to the live backend and database.</p>
        </div>
      </div>
    )
  }

  if (!foodBank) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ maxWidth: 720, margin: '5rem auto', background: '#F2F4F3', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.5rem' }}>No Connected Food Bank Available</h2>
          <p style={{ fontSize: '1rem', color: '#6B7280' }}>The backend did not return a food bank for online applications.</p>
        </div>
      </div>
    )
  }
  const changePkgQty = (id: number, delta: number, maxStock: number) => {
    if (interactionsDisabled) {
      return
    }

    setPkgQty(prev => {
      const cur = prev[id] || 0
      const curTotal = Object.values(prev).reduce((s, q) => s + q, 0)
      if (delta > 0 && (cur >= maxStock || curTotal >= remainingPackageSlots)) return prev
      const next = cur + delta
      if (next <= 0) { const c = { ...prev }; delete c[id]; return c }
      return { ...prev, [id]: next }
    })
  }
  const toggleFood = (id: string) => {
    if (interactionsDisabled) {
      return
    }

    setFoodSel(prev => {
      if (prev[id]) { const c = { ...prev }; delete c[id]; return c }
      if (Object.keys(prev).length >= MAX_INDIVIDUAL) return prev
      return { ...prev, [id]: 1 }
    })
  }
  const changeFoodQty = (id: string, delta: number, max: number) => {
    if (interactionsDisabled) {
      return
    }

    setFoodSel(prev => {
      const cur = prev[id] || 0; const next = cur + delta
      if (next <= 0) { const c = { ...prev }; delete c[id]; return c }
      if (next > MAX_INDIVIDUAL || next > max) return prev
      return { ...prev, [id]: next }
    })
  }

  const handleApply = async () => {
    setErrorMsg('')
    if (interactionsDisabled) { return }
    if (!user?.email) { setErrorMsg('Please sign in to submit an application.'); return }
    if (!hasAny) { setErrorMsg('Please select at least one package or item.'); return }
    if (totalPkgs > remainingPackageSlots) {
      setErrorMsg(`You can only request ${remainingPackageSlots} more package${remainingPackageSlots === 1 ? '' : 's'} this week.`)
      return
    }
    const selArray: Selection[] = Object.entries(pkgQty).map(([id, qty]) => ({ packageId: Number(id), qty }))
    const itemArray: ItemSelection[] = Object.entries(foodSel).map(([id, qty]) => ({ itemId: Number(id), qty }))
    setLoading(true)
    try {
      const result = await applyPackages(user.email, selArray, undefined, itemArray)
      if (!result.success) {
        setErrorMsg(result.message)
        return
      }

      if (!result.code) {
        setErrorMsg('Application succeeded but no redemption code was returned.')
        return
      }

      setShowSuccess(true)
      setRedemptionCode(result.code)
      setTimeout(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : 'Application failed') }
    finally { setLoading(false) }
  }

  const handleNewApplication = () => {
    setShowSuccess(false); setRedemptionCode(''); setPkgQty({}); setFoodSel({}); setErrorMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  let summaryTxt = ''
  if (totalPkgs > 0) summaryTxt += `${totalPkgs} package${totalPkgs > 1 ? 's' : ''}`
  if (totalPkgs > 0 && totalFoods > 0) summaryTxt += ' + '
  if (totalFoods > 0) {
    summaryTxt += `${totalFoods} item type${totalFoods > 1 ? 's' : ''}`
    if (totalFoodUnits > totalFoods) {
      summaryTxt += ` (${totalFoodUnits} units)`
    }
  }

  return (
    <div className={styles.pageWrap}>
      <main className="flex-1 px-6 py-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold mb-4" style={{ color: '#1A1A1A', fontFamily: FONT }}>{`Your Gift Feeds Families`}</h2>
            <p className="text-lg mb-8 max-w-3xl mx-auto" style={{ color: '#6B7280' }}>
              Every request helps us provide food directly to local families in need. No admin fees, 100 percent impact.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 mb-8">
              {[
                `Up to ${WEEKLY_COLLECTION_LIMIT} packages per week`,
                `Up to ${MAX_INDIVIDUAL} individual items weekly`,
                '100 percent goes to families in need',
              ].map(txt => (
                <div key={txt} className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                  <span className="text-sm" style={{ color: '#1A1A1A' }}>{txt}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <button className="px-6 py-3 rounded-lg font-medium transition-colors" style={{ backgroundColor: '#F5A623', color: '#1A1A1A', fontSize: 14 }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#D4870A')} onMouseOut={e => (e.currentTarget.style.backgroundColor = '#F5A623')}
                onClick={() => document.getElementById('section-packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >Food Packages</button>
              <button className="px-6 py-3 rounded-lg font-medium transition-colors" style={{ backgroundColor: '#F5A623', color: '#1A1A1A', fontSize: 14 }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#D4870A')} onMouseOut={e => (e.currentTarget.style.backgroundColor = '#F5A623')}
                onClick={() => document.getElementById('section-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >Individual Food Items</button>
            </div>
          </div>
          <div className="rounded-xl p-5 mb-6 flex items-center justify-between" style={{ backgroundColor: '#F2F4F3' }}>
            <div>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A', fontFamily: FONT }}>{foodBank.name}</h3>
              <p className="text-xs" style={{ color: '#6B7280' }}>{foodBank.address}</p>
            </div>
            <div className="px-5 py-3 rounded-lg text-center" style={{ backgroundColor: '#F5A623', minWidth: 100 }}>
              <div className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{remaining}</div>
              <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: '#1A1A1A' }}>Remaining</div>
            </div>
          </div>
          <div className="rounded-lg p-3 mb-8 text-sm border" style={{ backgroundColor: '#F2F4F3', color: '#1A1A1A', borderColor: '#E5E7EB' }}>
            Maximum <strong>{WEEKLY_COLLECTION_LIMIT} packages</strong> per week. This week: <strong style={{ color: '#F5A623' }}>{weeklyCollected}/{WEEKLY_COLLECTION_LIMIT}</strong> used, with <strong>{remainingPackageSlots}</strong> package slot{remainingPackageSlots === 1 ? '' : 's'} left.
          </div>

          {errorMsg && (
            <div className="rounded-lg p-3 mb-4 text-sm border" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}>{errorMsg}</div>
          )}
          <div id="section-packages" className="mb-12" style={{ scrollMarginTop: '1.5rem' }}>
            <div className="mb-5">
              <h3 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A', fontFamily: FONT }}>Food Packages</h3>
              <p className="text-sm" style={{ color: '#6B7280' }}>Pre-made packages with essential items. You can request up to {remainingPackageSlots} more package{remainingPackageSlots === 1 ? '' : 's'} this week.</p>
            </div>

            {packageLimitReached && (
              <div className="rounded-lg border p-3 mb-4 text-sm" style={{ borderColor: '#FDE68A', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                You have already used this week&apos;s package allowance. You can still request individual food items below.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayPackages.map(pkg => {
                const qty = pkgQty[pkg.id] || 0
                const selected = qty > 0
                const isLow = pkg.stock <= pkg.threshold
                const atLimit = !selected && totalPkgs >= remainingPackageSlots
                return (
                  <div key={pkg.id} className="rounded-lg overflow-hidden border transition-all"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: selected ? '#F5A623' : '#E5E7EB',
                      borderWidth: selected ? 2 : 1,
                      opacity: atLimit ? 0.5 : 1,
                    }}
                  >
                    <div style={{ position: 'relative', height: '8rem', overflow: 'hidden' }}>
                      <ImageWithFallback
                        src={pkg.image || DEFAULT_PKG_IMAGES[displayPackages.indexOf(pkg) % DEFAULT_PKG_IMAGES.length]}
                        alt={pkg.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {isLow && (
                        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: '#DC2626', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 9999 }}>Low Stock</div>
                      )}
                      {selected && (
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', width: '1.5rem', height: '1.5rem', borderRadius: 9999, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.25rem', fontFamily: FONT }}>{pkg.name}</h4>
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.75rem' }}>{pkg.description}</p>
                      <div style={{ marginBottom: '0.75rem' }}>
                        {pkg.items.map(item => (
                          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                            <span style={{ color: '#1A1A1A' }}>{item.name}</span>
                            <span style={{ color: '#6B7280' }}>脳{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', marginBottom: '0.75rem', borderTop: '1px solid #E5E7EB', fontSize: '0.75rem' }}>
                        <span style={{ color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</span>
                        <span style={{ fontWeight: 700, color: pkg.stock < 5 ? '#DC2626' : '#1A1A1A' }}>{pkg.stock}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={() => changePkgQty(pkg.id, -1, pkg.stock)}
                          disabled={interactionsDisabled || qty === 0}
                          style={{
                            width: '2rem', height: '2rem', borderRadius: 9999,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: !interactionsDisabled && qty > 0 ? '#F5A623' : '#E5E7EB',
                            color: '#1A1A1A', border: 'none',
                            cursor: !interactionsDisabled && qty > 0 ? 'pointer' : 'not-allowed',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseOver={e => { if (!interactionsDisabled && qty > 0) e.currentTarget.style.backgroundColor = '#D4870A' }}
                          onMouseOut={e => { if (!interactionsDisabled && qty > 0) e.currentTarget.style.backgroundColor = '#F5A623' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <div style={{ minWidth: 40, textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, color: '#1A1A1A' }}>{qty}</div>
                        <button
                          onClick={() => changePkgQty(pkg.id, 1, pkg.stock)}
                          disabled={interactionsDisabled || atLimit || qty >= pkg.stock}
                          style={{
                            width: '2rem', height: '2rem', borderRadius: 9999,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: !interactionsDisabled && !atLimit && qty < pkg.stock ? '#F5A623' : '#E5E7EB',
                            color: '#1A1A1A', border: 'none',
                            cursor: !interactionsDisabled && !atLimit && qty < pkg.stock ? 'pointer' : 'not-allowed',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseOver={e => { if (!interactionsDisabled && !atLimit && qty < pkg.stock) e.currentTarget.style.backgroundColor = '#D4870A' }}
                          onMouseOut={e => { if (!interactionsDisabled && !atLimit && qty < pkg.stock) e.currentTarget.style.backgroundColor = '#F5A623' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {displayPackages.length === 0 && (
              <div className="rounded-lg border p-6 text-sm" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', color: '#6B7280' }}>
                No food packages are available from the backend for this food bank right now.
              </div>
            )}
          </div>
          <div id="section-items" className="mb-8" style={{ scrollMarginTop: '1.5rem' }}>
            <div className="mb-5">
              <h3 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A', fontFamily: FONT }}>Individual Food Items</h3>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Select specific items based on your needs. Maximum {MAX_INDIVIDUAL} different items per week.
              </p>
              <div className="rounded-lg p-3 mb-4 flex items-center justify-between border text-sm"
                style={{
                  backgroundColor: atFoodLimit ? '#FEF3C7' : '#F2F4F3',
                  borderColor: atFoodLimit ? '#F5A623' : '#E5E7EB',
                  color: '#1A1A1A',
                }}
              >
                <div className="flex items-center gap-3">
                  <span><strong style={{ color: '#F5A623' }}>{totalFoods}/{MAX_INDIVIDUAL}</strong> items selected</span>
                  {atFoodLimit && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#F5A623', color: '#1A1A1A' }}>LIMIT REACHED</span>
                  )}
                </div>
                {atFoodLimit && (
                  <span className="text-xs hidden md:block" style={{ color: '#6B7280' }}>
                    You have reached the weekly limit. Unselect items to choose different ones.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => {
                const active = category === cat
                return (
                  <button key={cat}
                    onClick={() => { setCategory(cat); setPage(1) }}
                    style={{
                      padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                      fontSize: '0.75rem', fontWeight: 500,
                      backgroundColor: active ? '#F5A623' : '#FFFFFF',
                      color: active ? '#1A1A1A' : '#6B7280',
                      border: `1px solid ${active ? '#F5A623' : '#E5E7EB'}`,
                      cursor: 'pointer', transition: 'background-color 0.15s',
                    }}
                    onMouseOver={e => { if (!active) e.currentTarget.style.backgroundColor = '#F2F4F3' }}
                    onMouseOut={e => { if (!active) e.currentTarget.style.backgroundColor = active ? '#F5A623' : '#FFFFFF' }}
                  >{cat}</button>
                )
              })}
            </div>
            <div className="space-y-2 mb-4">
              {pagedFoods.map(food => {
                const itemKey = String(food.id)
                const qty = foodSel[itemKey] || 0
                const selected = qty > 0
                const canSelect = selected || !atFoodLimit
                return (
                  <div key={food.id} className="rounded-lg border transition-all"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: selected ? '#F5A623' : '#E5E7EB',
                      borderWidth: selected ? 2 : 1,
                      padding: '0.75rem',
                      opacity: !selected && atFoodLimit ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <button
                          onClick={() => { if (canSelect) toggleFood(itemKey) }}
                          disabled={interactionsDisabled || !canSelect}
                          style={{
                            width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem',
                            border: `2px solid ${selected ? '#10B981' : '#E5E7EB'}`,
                            backgroundColor: selected ? '#10B981' : '#FFFFFF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, cursor: !interactionsDisabled && canSelect ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {selected && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.15rem', fontFamily: FONT }}>{food.name}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                            <span style={{ color: '#6B7280' }}>{food.unit}</span>
                            <span style={{ padding: '0.1rem 0.375rem', borderRadius: '0.25rem', backgroundColor: '#F2F4F3', color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{food.category}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                          Stock: <strong style={{ color: '#1A1A1A' }}>{food.stock}</strong>
                        </div>
                      </div>
                      {selected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => changeFoodQty(itemKey, -1, food.stock)}
                            disabled={interactionsDisabled}
                            style={{
                              width: '1.75rem', height: '1.75rem', borderRadius: 9999,
                              backgroundColor: interactionsDisabled ? '#E5E7EB' : '#F5A623', color: '#1A1A1A', border: 'none',
                              cursor: interactionsDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseOver={e => { if (!interactionsDisabled) e.currentTarget.style.backgroundColor = '#D4870A' }}
                            onMouseOut={e => { if (!interactionsDisabled) e.currentTarget.style.backgroundColor = '#F5A623' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, minWidth: 30, textAlign: 'center', color: '#1A1A1A' }}>{qty}</div>
                          <button
                            onClick={() => changeFoodQty(itemKey, 1, food.stock)}
                            disabled={interactionsDisabled || qty >= MAX_INDIVIDUAL || qty >= food.stock}
                            style={{
                              width: '1.75rem', height: '1.75rem', borderRadius: 9999,
                              backgroundColor: !interactionsDisabled && qty < MAX_INDIVIDUAL && qty < food.stock ? '#F5A623' : '#E5E7EB',
                              color: '#1A1A1A', border: 'none',
                              cursor: !interactionsDisabled && qty < MAX_INDIVIDUAL && qty < food.stock ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseOver={e => { if (!interactionsDisabled && qty < MAX_INDIVIDUAL && qty < food.stock) e.currentTarget.style.backgroundColor = '#D4870A' }}
                            onMouseOut={e => { if (!interactionsDisabled && qty < MAX_INDIVIDUAL && qty < food.stock) e.currentTarget.style.backgroundColor = '#F5A623' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {availableItems.length === 0 && (
              <div className="rounded-lg border p-6 text-sm" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', color: '#6B7280' }}>
                No individual food items are available from the backend right now.
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => { if (page > 1) setPage(page - 1) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem',
                    backgroundColor: '#FFFFFF', color: '#1A1A1A', border: '1px solid #E5E7EB',
                    cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1,
                    transition: 'background-color 0.15s',
                  }}
                  onMouseOver={e => { if (page > 1) e.currentTarget.style.backgroundColor = '#F2F4F3' }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Previous
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      style={{
                        width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                        fontSize: '0.875rem', fontWeight: 500,
                        border: `1px solid ${page === n ? '#F5A623' : '#E5E7EB'}`,
                        backgroundColor: page === n ? '#F5A623' : '#FFFFFF',
                        color: page === n ? '#1A1A1A' : '#6B7280',
                        cursor: 'pointer', transition: 'background-color 0.15s',
                      }}
                    >{n}</button>
                  ))}
                </div>
                <button
                  onClick={() => { if (page < totalPages) setPage(page + 1) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem',
                    backgroundColor: '#FFFFFF', color: '#1A1A1A', border: '1px solid #E5E7EB',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.3 : 1,
                    transition: 'background-color 0.15s',
                  }}
                  onMouseOver={e => { if (page < totalPages) e.currentTarget.style.backgroundColor = '#F2F4F3' }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
          {showSuccess && (
            <div ref={successRef} className="mb-8">
              <div className="rounded-xl p-6 border" style={{ backgroundColor: '#F2F4F3', borderColor: '#E5E7EB' }}>
                <div className="mb-5">
                  <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A', fontFamily: FONT }}>Application Successful</h3>
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    Your food package application has been approved. Please present this code at the collection point.
                  </p>
                </div>
                <div className="mb-5 pb-5 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Redemption Code</div>
                  <div className="text-3xl font-bold mb-1" style={{ color: '#F5A623' }}>{redemptionCode}</div>
                  <div className="text-xs" style={{ color: '#6B7280' }}>Valid for 7 days</div>
                </div>
                <div className="space-y-2">
                  {totalPkgs > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: '#6B7280' }}>Packages Selected</span>
                      <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{totalPkgs}</span>
                    </div>
                  )}
                  {totalFoods > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: '#6B7280' }}>Individual Item Types</span>
                      <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{totalFoods}</span>
                    </div>
                  )}
                  {totalFoodUnits > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: '#6B7280' }}>Individual Item Units</span>
                      <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{totalFoodUnits}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: '#6B7280' }}>Collection Address</span>
                    <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{foodBank.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showSuccess ? (
            <div className="flex items-center justify-center py-2">
              <button className="px-8 py-3 rounded-lg font-medium transition-all"
                style={{ backgroundColor: '#F5A623', color: '#1A1A1A' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#D4870A' }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#F5A623' }}
                onClick={handleNewApplication}
              >New Application</button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-5 rounded-xl"
              style={{ backgroundColor: '#F2F4F3', position: 'sticky', bottom: '1.5rem', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}
            >
              <div>
                {!hasAny ? (
                  <p style={{ color: '#6B7280' }}>No items selected</p>
                ) : (
                  <>
                    <p style={{ fontWeight: 700, color: '#1A1A1A', marginBottom: '0.125rem' }}>{summaryTxt}</p>
                    <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Ready to apply</p>
                  </>
                )}
              </div>
              <button
                onClick={handleApply}
                disabled={!hasAny || loading || isBootstrapping}
                className="px-8 py-3 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: hasAny ? '#F5A623' : '#E5E7EB',
                  color: '#1A1A1A',
                  cursor: hasAny && !loading && !isBootstrapping ? 'pointer' : 'not-allowed',
                  opacity: !hasAny || loading || isBootstrapping ? 0.3 : 1,
                }}
                onMouseOver={e => { if (hasAny && !loading && !isBootstrapping) e.currentTarget.style.backgroundColor = '#D4870A' }}
                onMouseOut={e => { if (hasAny && !loading && !isBootstrapping) e.currentTarget.style.backgroundColor = '#F5A623' }}
              >{isBootstrapping ? 'Loading Availability...' : loading ? 'Submitting...' : 'Submit Application'}</button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

const FONT = 'system-ui, -apple-system, sans-serif'
