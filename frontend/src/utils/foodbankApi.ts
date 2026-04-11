import {
  foodBanksAPI,
  type ExternalFoodBankRecord,
} from '@/shared/lib/api'

const SEARCH_RADIUS_KM = 5
const FEED_CACHE_TTL_MS = 10 * 60 * 1000

export interface NearbyFoodBank {
  name: string
  address: string
  postcode: string
  lat: number
  lng: number
  phone?: string
  email?: string
  url?: string
  needs?: string[]
  distance: number
}

let cachedFoodbanks: ExternalFoodBankRecord[] | null = null
let cachedFoodbanksAt = 0
let inFlightFoodbanksRequest: Promise<ExternalFoodBankRecord[]> | null = null
const postcodeCache = new Map<string, { lat: number; lng: number }>()

export async function getCoordinatesFromPostcode(postcode: string): Promise<{ lat: number; lng: number }> {
  const normalizedPostcode = postcode.trim()
  const cachedCoords = postcodeCache.get(normalizedPostcode.toUpperCase())
  if (cachedCoords) {
    return cachedCoords
  }

  const payload = await foodBanksAPI.geocodePostcode(normalizedPostcode)
  const coords = {
    lat: payload.lat,
    lng: payload.lng,
  }
  postcodeCache.set(normalizedPostcode.toUpperCase(), coords)
  return coords
}

export async function getAllFoodbanks(): Promise<ExternalFoodBankRecord[]> {
  const now = Date.now()
  if (cachedFoodbanks && now - cachedFoodbanksAt < FEED_CACHE_TTL_MS) {
    return cachedFoodbanks
  }

  if (inFlightFoodbanksRequest) {
    return inFlightFoodbanksRequest
  }

  inFlightFoodbanksRequest = (async () => {
    // GiveFood does not expose browser-friendly CORS headers, so this search
    // must flow through our backend proxy.
    const payload = await foodBanksAPI.getExternalFeed()
    cachedFoodbanks = payload
    cachedFoodbanksAt = Date.now()
    return payload
  })()

  try {
    return await inFlightFoodbanksRequest
  } finally {
    inFlightFoodbanksRequest = null
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function parseCoordinates(foodbank: ExternalFoodBankRecord): { lat: number; lng: number } | null {
  if (typeof foodbank.lat === 'number' && typeof foodbank.lng === 'number') {
    return { lat: foodbank.lat, lng: foodbank.lng }
  }

  // GiveFood sometimes ships coordinates as a single comma-separated string, so
  // we normalize both formats into one consistent shape here.
  if (!foodbank.latt_long) {
    return null
  }

  const [latStr, lngStr] = foodbank.latt_long.split(',')
  const lat = Number(latStr)
  const lng = Number(lngStr)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return { lat, lng }
}

async function getRankedFoodbanksFromCoords(userCoords: { lat: number; lng: number }): Promise<NearbyFoodBank[]> {
  const allFoodbanks = await getAllFoodbanks()

  return allFoodbanks
    .flatMap((foodbank) => {
      const coords = parseCoordinates(foodbank)
      if (!coords) {
        return []
      }

      return [{
        ...foodbank,
        lat: coords.lat,
        lng: coords.lng,
        distance: haversineDistance(userCoords.lat, userCoords.lng, coords.lat, coords.lng),
      }]
    })
    .sort((a, b) => a.distance - b.distance)
}

export async function getRankedFoodbanks(postcode: string): Promise<NearbyFoodBank[]> {
  const userCoords = await getCoordinatesFromPostcode(postcode)
  return getRankedFoodbanksFromCoords(userCoords)
}

export async function getNearbyFoodbanks(postcode: string): Promise<NearbyFoodBank[]> {
  const rankedByDistance = await getRankedFoodbanks(postcode)
  return rankedByDistance.filter((foodbank) => foodbank.distance <= SEARCH_RADIUS_KM)
}
