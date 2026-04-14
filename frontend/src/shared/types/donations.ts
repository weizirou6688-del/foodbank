export type DonationDonorType = 'supermarket' | 'individual' | 'organization'
export type CashDonationFrequency = 'one_time' | 'monthly'

interface GoodsDonationApiItem {
  id: number
  donation_id: string
  item_name: string
  quantity: number
  expiry_date?: string | null
}

export interface GoodsDonationResponse {
  id: string
  donor_user_id?: string | null
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  donor_name: string
  donor_type?: DonationDonorType | null
  donor_email: string
  donor_phone: string
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  notes?: string | null
  status: 'pending' | 'received' | 'rejected'
  created_at: string
  items: GoodsDonationApiItem[]
}

export interface DonationListRow {
  id: string
  donation_type: 'cash' | 'goods'
  donor_email?: string
  donor_name?: string
  donor_type?: DonationDonorType | null
  donor_phone?: string
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  amount_pence?: number
  donation_frequency?: CashDonationFrequency
  payment_reference?: string | null
  subscription_reference?: string | null
  card_last4?: string | null
  next_charge_date?: string | null
  status?: string
  notes?: string | null
  created_at?: string
  items?: GoodsDonationApiItem[]
}
