import type { ApplicationStatus } from '@/shared/types/applications'
import { apiClient } from '../apiClient'

type ApplicationRequestItemPayload =
  | { package_id: number; quantity: number; inventory_item_id?: never }
  | { inventory_item_id: number; quantity: number; package_id?: never }

export interface ApplicationCreatePayload {
  food_bank_id: number
  week_start?: string
  items: ApplicationRequestItemPayload[]
}

interface AdminApplicationItem {
  id: number
  package_id?: number | null
  inventory_item_id?: number | null
  name: string
  quantity: number
}

export interface AdminApplicationRecord {
  id: string
  user_id: string
  food_bank_id: number
  redemption_code: string
  status: ApplicationStatus
  week_start: string
  total_quantity: number
  created_at: string
  updated_at: string
  redeemed_at?: string | null
  deleted_at?: string | null
  items: AdminApplicationItem[]
  package_name?: string | null
  is_voided: boolean
  voided_at?: string | null
}

interface AdminApplicationListResponse {
  items: AdminApplicationRecord[]
  total: number
  page: number
  size: number
  pages: number
}

interface UserApplicationRecord {
  id: string
  user_id: string
  food_bank_id: number
  redemption_code: string
  status: ApplicationStatus
  week_start: string
  total_quantity: number
  created_at: string
  updated_at: string
  redeemed_at?: string | null
  deleted_at?: string | null
}

interface UserApplicationListResponse {
  items: UserApplicationRecord[]
  total: number
  page: number
  size: number
  pages: number
}

export const applicationsAPI = {
  submitApplication: (data: ApplicationCreatePayload, token: string) =>
    apiClient.post<UserApplicationRecord>('/api/v1/applications', data, token),
  getMyApplications: (token: string) => apiClient.get<UserApplicationListResponse>('/api/v1/applications/my', token),
  getAdminApplications: (token: string) =>
    apiClient.get<AdminApplicationListResponse>('/api/v1/applications/admin/records', token),
  getApplicationByCode: (code: string, token: string) =>
    apiClient.get<AdminApplicationRecord>(`/api/v1/applications/admin/by-code/${encodeURIComponent(code)}`, token),
  redeemApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(`/api/v1/applications/admin/${id}/redeem`, {}, token),
  voidApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(`/api/v1/applications/admin/${id}/void`, {}, token),
}
