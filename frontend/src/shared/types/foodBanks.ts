export interface FoodBank {
  id: number
  name: string
  address: string
  notification_email?: string | null
  distance?: number
  lat: number
  lng: number
  phone?: string
  email?: string
  url?: string
  systemMatched?: boolean
}
