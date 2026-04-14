import { buildFoodBankDisplayAddress, findInternalFoodBankMatch, normalizeWhitespace } from '@/shared/lib/foodBankAddress'
import { isValidEmail } from '@/shared/lib/validation'
import type { NearbyFoodBank } from '@/utils/foodbankApi'
import { LOCAL_SEARCH_RADIUS_KM } from './donateGoods.constants'
import type { DonationDetails, FoodBankOption, InternalFoodBankRecord } from './donateGoods.types'

type SearchCoordinates = {
  lat: number
  lng: number
}

type InternalFoodBankSource = {
  id: number | string
  name: string
  address: string
  lat?: number | string | null
  lng?: number | string | null
  notification_email?: string | null
}

type ParsedPickupDate = {
  date: Date
  isoDate: string
  ukDate: string
}

function formatUkDate(date: Date) {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear().toString().padStart(4, '0')
  return `${day}/${month}/${year}`
}

export function parsePickupDate(value: string): ParsedPickupDate | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  let day = 0
  let month = 0
  let year = 0

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmedValue)) {
    const parts = trimmedValue.split('-').map(Number)
    year = parts[0] ?? 0
    month = parts[1] ?? 0
    day = parts[2] ?? 0
  } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmedValue)) {
    const normalizedValue = trimmedValue.replace(/-/g, '/')
    const parts = normalizedValue.split('/').map(Number)
    day = parts[0] ?? 0
    month = parts[1] ?? 0
    year = parts[2] ?? 0
  } else if (/^\d{8}$/.test(trimmedValue)) {
    day = Number(trimmedValue.slice(0, 2))
    month = Number(trimmedValue.slice(2, 4))
    year = Number(trimmedValue.slice(4))
  } else {
    return null
  }

  const parsedDate = new Date(year, month - 1, day)

  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return null
  }

  return {
    date: parsedDate,
    isoDate: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    ukDate: formatUkDate(parsedDate),
  }
}

function getStartOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function getPickupDateError(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return 'Preferred collection or drop-off date is required.'
  }

  const parsedPickupDate = parsePickupDate(trimmedValue)
  if (!parsedPickupDate) {
    return 'Please enter a valid date in DD/MM/YYYY format.'
  }

  if (parsedPickupDate.date < getStartOfToday()) {
    return 'Please enter a valid date on or after today.'
  }

  return ''
}

export function getPhoneError(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return 'Phone number is required.'
  }

  if (trimmedValue.length < 3) {
    return 'Phone number must be at least 3 characters.'
  }

  return ''
}

export function estimateQuantity(value: string) {
  const numbers = value.match(/\d+/g)
  if (!numbers) {
    return 1
  }

  const total = numbers.reduce((sum, current) => sum + Number(current), 0)
  return total > 0 ? total : 1
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function formatDistanceMiles(distanceKm: number) {
  const distanceMiles = distanceKm * 0.621371
  return `${distanceMiles.toFixed(1)} miles`
}

function mapInternalFoodBanks(
  internalBanks: readonly InternalFoodBankSource[],
  userCoords: SearchCoordinates,
  localSearchRadiusKm: number,
): InternalFoodBankRecord[] {
  return internalBanks
    .flatMap((bank) => {
      const id = Number(bank.id)
      const lat = Number(bank.lat)
      const lng = Number(bank.lng)

      if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return []
      }

      const distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, lat, lng)
      if (distanceKm > localSearchRadiusKm) {
        return []
      }

      return [{
        id,
        name: bank.name,
        address: bank.address,
        lat,
        lng,
        notification_email:
          typeof bank.notification_email === 'string'
            ? bank.notification_email
            : null,
      } satisfies InternalFoodBankRecord]
    })
    .sort((left, right) => {
      const leftDistance = haversineDistanceKm(userCoords.lat, userCoords.lng, left.lat, left.lng)
      const rightDistance = haversineDistanceKm(userCoords.lat, userCoords.lng, right.lat, right.lng)
      return leftDistance - rightDistance
    })
}

export function buildRankedFoodBankOptions({
  userCoords,
  internalBanks,
  nearbyBanks,
  localSearchRadiusKm = LOCAL_SEARCH_RADIUS_KM,
}: {
  userCoords: SearchCoordinates
  internalBanks: readonly InternalFoodBankSource[]
  nearbyBanks: readonly NearbyFoodBank[]
  localSearchRadiusKm?: number
}): FoodBankOption[] {
  const nearbyInternalBanks = mapInternalFoodBanks(internalBanks, userCoords, localSearchRadiusKm)
  const matchedInternalBankIds = new Set<number>()

  return nearbyBanks
    .map((bank) => {
      const displayAddress = buildFoodBankDisplayAddress(bank.address, bank.postcode)
      const matchedInternalBank = findInternalFoodBankMatch(
        { name: bank.name, address: displayAddress },
        nearbyInternalBanks,
      )

      if (matchedInternalBank) {
        matchedInternalBankIds.add(matchedInternalBank.id)
      }

      return {
        id: matchedInternalBank
          ? `internal-${matchedInternalBank.id}`
          : `${bank.name}-${bank.postcode}-${bank.lat}-${bank.lng}`,
        foodBankId: matchedInternalBank?.id,
        foodBankEmail: matchedInternalBank?.notification_email?.trim() || bank.email,
        name: bank.name,
        address: displayAddress,
        postcode: bank.postcode,
        distance: formatDistanceMiles(bank.distance),
        distanceMiles: bank.distance * 0.621371,
      } satisfies FoodBankOption
    })
    .concat(
      nearbyInternalBanks
        .filter((bank) => !matchedInternalBankIds.has(bank.id))
        .map((bank) => {
          const distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, bank.lat, bank.lng)

          return {
            id: `internal-${bank.id}`,
            foodBankId: bank.id,
            foodBankEmail: bank.notification_email?.trim() || undefined,
            name: bank.name,
            address: normalizeWhitespace(bank.address),
            postcode: '',
            distance: formatDistanceMiles(distanceKm),
            distanceMiles: distanceKm * 0.621371,
          } satisfies FoodBankOption
        }),
    )
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
}

export function validateDonationDetails(details: DonationDetails) {
  const nextErrors: Record<string, string> = {}

  if (!details.name.trim()) {
    nextErrors.name = 'Full name is required.'
  }

  if (!isValidEmail(details.email)) {
    nextErrors.email = 'Please enter a valid email address.'
  }

  const phoneError = getPhoneError(details.phone)
  if (phoneError) {
    nextErrors.phone = phoneError
  }

  const pickupDateError = getPickupDateError(details.pickupDate)
  if (pickupDateError) {
    nextErrors.pickupDate = pickupDateError
  }

  if (!details.items.trim()) {
    nextErrors.items = 'Please describe the items you are donating.'
  }

  if (!details.condition) {
    nextErrors.condition = 'Please select the item condition.'
  }

  return nextErrors
}
