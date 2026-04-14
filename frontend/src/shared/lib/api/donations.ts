import type { CashDonationFrequency, DonationDonorType, GoodsDonationResponse } from '@/shared/types/donations'
import { apiClient } from '../apiClient'

type GoodsDonationStatus = 'pending' | 'received' | 'rejected'
type CashDonationStatus = 'completed' | 'failed' | 'refunded'

interface CashDonationResponse {
  id: string
  donor_name?: string | null
  donor_type?: DonationDonorType | null
  donor_email: string
  food_bank_id?: number | null
  amount_pence: number
  donation_frequency: CashDonationFrequency
  payment_reference?: string | null
  subscription_reference?: string | null
  card_last4?: string | null
  next_charge_date?: string | null
  status: CashDonationStatus
  created_at: string
}

interface GoodsDonationItemPayload {
  item_name: string
  quantity: number
  expiry_date?: string
}

export interface GoodsDonationCreatePayload {
  donor_name: string
  donor_type?: DonationDonorType
  donor_email: string
  donor_phone: string
  food_bank_id?: number | null
  food_bank_name?: string
  food_bank_address?: string
  food_bank_email?: string
  postcode?: string
  pickup_date?: string
  item_condition?: string
  estimated_quantity?: string
  notes?: string
  items: GoodsDonationItemPayload[]
  status?: GoodsDonationStatus
}

export interface GoodsDonationUpdatePayload {
  donor_name?: string
  donor_type?: DonationDonorType
  donor_email?: string
  donor_phone?: string
  food_bank_id?: number | null
  food_bank_name?: string | null
  food_bank_address?: string | null
  postcode?: string | null
  pickup_date?: string | null
  item_condition?: string | null
  estimated_quantity?: string | null
  notes?: string | null
  status?: GoodsDonationStatus
  items?: GoodsDonationItemPayload[]
}

export const donationsAPI = {
  donateCash: (data: {
    donor_name?: string
    donor_type?: DonationDonorType
    donor_email: string
    food_bank_id?: number
    amount_pence: number
    donation_frequency?: CashDonationFrequency
    payment_reference?: string
    card_last4?: string
  }) => apiClient.post<CashDonationResponse>('/api/v1/donations/cash', data),
  donateGoods: (data: GoodsDonationCreatePayload) =>
    apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods', data),
  submitSupermarketDonation: (
    data: {
      donor_phone?: string
      pickup_date?: string
      notes?: string
      items: Array<{
        inventory_item_id?: number
        item_name?: string
        quantity: number
        expiry_date?: string
      }>
    },
    token: string,
  ) => apiClient.post<GoodsDonationResponse>('/api/v1/donations/goods/supermarket', data, token),
}
