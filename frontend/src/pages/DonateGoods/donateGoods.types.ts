export type FeatureCardContent = {
  title: string
  description: string
  image?: string
}

export type FoodBankOption = {
  id: string
  foodBankId?: number | null
  foodBankEmail?: string
  name: string
  address: string
  postcode: string
  distance: string
  distanceMiles: number
}

export type DonationDetails = {
  name: string
  email: string
  phone: string
  pickupDate: string
  items: string
  condition: string
  quantity: string
  notes: string
}

export type InternalFoodBankRecord = {
  id: number
  name: string
  address: string
  lat: number
  lng: number
  notification_email?: string | null
}

export type FeedbackState = {
  type: 'success' | 'error'
  message: string
}

export type AcceptedItemsGroup = {
  category: string
  items: string[]
}

export type FieldErrors = Record<string, string>
