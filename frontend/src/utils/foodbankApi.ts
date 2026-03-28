import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

interface GiveFoodBankApiRecord {
  name: string
  address: string
  postcode: string
  lat?: number | null
  lng?: number | null
  latt_long?: string | null
  phone?: string
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
  url?: string
  needs?: string[]
  distance: number
}

interface PostcodesIoResponse {
  lat: number
  lng: number
  source: string
}

export async function getCoordinatesFromPostcode(postcode: string): Promise<{ lat: number; lng: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/food-banks/geocode?postcode=${encodeURIComponent(postcode.trim())}`,
  )
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Invalid postcode' })) as { detail?: string }
    throw new Error(err.detail || `Invalid postcode: ${postcode}`)
  }

  const data = (await response.json()) as PostcodesIoResponse

  return {
    lat: data.lat,
    lng: data.lng,
  }
}

export async function getAllFoodbanks(): Promise<GiveFoodBankApiRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/food-banks/external-feed`)
  if (!response.ok) {
    throw new Error('Failed to fetch food banks')
  }

  return response.json() as Promise<GiveFoodBankApiRecord[]>
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

export async function getNearbyFoodbanks(postcode: string): Promise<NearbyFoodBank[]> {
  const userCoords = await getCoordinatesFromPostcode(postcode)
  const allFoodbanks = await getAllFoodbanks()

  const rankedByDistance = allFoodbanks
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

  const withinTwoMiles = rankedByDistance.filter((foodbank) => foodbank.distance <= 3.218688)
  if (withinTwoMiles.length > 0) {
    return withinTwoMiles
  }

  // Fallback: return nearest results even if no food bank is inside strict 2-mile radius.
  return rankedByDistance.slice(0, 10)
}