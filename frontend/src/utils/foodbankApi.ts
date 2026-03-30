import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

const SEARCH_RADIUS_KM = 5
const EXTERNAL_FEED_URL = 'https://www.givefood.org.uk/api/1/foodbanks/'
const DIRECT_POSTCODE_API_URL = 'https://api.postcodes.io/postcodes'
const FEED_CACHE_TTL_MS = 10 * 60 * 1000

interface GiveFoodBankApiRecord {
  name: string
  address: string
  postcode: string
  lat?: number | null
  lng?: number | null
  latt_long?: string | null
  phone?: string
  email?: string
  url?: string
  needs?: string[]
}

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
  hours?: string[]
  distance: number
}

interface PostcodesIoResponse {
  status: number
  result?: {
    latitude: number
    longitude: number
  }
  error?: string
}

let cachedFoodbanks: GiveFoodBankApiRecord[] | null = null
let cachedFoodbanksAt = 0
let inFlightFoodbanksRequest: Promise<GiveFoodBankApiRecord[]> | null = null
const postcodeCache = new Map<string, { lat: number; lng: number }>()
const trussellHoursCache = new Map<string, string[]>()

export async function getCoordinatesFromPostcode(postcode: string): Promise<{ lat: number; lng: number }> {
  const normalizedPostcode = postcode.trim()
  const cachedCoords = postcodeCache.get(normalizedPostcode.toUpperCase())
  if (cachedCoords) {
    return cachedCoords
  }

  const directResponse = await fetch(`${DIRECT_POSTCODE_API_URL}/${encodeURIComponent(normalizedPostcode)}`)
  const directPayload = await directResponse.json().catch(() => null) as PostcodesIoResponse | null
  if (directResponse.ok && directPayload?.status === 200 && directPayload.result) {
    const coords = {
      lat: directPayload.result.latitude,
      lng: directPayload.result.longitude,
    }
    postcodeCache.set(normalizedPostcode.toUpperCase(), coords)
    return coords
  }

  throw new Error(directPayload?.error || `Invalid postcode: ${postcode}`)
}

export async function getAllFoodbanks(): Promise<GiveFoodBankApiRecord[]> {
  const now = Date.now()
  if (cachedFoodbanks && now - cachedFoodbanksAt < FEED_CACHE_TTL_MS) {
    return cachedFoodbanks
  }

  if (inFlightFoodbanksRequest) {
    return inFlightFoodbanksRequest
  }

  inFlightFoodbanksRequest = (async () => {
    const backendResponse = await fetch(`${API_BASE_URL}/api/v1/food-banks/external-feed`)
    if (backendResponse.ok) {
      const payload = await backendResponse.json() as GiveFoodBankApiRecord[]
      cachedFoodbanks = payload
      cachedFoodbanksAt = Date.now()
      return payload
    }

    const directResponse = await fetch(EXTERNAL_FEED_URL)
    if (!directResponse.ok) {
      throw new Error('Failed to fetch food banks')
    }

    const payload = await directResponse.json() as GiveFoodBankApiRecord[]
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

export async function getTrussellOpeningHours(foodbankUrl?: string): Promise<string[]> {
  if (!foodbankUrl || !/foodbank\.org\.uk/i.test(foodbankUrl)) {
    return []
  }

  const cached = trussellHoursCache.get(foodbankUrl)
  if (cached) {
    return cached
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/food-banks/trussell-hours?foodbank_url=${encodeURIComponent(foodbankUrl)}`,
  )
  if (!response.ok) {
    return []
  }

  const payload = await response.json() as { hours?: string[] }
  const hours = Array.isArray(payload.hours) ? payload.hours : []
  trussellHoursCache.set(foodbankUrl, hours)
  return hours
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

function parseCoordinates(foodbank: GiveFoodBankApiRecord): { lat: number; lng: number } | null {
  if (typeof foodbank.lat === 'number' && typeof foodbank.lng === 'number') {
    return { lat: foodbank.lat, lng: foodbank.lng }
  }

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
  const withinRadius = rankedByDistance.filter((foodbank) => foodbank.distance <= SEARCH_RADIUS_KM)

  return Promise.all(
    withinRadius.map(async (foodbank) => ({
      ...foodbank,
      hours: await getTrussellOpeningHours(foodbank.url),
    })),
  )
}
