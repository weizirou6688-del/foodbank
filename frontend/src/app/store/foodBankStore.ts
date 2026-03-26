import { create } from 'zustand'
import type { FoodBank, FoodPackage, InventoryItem } from '@/shared/types/common'
import { useAuthStore } from './authStore'
import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

const fetchWithAuthRetry = async (url: string, init: RequestInit = {}) => {
  const withToken = async (token: string) =>
    fetch(url, {
      ...init,
      headers: new Headers({
        ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers as Record<string, string> | undefined)),
        'Authorization': `Bearer ${token}`,
      }),
    })

  const authStore = useAuthStore.getState()
  if (!authStore.accessToken) {
    throw new Error('Not authenticated')
  }

  let response = await withToken(authStore.accessToken)
  if (response.status !== 401) {
    return response
  }

  const refreshed = await useAuthStore.getState().refreshAccessToken()
  if (!refreshed) {
    throw new Error('Session expired, please login again')
  }

  const renewedToken = useAuthStore.getState().accessToken
  if (!renewedToken) {
    throw new Error('Session expired, please login again')
  }

  response = await withToken(renewedToken)
  return response
}

interface FoodBankState {
  searchPostcode: string
  searchResults: FoodBank[]
  hasSearched: boolean
  isSearching: boolean
  selectedFoodBank: FoodBank | null

  packages: FoodPackage[]
  inventory: InventoryItem[]
  weeklyCollected: number

  setSearchPostcode: (postcode: string) => void
  searchFoodBanks: (postcode: string) => Promise<void>
  selectFoodBank: (fb: FoodBank) => void
  applyPackages: (
    userEmail: string,
    selections: { packageId: number; qty: number }[],
  ) => Promise<{ success: boolean; message: string; code?: string }>
  resetSearch: () => void
  loadUserCollections: (email: string) => Promise<void>
  loadPackages: () => Promise<void>
  loadInventory: () => Promise<void>
  addItem: (data: { name: string; category: string; initial_stock: number }) => Promise<void>
  updateItem: (itemId: number, data: Partial<Pick<InventoryItem, 'name' | 'category' | 'stock' | 'unit' | 'threshold'>>) => Promise<void>
  stockInItem: (itemId: number, quantity: number, reason?: string) => Promise<void>
  stockOutItem: (itemId: number, quantity: number, reason?: string) => Promise<void>
  deleteItem: (itemId: number) => Promise<void>
  addPackage: (data: {
    name: string
    category: string
    threshold: number
    contents: Array<{ item_id: number; quantity: number }>
  }) => Promise<void>
  updatePackage: (packageId: number, data: Partial<Pick<FoodPackage, 'name' | 'category' | 'description' | 'stock' | 'threshold' | 'appliedCount'>>) => Promise<void>
}

export const useFoodBankStore = create<FoodBankState>((set, get) => ({
  searchPostcode: '',
  searchResults: [],
  hasSearched: false,
  isSearching: false,
  selectedFoodBank: null,
  packages: [],
  inventory: [],
  weeklyCollected: 0,

  setSearchPostcode: (postcode) => set({ searchPostcode: postcode }),

  loadPackages: async () => {
    try {
      let foodBankId = get().selectedFoodBank?.id

      if (!foodBankId) {
        const foodBanksResponse = await fetch(`${API_BASE_URL}/api/v1/food-banks`)
        if (!foodBanksResponse.ok) {
          throw new Error('Failed to load food banks')
        }
        const foodBanks = await foodBanksResponse.json()
        if (!Array.isArray(foodBanks) || foodBanks.length === 0) {
          set({ packages: [] })
          return
        }
        foodBankId = Number(foodBanks[0].id)
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/food-banks/${foodBankId}/packages`)
      if (!response.ok) {
        throw new Error('Failed to load packages')
      }

      const packages = await response.json()
      const detailItemsById = new Map<number, Array<{ name: string; qty: number }>>()

      if (Array.isArray(packages) && packages.length > 0) {
        await Promise.all(
          packages.map(async (pkg) => {
            const packageId = Number(pkg.id)
            if (!Number.isFinite(packageId) || packageId <= 0) {
              return
            }

            try {
              const detailResponse = await fetch(`${API_BASE_URL}/api/v1/packages/${packageId}`)
              if (!detailResponse.ok) {
                return
              }

              const detail = await detailResponse.json()
              const detailItems = Array.isArray(detail?.package_items)
                ? detail.package_items.map((entry: {
                    inventory_item_name?: string
                    quantity?: number
                    inventory_item_id?: number
                  }) => ({
                    name: entry.inventory_item_name || `Item #${entry.inventory_item_id ?? 'unknown'}`,
                    qty: Number(entry.quantity ?? 0),
                  }))
                : []

              detailItemsById.set(packageId, detailItems)
            } catch {
              // Keep list loading resilient even if a detail request fails.
            }
          }),
        )
      }

      const normalizedPackages: FoodPackage[] = Array.isArray(packages)
        ? packages.map((pkg) => ({
            id: Number(pkg.id),
            name: pkg.name,
            category: pkg.category,
            description: pkg.description ?? '',
            items: detailItemsById.get(Number(pkg.id))
              ?? (Array.isArray(pkg.items)
              ? pkg.items.map((item: { name: string; qty: number }) => ({
                  name: item.name,
                  qty: Number(item.qty ?? 0),
                }))
              : []),
            stock: Number(pkg.stock ?? 0),
            threshold: Number(pkg.threshold ?? 0),
            appliedCount: Number(pkg.applied_count ?? pkg.appliedCount ?? 0),
            image: pkg.image_url ?? pkg.image ?? '',
          }))
        : []
      set({ packages: normalizedPackages })
    } catch (error) {
      console.error('Failed to load packages:', error)
      throw error instanceof Error ? error : new Error('Failed to load packages')
    }
  },

  loadInventory: async () => {
    try {
      const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to load inventory' }))
        throw new Error(error.detail || 'Failed to load inventory')
      }

      const data = await response.json()
      const normalizedInventory: InventoryItem[] = Array.isArray(data)
        ? data.map((item) => ({
            id: Number(item.id),
            name: item.name,
            category: item.category,
            stock: Number(item.stock ?? 0),
            unit: item.unit,
            threshold: Number(item.threshold ?? 0),
          }))
        : []

      set({ inventory: normalizedInventory })
    } catch (error) {
      console.error('Failed to load inventory:', error)
      throw error instanceof Error ? error : new Error('Failed to load inventory')
    }
  },

  addItem: async (data) => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        initial_stock: data.initial_stock,
        unit: 'units',
        threshold: 10,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add inventory item' }))
      throw new Error(error.detail || 'Failed to add inventory item')
    }

    const createdItem = await response.json()
    const normalizedItem: InventoryItem = {
      id: Number(createdItem.id),
      name: createdItem.name,
      category: createdItem.category,
      stock: Number(createdItem.stock ?? 0),
      unit: createdItem.unit,
      threshold: Number(createdItem.threshold ?? 0),
    }

    set((state) => ({
      inventory: [normalizedItem, ...state.inventory],
    }))

    const maybeFetchStats = (get() as FoodBankState & { fetchStats?: () => Promise<void> }).fetchStats
    if (maybeFetchStats) {
      await maybeFetchStats()
    }
  },

  updateItem: async (itemId, data) => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update inventory item' }))
      throw new Error(error.detail || 'Failed to update inventory item')
    }

    const updatedItem = await response.json()
    const normalizedItem: InventoryItem = {
      id: Number(updatedItem.id),
      name: updatedItem.name,
      category: updatedItem.category,
      stock: Number(updatedItem.stock ?? 0),
      unit: updatedItem.unit,
      threshold: Number(updatedItem.threshold ?? 0),
    }

    set((state) => ({
      inventory: state.inventory.map((item) => (item.id === itemId ? normalizedItem : item)),
    }))
  },

  stockInItem: async (itemId, quantity, reason = 'manual stock in') => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory/${itemId}/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity, reason }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to increase stock' }))
      throw new Error(error.detail || 'Failed to increase stock')
    }

    const updatedItem = await response.json()
    const normalizedItem: InventoryItem = {
      id: Number(updatedItem.id),
      name: updatedItem.name,
      category: updatedItem.category,
      stock: Number(updatedItem.stock ?? 0),
      unit: updatedItem.unit,
      threshold: Number(updatedItem.threshold ?? 0),
    }

    set((state) => ({
      inventory: state.inventory.map((item) => (item.id === itemId ? normalizedItem : item)),
    }))
  },

  stockOutItem: async (itemId, quantity, reason = 'manual stock out') => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory/${itemId}/stock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity, reason }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to decrease stock' }))
      throw new Error(error.detail || 'Failed to decrease stock')
    }

    const updatedItem = await response.json()
    const normalizedItem: InventoryItem = {
      id: Number(updatedItem.id),
      name: updatedItem.name,
      category: updatedItem.category,
      stock: Number(updatedItem.stock ?? 0),
      unit: updatedItem.unit,
      threshold: Number(updatedItem.threshold ?? 0),
    }

    set((state) => ({
      inventory: state.inventory.map((item) => (item.id === itemId ? normalizedItem : item)),
    }))
  },

  deleteItem: async (itemId) => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/inventory/${itemId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete inventory item' }))
      throw new Error(error.detail || 'Failed to delete inventory item')
    }

    set((state) => ({
      inventory: state.inventory.filter((item) => item.id !== itemId),
    }))

    const maybeFetchStats = (get() as FoodBankState & { fetchStats?: () => Promise<void> }).fetchStats
    if (maybeFetchStats) {
      await maybeFetchStats()
    }
  },

  addPackage: async (data) => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add package' }))
      throw new Error(error.detail || 'Failed to add package')
    }

    const createdPackage = await response.json()
    const normalizedPackage: FoodPackage = {
      id: Number(createdPackage.id),
      name: createdPackage.name,
      category: createdPackage.category,
      description: createdPackage.description ?? '',
      items: Array.isArray(createdPackage.contents)
        ? createdPackage.contents.map((content: { item_id: number; quantity: number }) => ({
            name: `Item #${content.item_id}`,
            qty: content.quantity,
          }))
        : [],
      stock: Number(createdPackage.stock ?? 0),
      threshold: Number(createdPackage.threshold ?? 0),
      appliedCount: Number(createdPackage.applied_count ?? 0),
      image: createdPackage.image_url ?? '',
    }

    set((state) => ({
      packages: [normalizedPackage, ...state.packages],
    }))

    const maybeFetchStats = (get() as FoodBankState & { fetchStats?: () => Promise<void> }).fetchStats
    if (maybeFetchStats) {
      await maybeFetchStats()
    }
  },

  updatePackage: async (packageId, data) => {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/packages/${packageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        applied_count: data.appliedCount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update package' }))
      throw new Error(error.detail || 'Failed to update package')
    }

    const updatedPackage = await response.json()
    set((state) => ({
      packages: state.packages.map((pkg) =>
        pkg.id === packageId
          ? {
              ...pkg,
              name: updatedPackage.name,
              category: updatedPackage.category,
              description: updatedPackage.description ?? pkg.description,
              stock: Number(updatedPackage.stock ?? pkg.stock),
              threshold: Number(updatedPackage.threshold ?? pkg.threshold),
              appliedCount: Number(updatedPackage.applied_count ?? pkg.appliedCount),
              image: updatedPackage.image_url ?? pkg.image,
            }
          : pkg,
      ),
    }))
  },

  searchFoodBanks: async (postcode) => {
    if (!postcode.trim()) return
    set({ isSearching: true })
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/food-banks?postcode=${encodeURIComponent(postcode)}`)
      if (response.ok) {
        const results = await response.json()
        const normalizedResults = (Array.isArray(results) ? results : []).map((fb) => ({
          ...fb,
          hours: Array.isArray(fb?.hours) ? fb.hours : [],
          distance: typeof fb?.distance === 'number' ? fb.distance : undefined,
        }))
        set({
          searchResults: normalizedResults,
          hasSearched: true,
          isSearching: false,
        })
      } else {
        set({
          searchResults: [],
          hasSearched: true,
          isSearching: false,
        })
      }
    } catch (error) {
      console.error('Search failed:', error)
      set({ hasSearched: true, isSearching: false })
    }
  },

  selectFoodBank: (fb) => set({ selectedFoodBank: fb }),

  loadUserCollections: async (email) => {
    try {
      const authStore = useAuthStore.getState()
      if (!authStore.accessToken) return
      
      const response = await fetch(`${API_BASE_URL}/api/v1/applications?filter_by=email&value=${encodeURIComponent(email)}`, {
        headers: { 'Authorization': `Bearer ${authStore.accessToken}` },
      })
      if (response.ok) {
        const applications = await response.json()
        const totalCollected = Array.isArray(applications) ? applications.length : 0
        set({ weeklyCollected: totalCollected })
      }
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  },

  applyPackages: async (_userEmail, selections) => {
    try {
      const authStore = useAuthStore.getState()
      if (!authStore.accessToken || !authStore.user) {
        return { success: false, message: 'Not authenticated' }
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`,
        },
        body: JSON.stringify({
          user_id: authStore.user.id,
          food_bank_id: (get().selectedFoodBank as any)?.id || '',
          items: selections.map((sel) => ({
            food_package_id: String(sel.packageId),
            quantity: sel.qty,
          })),
          status: 'pending',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, message: error.detail || 'Application failed' }
      }

      const result = await response.json()
      const code = result.id || 'APP-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const currentWeekly = get().weeklyCollected + selections.reduce((s, sel) => s + sel.qty, 0)
      set({ weeklyCollected: currentWeekly })

      return { success: true, message: 'Application successful!', code }
    } catch (error) {
      return { success: false, message: 'Network error during application' }
    }
  },

  resetSearch: () =>
    set({ searchPostcode: '', searchResults: [], hasSearched: false, selectedFoodBank: null }),
}))
