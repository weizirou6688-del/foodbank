import { create } from 'zustand'
import type { FoodBank, FoodPackage } from '@/types'
import { MOCK_FOOD_BANKS, MOCK_PACKAGES, mockWeeklyCollections, WEEKLY_COLLECTION_LIMIT } from '@/data/mockData'

interface FoodBankState {
  // Search
  searchPostcode: string
  searchResults: FoodBank[]
  hasSearched: boolean
  isSearching: boolean
  selectedFoodBank: FoodBank | null

  // Packages
  packages: FoodPackage[]
  weeklyCollected: number

  // Actions
  setSearchPostcode: (postcode: string) => void
  searchFoodBanks: (postcode: string) => Promise<void>
  selectFoodBank: (fb: FoodBank) => void
  applyPackages: (
    userEmail: string,
    selections: { packageId: number; qty: number }[],
  ) => { success: boolean; message: string; code?: string }
  resetSearch: () => void
  loadUserCollections: (email: string) => void
}

export const useFoodBankStore = create<FoodBankState>((set, get) => ({
  searchPostcode: '',
  searchResults: [],
  hasSearched: false,
  isSearching: false,
  selectedFoodBank: null,
  packages: MOCK_PACKAGES.map((p) => ({ ...p })),
  weeklyCollected: 0,

  setSearchPostcode: (postcode) => set({ searchPostcode: postcode }),

  searchFoodBanks: async (postcode) => {
    if (!postcode.trim()) return
    set({ isSearching: true })
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 700))
    set({
      searchResults: MOCK_FOOD_BANKS,
      hasSearched: true,
      isSearching: false,
    })
  },

  selectFoodBank: (fb) => set({ selectedFoodBank: fb }),

  loadUserCollections: (email) => {
    const count = mockWeeklyCollections[email] ?? 0
    set({ weeklyCollected: count })
  },

  applyPackages: (userEmail, selections) => {
    const { packages, weeklyCollected } = get()
    const totalQty = selections.reduce((s, sel) => s + sel.qty, 0)

    if (weeklyCollected + totalQty > WEEKLY_COLLECTION_LIMIT) {
      return {
        success: false,
        message: `Weekly limit exceeded. You can collect ${WEEKLY_COLLECTION_LIMIT - weeklyCollected} more pack(s) this week.`,
      }
    }

    // Check stock
    for (const sel of selections) {
      const pkg = packages.find((p) => p.id === sel.packageId)
      if (!pkg || pkg.stock < sel.qty) {
        return { success: false, message: `Insufficient stock for "${pkg?.name}".` }
      }
    }

    // Deduct stock
    const updatedPackages = packages.map((p) => {
      const sel = selections.find((s) => s.packageId === p.id)
      if (sel) return { ...p, stock: p.stock - sel.qty, appliedCount: p.appliedCount + sel.qty }
      return p
    })

    // Update weekly tracker
    mockWeeklyCollections[userEmail] = (mockWeeklyCollections[userEmail] ?? 0) + totalQty

    const code = 'FB-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    set({ packages: updatedPackages, weeklyCollected: weeklyCollected + totalQty })

    return { success: true, message: 'Application successful!', code }
  },

  resetSearch: () =>
    set({ searchPostcode: '', searchResults: [], hasSearched: false, selectedFoodBank: null }),
}))
