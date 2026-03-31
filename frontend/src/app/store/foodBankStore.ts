import { create } from 'zustand'
import type { FoodBank, FoodPackage, InventoryItem } from '@/shared/types/common'
import { useAuthStore } from './authStore'
import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'
import { getCoordinatesFromPostcode, getNearbyFoodbanks, getRankedFoodbanks } from '@/utils/foodbankApi'

const fetchWithAuthRetry = async (url: string, init: RequestInit = {}) => {
  // Protected endpoints share the same token refresh behaviour, so we keep the
  // retry logic here instead of duplicating it in every action.
  const withToken = async (token: string) =>
    fetch(url, {
      ...init,
      headers: new Headers({
        ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers as Record<string, string> | undefined)),
        Authorization: `Bearer ${token}`,
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

interface InternalFoodBankRecord {
  id: number
  name: string
  address: string
  lat?: number
  lng?: number
  systemMatched?: boolean
}

interface SearchableInternalFoodBank extends FoodBank {
  packageCount: number
}

const normalizeFoodBank = (bank: {
  id: number | string
  name: string
  address: string
  lat?: number | string | null
  lng?: number | string | null
  hours?: string[]
  phone?: string
  email?: string
  url?: string
  systemMatched?: boolean
}): FoodBank => ({
  id: Number(bank.id),
  name: bank.name,
  address: bank.address,
  lat: Number(bank.lat ?? 0),
  lng: Number(bank.lng ?? 0),
  hours: Array.isArray(bank.hours) ? bank.hours : undefined,
  phone: bank.phone,
  email: bank.email,
  url: bank.url,
  systemMatched: bank.systemMatched,
})

const normalizeInventoryItem = (item: {
  id: number | string
  name: string
  category: string
  stock?: number
  total_stock?: number
  unit: string
  threshold?: number
  food_bank_id?: number | string | null
}): InventoryItem => ({
  id: Number(item.id),
  name: item.name,
  category: item.category,
  stock: Number(item.total_stock ?? item.stock ?? 0),
  unit: item.unit,
  threshold: Number(item.threshold ?? 0),
  foodBankId: item.food_bank_id == null ? undefined : Number(item.food_bank_id),
})

const resolveSelectedFoodBank = async (
  get: () => FoodBankState,
  set: (partial: Partial<FoodBankState>) => void,
): Promise<FoodBank | null> => {
  const existing = get().selectedFoodBank
  if (existing) {
    return existing
  }

  const foodBanksResponse = await fetch(`${API_BASE_URL}/api/v1/food-banks`)
  if (!foodBanksResponse.ok) {
    throw new Error('Failed to load food banks')
  }

  const foodBanksPayload = await foodBanksResponse.json()
  const foodBanks = Array.isArray(foodBanksPayload)
    ? foodBanksPayload
    : Array.isArray(foodBanksPayload?.items)
      ? foodBanksPayload.items
      : []

  if (foodBanks.length === 0) {
    set({ selectedFoodBank: null })
    return null
  }

  const fallbackBank = normalizeFoodBank(foodBanks[0])
  set({ selectedFoodBank: fallbackBank })
  return fallbackBank
}

const normalizeText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const findInternalFoodBankMatch = (
  candidate: { name: string; address: string },
  internalBanks: InternalFoodBankRecord[],
): InternalFoodBankRecord | null => {
  // There is no universal external/internal id bridge, so matching is
  // currently heuristic: normalized name and address comparisons.
  const normalizedName = normalizeText(candidate.name)
  const normalizedAddress = normalizeText(candidate.address)

  return internalBanks.find((bank) => {
    const bankName = normalizeText(bank.name)
    const bankAddress = normalizeText(bank.address)

    return bankName === normalizedName
      || bankAddress === normalizedAddress
      || (bankName.includes(normalizedName) || normalizedName.includes(bankName))
      || (bankAddress.includes(normalizedAddress) || normalizedAddress.includes(bankAddress))
  }) ?? null
}

const getCurrentWeekMonday = (): string => {
  const today = new Date()
  const date = new Date(today)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const earthRadiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

interface FoodBankState {
  searchPostcode: string
  searchResults: FoodBank[]
  searchedLocation: { lat: number; lng: number } | null
  hasSearched: boolean
  isSearching: boolean
  searchError: string | null
  selectedFoodBank: FoodBank | null

  packages: FoodPackage[]
  inventory: InventoryItem[]
  availableItems: InventoryItem[]
  weeklyCollected: number

  setSearchPostcode: (postcode: string) => void
  searchFoodBanks: (postcode: string) => Promise<void>
  selectFoodBank: (fb: FoodBank) => void
  applyPackages: (
    userEmail: string,
    selections: { packageId: number; qty: number }[],
    weekStart?: string,
    itemSelections?: { itemId: number; qty: number }[],
  ) => Promise<{ success: boolean; message: string; code?: string }>
  resetSearch: () => void
  loadUserCollections: (email: string, weekStart?: string) => Promise<void>
  loadPackages: () => Promise<void>
  loadAvailableItems: () => Promise<void>
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
    food_bank_id?: number
    contents: Array<{ item_id: number; quantity: number }>
  }) => Promise<void>
  updatePackage: (packageId: number, data: Partial<Pick<FoodPackage, 'name' | 'category' | 'description' | 'stock' | 'threshold' | 'appliedCount'>>) => Promise<void>
}

export const useFoodBankStore = create<FoodBankState>((set, get) => ({
  searchPostcode: '',
  searchResults: [],
  searchedLocation: null,
  hasSearched: false,
  isSearching: false,
  searchError: null,
  selectedFoodBank: null,
  packages: [],
  inventory: [],
  availableItems: [],
  weeklyCollected: 0,

  setSearchPostcode: (postcode) => set({ searchPostcode: postcode }),

  loadPackages: async () => {
    try {
      const foodBank = await resolveSelectedFoodBank(get, set)
      if (!foodBank) {
        set({ packages: [] })
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/food-banks/${foodBank.id}/packages`)
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

  loadAvailableItems: async () => {
    try {
      const foodBank = await resolveSelectedFoodBank(get, set)
      if (!foodBank) {
        set({ availableItems: [] })
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/food-banks/${foodBank.id}/inventory-items`)
      if (!response.ok) {
        throw new Error('Failed to load individual food items')
      }

      const payload = await response.json()
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : []

      set({
        availableItems: items.map(normalizeInventoryItem),
      })
    } catch (error) {
      console.error('Failed to load available items:', error)
      throw error instanceof Error ? error : new Error('Failed to load individual food items')
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
      const inventoryItems: Array<{
        id: number | string
        name: string
        category: string
        stock?: number
        total_stock?: number
        unit: string
        threshold?: number
      }> = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : []

      const normalizedInventory: InventoryItem[] = inventoryItems.map(normalizeInventoryItem)

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
      stock: Number(createdItem.total_stock ?? createdItem.stock ?? 0),
      unit: createdItem.unit,
      threshold: Number(createdItem.threshold ?? 0),
    }

    set((state) => ({
      inventory: [normalizedItem, ...state.inventory],
    }))
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
      stock: Number(updatedItem.total_stock ?? updatedItem.stock ?? 0),
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
      stock: Number(updatedItem.total_stock ?? updatedItem.stock ?? 0),
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
      stock: Number(updatedItem.total_stock ?? updatedItem.stock ?? 0),
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
  },

  addPackage: async (data) => {
    let foodBankId = data.food_bank_id ?? get().selectedFoodBank?.id

    if (!foodBankId || foodBankId <= 0) {
      const foodBanksResponse = await fetch(`${API_BASE_URL}/api/v1/food-banks`)
      if (!foodBanksResponse.ok) {
        throw new Error('Failed to resolve food bank for new package')
      }

      const foodBanksPayload = await foodBanksResponse.json()
      const foodBanks = Array.isArray(foodBanksPayload)
        ? foodBanksPayload
        : Array.isArray(foodBanksPayload?.items)
          ? foodBanksPayload.items
          : []

      if (foodBanks.length === 0) {
        throw new Error('No food banks available. Create a food bank before adding packages.')
      }

      foodBankId = Number(foodBanks[0].id)
    }

    const response = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        food_bank_id: foodBankId,
      }),
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
    set({ isSearching: true, searchError: null })
    try {
      // Search is composed from multiple sources in parallel:
      // postcode geocoding, internal DB banks, nearby external banks, and a
      // ranked external list used for debugging empty results.
      const [userCoords, internalResponse, nearby, rankedNearby] = await Promise.all([
        getCoordinatesFromPostcode(postcode),
        fetch(`${API_BASE_URL}/api/v1/food-banks`),
        getNearbyFoodbanks(postcode),
        getRankedFoodbanks(postcode),
      ])

      console.info('[FindFoodBank] search start', {
        postcode,
        searchedLocation: userCoords,
        externalNearbyCount: nearby.length,
      })

      const internalPayload = internalResponse.ok ? await internalResponse.json() : []
      const internalBanks: InternalFoodBankRecord[] = Array.isArray(internalPayload)
        ? internalPayload
        : Array.isArray(internalPayload?.items)
          ? internalPayload.items
          : []

      const rankedInternalBanks = internalBanks
        .flatMap((bank) => {
          if (typeof bank.lat !== 'number' || typeof bank.lng !== 'number') {
            return []
          }

          return [{
            id: bank.id,
            name: bank.name,
            address: bank.address,
            distance: haversineDistance(userCoords.lat, userCoords.lng, bank.lat, bank.lng),
            hours: [],
            lat: bank.lat,
            lng: bank.lng,
            systemMatched: false,
            packageCount: 0,
          } satisfies SearchableInternalFoodBank]
        })
        .sort((a, b) => a.distance - b.distance)

      const internalBanksWithPackages = await Promise.all(
        rankedInternalBanks.map(async (bank) => {
          try {
            // A bank counts as "package-enabled" only if our own backend says
            // there are package records behind it.
            const response = await fetch(`${API_BASE_URL}/api/v1/food-banks/${bank.id}/packages`)
            if (!response.ok) {
              return bank
            }

            const packagesPayload = await response.json()
            const packageCount = Array.isArray(packagesPayload) ? packagesPayload.length : 0
            return {
              ...bank,
              packageCount,
              systemMatched: packageCount > 0,
            }
          } catch {
            return bank
          }
        }),
      )

      const onlineInternalBanks = internalBanksWithPackages.filter((bank) => bank.systemMatched)
      const defaultOnlineBank = onlineInternalBanks[0] ?? null
      const externalResults: FoodBank[] = nearby.map((fb) => {
        // External discovery data is mapped onto internal package data where
        // possible so public search can still lead into the package flow.
        const mapped = findInternalFoodBankMatch(
          { name: fb.name, address: `${fb.address}, ${fb.postcode}` },
          internalBanksWithPackages,
        )
        const packageSourceBank = mapped?.systemMatched
          ? mapped
          : defaultOnlineBank
        const isOnline = Boolean(packageSourceBank)

        return {
          id: packageSourceBank?.id ?? -1,
          name: fb.name,
          address: `${fb.address}, ${fb.postcode}`,
          distance: fb.distance,
          hours: fb.hours ?? [],
          lat: fb.lat,
          lng: fb.lng,
          phone: fb.phone,
          email: fb.email,
          url: fb.url,
          systemMatched: isOnline,
        }
      })

      if (externalResults.length > 0) {
        console.info('[FindFoodBank] search results ready', {
          postcode,
          externalResults: externalResults.length,
        })

        set({
          searchResults: [...externalResults].sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER)),
          searchedLocation: userCoords,
          hasSearched: true,
          isSearching: false,
          searchError: null,
        })
        return
      }

      console.warn(
        // This log is intentionally descriptive so search-radius debugging can
        // happen from the browser console without a deeper tracing tool.
        `[FindFoodBank] no results within configured radius for "${postcode}" at ${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}. Closest matches: ${
          rankedNearby
            .slice(0, 3)
            .map((item) => `${item.name} (${item.distance.toFixed(2)} km)`)
            .join(', ') || 'none'
        }`,
      )

      set({
        searchResults: [],
        searchedLocation: userCoords,
        hasSearched: true,
        isSearching: false,
        searchError: null,
      })
    } catch (error) {
      console.error('Search failed:', error)
      const message = error instanceof Error ? error.message : 'Search failed'
      set({
        searchResults: [],
        searchedLocation: null,
        hasSearched: true,
        isSearching: false,
        searchError: message,
      })
    }
  },

  selectFoodBank: (fb) => set({ selectedFoodBank: fb }),

  loadUserCollections: async (_email, weekStart) => {
    try {
      const authStore = useAuthStore.getState()
      if (!authStore.accessToken) return

      const response = await fetch(`${API_BASE_URL}/api/v1/applications/my`, {
        headers: { Authorization: `Bearer ${authStore.accessToken}` },
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : []
      const targetWeek = weekStart || getCurrentWeekMonday()
      const totalCollected = items
        .filter((application: { week_start?: string }) => application.week_start === targetWeek)
        .reduce((sum: number, application: { total_quantity?: number }) => sum + Number(application.total_quantity ?? 0), 0)

      set({ weeklyCollected: totalCollected })
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  },

  applyPackages: async (_userEmail, selections, weekStart, itemSelections = []) => {
    try {
      const authStore = useAuthStore.getState()
      if (!authStore.accessToken || !authStore.user) {
        return { success: false, message: 'Not authenticated' }
      }

      const selectedFoodBank = get().selectedFoodBank
      if (!selectedFoodBank || selectedFoodBank.id <= 0) {
        return { success: false, message: 'This food bank is not connected to online applications yet.' }
      }

      let finalWeekStart = weekStart
      if (!finalWeekStart) {
        finalWeekStart = getCurrentWeekMonday()
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.accessToken}`,
        },
        body: JSON.stringify({
          food_bank_id: selectedFoodBank.id,
          week_start: finalWeekStart,
          items: [
            ...selections.map((sel) => ({
              package_id: sel.packageId,
              quantity: sel.qty,
            })),
            ...itemSelections.map((sel) => ({
              inventory_item_id: sel.itemId,
              quantity: sel.qty,
            })),
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Application failed' }))
        return { success: false, message: error.detail || 'Application failed' }
      }

      const result = await response.json()
      await Promise.allSettled([
        get().loadUserCollections(_userEmail, finalWeekStart),
        get().loadPackages(),
        get().loadAvailableItems(),
      ])

      return {
        success: true,
        message: 'Application successful!',
        code: result.redemption_code || result.id,
      }
    } catch {
      return { success: false, message: 'Network error during application' }
    }
  },

  resetSearch: () =>
    set({ searchPostcode: '', searchResults: [], searchedLocation: null, hasSearched: false, searchError: null, selectedFoodBank: null, packages: [], availableItems: [] }),
}))
