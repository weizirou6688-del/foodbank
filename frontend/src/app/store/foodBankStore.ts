import { create } from 'zustand'
import type { FoodBank } from '@/shared/types/foodBanks'
import type { InventoryItem } from '@/shared/types/inventory'
import type { FoodPackage } from '@/shared/types/packages'
import { adminAPI, type InventoryItemCreatePayload, type InventoryItemUpdatePayload } from '@/shared/lib/api/admin'
import { applicationsAPI, type ApplicationCreatePayload } from '@/shared/lib/api/applications'
import { foodBanksAPI } from '@/shared/lib/api/foodBanks'
import { packagesAPI } from '@/shared/lib/api/packages'
import { buildFoodBankDisplayAddress, findInternalFoodBankMatch } from '@/shared/lib/foodBankAddress'
import {
  getAdminScopeMeta,
  isAdminFoodBankSelectionRequired,
  resolveAdminTargetFoodBankId,
} from '@/shared/lib/adminScope'
import { useAuthStore } from './authStore'
import { getCoordinatesFromPostcode, getNearbyFoodbanks, getRankedFoodbanks } from '@/utils/foodbankApi'
interface SearchableInternalFoodBank extends FoodBank {
  packageCount: number
}
const normalizeFoodBank = (bank: {
  id: number | string
  name: string
  address: string
  lat?: number | string | null
  lng?: number | string | null
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
const replaceInventoryItem = (
  inventory: InventoryItem[],
  itemId: number,
  nextItem: InventoryItem,
): InventoryItem[] => inventory.map((item) => (item.id === itemId ? nextItem : item))
type RawPackage = {
  id: number | string
  name: string
  category: string
  description?: string | null
  items?: Array<{ name: string; qty?: number }>
  contents?: Array<{ item_id: number; quantity: number }>
  stock?: number
  threshold?: number
  applied_count?: number
  appliedCount?: number
  image_url?: string | null
  image?: string | null
}
type UserApplicationSummary = {
  week_start?: string
  total_quantity?: number
}
const normalizeNamedPackageItems = (
  items: RawPackage['items'],
): FoodPackage['items'] => (
  Array.isArray(items)
    ? items.map((item) => ({
        name: item.name,
        qty: Number(item.qty ?? 0),
      }))
    : []
)
const normalizePackageContents = (
  contents: RawPackage['contents'],
): FoodPackage['items'] => (
  Array.isArray(contents)
    ? contents.map((content) => ({
        name: `Item #${content.item_id}`,
        qty: Number(content.quantity ?? 0),
      }))
    : []
)
const normalizePackage = (
  pkg: RawPackage,
  itemsOverride?: FoodPackage['items'],
): FoodPackage => {
  const namedItems = normalizeNamedPackageItems(pkg.items)
  return {
    id: Number(pkg.id),
    name: pkg.name,
    category: pkg.category,
    description: pkg.description ?? '',
    items: itemsOverride ?? (namedItems.length > 0 ? namedItems : normalizePackageContents(pkg.contents)),
    stock: Number(pkg.stock ?? 0),
    threshold: Number(pkg.threshold ?? 0),
    appliedCount: Number(pkg.applied_count ?? pkg.appliedCount ?? 0),
    image: pkg.image_url ?? pkg.image ?? '',
  }
}
const getRequiredAccessToken = (): string => {
  const token = useAuthStore.getState().accessToken
  if (!token) {
    throw new Error('Not authenticated')
  }
  return token
}

const resolveSelectedFoodBank = async (
  get: () => FoodBankState,
  set: (partial: Partial<FoodBankState>) => void,
): Promise<FoodBank | null> => {
  const existing = get().selectedFoodBank
  if (existing) {
    return existing
  }

  const foodBanksResponse = await foodBanksAPI.getFoodBanks()
  const foodBanks = foodBanksResponse.items.map(normalizeFoodBank)

  if (foodBanks.length === 0) {
    set({ selectedFoodBank: null })
    return null
  }

  const fallbackBank = normalizeFoodBank(foodBanks[0])
  set({ selectedFoodBank: fallbackBank })
  return fallbackBank
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
  addItem: (data: Pick<InventoryItemCreatePayload, 'name' | 'category' | 'initial_stock' | 'food_bank_id'>) => Promise<void>
  updateItem: (itemId: number, data: InventoryItemUpdatePayload) => Promise<void>
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
      const packages = await packagesAPI.listFoodBankPackages(foodBank.id)
      const detailItemsById = new Map<number, Array<{ name: string; qty: number }>>()
      if (packages.length > 0) {
        await Promise.all(
          packages.map(async (pkg) => {
            const packageId = Number(pkg.id)
            if (!Number.isFinite(packageId) || packageId <= 0) {
              return
            }
            try {
              const detail = await packagesAPI.getFoodPackageDetail(packageId)
              const detailItems = Array.isArray(detail.package_items)
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
      const normalizedPackages: FoodPackage[] = packages.map((pkg) =>
        normalizePackage(pkg, detailItemsById.get(Number(pkg.id))),
      )
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
      const response = await foodBanksAPI.getInventoryItems(foodBank.id)
      const items = response.items
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
      const inventoryResponse = await adminAPI.getInventoryItems(getRequiredAccessToken())
      const inventoryItems = inventoryResponse.items
      const normalizedInventory: InventoryItem[] = inventoryItems.map(normalizeInventoryItem)
      set({ inventory: normalizedInventory })
    } catch (error) {
      console.error('Failed to load inventory:', error)
      throw error instanceof Error ? error : new Error('Failed to load inventory')
    }
  },
  addItem: async (data) => {
    const adminScope = getAdminScopeMeta(useAuthStore.getState().user)
    const targetFoodBankId = resolveAdminTargetFoodBankId(adminScope, data.food_bank_id) ?? undefined
    if (isAdminFoodBankSelectionRequired(adminScope, targetFoodBankId)) {
      throw new Error('Choose a food bank before adding an inventory item')
    }
    const normalizedItem = normalizeInventoryItem(
      await adminAPI.createInventoryItem(
        {
        name: data.name,
        category: data.category,
        initial_stock: data.initial_stock,
        unit: 'units',
        threshold: 10,
        food_bank_id: targetFoodBankId,
        },
        getRequiredAccessToken(),
      ),
    )
    set((state) => ({
      inventory: [normalizedItem, ...state.inventory],
    }))
  },
  updateItem: async (itemId, data) => {
    const normalizedItem = normalizeInventoryItem(
      await adminAPI.updateInventoryItem(itemId, data, getRequiredAccessToken()),
    )
    set((state) => ({
      inventory: replaceInventoryItem(state.inventory, itemId, normalizedItem),
    }))
  },
  stockInItem: async (itemId, quantity, reason = 'manual stock in') => {
    const normalizedItem = normalizeInventoryItem(
      await adminAPI.stockInInventoryItem(itemId, { quantity, reason }, getRequiredAccessToken()),
    )
    set((state) => ({
      inventory: replaceInventoryItem(state.inventory, itemId, normalizedItem),
    }))
  },
  stockOutItem: async (itemId, quantity, reason = 'manual stock out') => {
    const normalizedItem = normalizeInventoryItem(
      await adminAPI.stockOutInventoryItem(itemId, { quantity, reason }, getRequiredAccessToken()),
    )
    set((state) => ({
      inventory: replaceInventoryItem(state.inventory, itemId, normalizedItem),
    }))
  },
  deleteItem: async (itemId) => {
    await adminAPI.deleteInventoryItem(itemId, getRequiredAccessToken())
    set((state) => ({
      inventory: state.inventory.filter((item) => item.id !== itemId),
    }))
  },
  addPackage: async (data) => {
    const adminScope = getAdminScopeMeta(useAuthStore.getState().user)
    let foodBankId = resolveAdminTargetFoodBankId(
      adminScope,
      data.food_bank_id,
      get().selectedFoodBank?.id,
    )
    if (isAdminFoodBankSelectionRequired(adminScope, foodBankId)) {
      throw new Error('Choose a food bank before adding a package')
    }
    if (!foodBankId || foodBankId <= 0) {
      const resolvedFoodBank = await resolveSelectedFoodBank(get, set)
      foodBankId = resolvedFoodBank?.id ?? null
    }
    if (!foodBankId || foodBankId <= 0) {
      throw new Error('No food bank available. Create a food bank before adding packages.')
    }
    const normalizedPackage = normalizePackage(
      await adminAPI.createFoodPackage(
        {
        ...data,
        food_bank_id: foodBankId,
        },
        getRequiredAccessToken(),
      ),
    )
    set((state) => ({
      packages: [normalizedPackage, ...state.packages],
    }))
  },
  updatePackage: async (packageId, data) => {
    const updatedPackage = await adminAPI.updateFoodPackage(
      packageId,
      {
        ...data,
        applied_count: data.appliedCount,
      },
      getRequiredAccessToken(),
    )
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
      const [userCoords, internalFoodBanksResponse, nearby, rankedNearby] = await Promise.all([
        getCoordinatesFromPostcode(postcode),
        foodBanksAPI.getFoodBanks(),
        getNearbyFoodbanks(postcode),
        getRankedFoodbanks(postcode),
      ])
      console.info('[FindFoodBank] search start', {
        postcode,
        searchedLocation: userCoords,
        externalNearbyCount: nearby.length,
      })
      const internalBanks = internalFoodBanksResponse.items
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
            const packageCount = (await packagesAPI.listFoodBankPackages(bank.id)).length
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
        const displayAddress = buildFoodBankDisplayAddress(fb.address, fb.postcode)
        const mapped = findInternalFoodBankMatch(
          { name: fb.name, address: displayAddress },
          internalBanksWithPackages,
        )
        const packageSourceBank = mapped?.systemMatched
          ? mapped
          : defaultOnlineBank
        const isOnline = Boolean(packageSourceBank)
        return {
          id: packageSourceBank?.id ?? -1,
          name: fb.name,
          address: displayAddress,
          distance: fb.distance,
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
      const accessToken = useAuthStore.getState().accessToken
      if (!accessToken) {
        return
      }
      const response = await applicationsAPI.getMyApplications(accessToken)
      const items = response.items as UserApplicationSummary[]
      const targetWeek = weekStart || getCurrentWeekMonday()
      const totalCollected = items
        .filter((application) => application.week_start === targetWeek)
        .reduce((sum, application) => sum + Number(application.total_quantity ?? 0), 0)
      set({ weeklyCollected: totalCollected })
    } catch (error) {
      console.error('Failed to load collections:', error)
    }
  },
  applyPackages: async (_userEmail, selections, weekStart, itemSelections = []) => {
    try {
      const accessToken = useAuthStore.getState().accessToken
      const currentUser = useAuthStore.getState().user
      if (!accessToken || !currentUser) {
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
      const payload: ApplicationCreatePayload = {
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
      }
      const result = await applicationsAPI.submitApplication(payload, accessToken)
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
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error during application',
      }
    }
  },
  resetSearch: () =>
    set({ searchPostcode: '', searchResults: [], searchedLocation: null, hasSearched: false, searchError: null, selectedFoodBank: null, packages: [], availableItems: [] }),
}))


