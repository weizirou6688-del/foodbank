interface GiveFoodBank {
  name: string
  address: string
  postcode: string
  lat: number
  lng: number
  phone?: string
  url?: string
  needs?: string[]
}

export interface NearbyFoodBank extends GiveFoodBank {
  distance: number
}

interface PostcodesIoResponse {
  status: number
  result?: {
    latitude: number
    longitude: number
  }
}

export async function getCoordinatesFromPostcode(postcode: string): Promise<{ lat: number; lng: number }> {
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
  const data = (await response.json()) as PostcodesIoResponse

  if (data.status !== 200 || !data.result) {
    throw new Error(`Invalid postcode: ${postcode}`)
  }

  return {
    lat: data.result.latitude,
    lng: data.result.longitude,
  }
}

export async function getAllFoodbanks(): Promise<GiveFoodBank[]> {
  const response = await fetch('https://www.givefood.org.uk/api/1/foodbanks.json')
  if (!response.ok) {
    throw new Error('Failed to fetch food banks')
  }

  return response.json() as Promise<GiveFoodBank[]>
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

export async function getNearbyFoodbanks(postcode: string): Promise<NearbyFoodBank[]> {
  const userCoords = await getCoordinatesFromPostcode(postcode)
  const allFoodbanks = await getAllFoodbanks()

  return allFoodbanks
    .map((foodbank) => ({
      ...foodbank,
      distance: haversineDistance(userCoords.lat, userCoords.lng, foodbank.lat, foodbank.lng),
    }))
    .filter((foodbank) => foodbank.distance <= 2)
    .sort((a, b) => a.distance - b.distance)
}