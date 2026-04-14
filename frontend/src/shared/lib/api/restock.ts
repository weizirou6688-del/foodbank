import { apiClient } from '../apiClient'

export type RestockUrgency = 'high' | 'medium' | 'low'
export type RestockRequestStatus = 'open' | 'fulfilled' | 'cancelled'

export interface RestockRequestRecord {
  id: number
  inventory_item_id: number
  inventory_item_name?: string | null
  inventory_item_unit?: string | null
  current_stock: number
  threshold: number
  stock_deficit: number
  urgency: RestockUrgency
  assigned_to_user_id?: string | null
  status: RestockRequestStatus
  created_at: string
}

interface RestockRequestListResponse {
  items: RestockRequestRecord[]
  total: number
  page: number
  size: number
  pages: number
}

export interface RestockRequestCreatePayload {
  inventory_item_id: number
  current_stock: number
  threshold: number
  urgency: RestockUrgency
  assigned_to_user_id?: string
}

export const restockAPI = {
  listRequests: (token: string) =>
    apiClient.get<RestockRequestListResponse>('/api/v1/restock', token),
  createRequest: (data: RestockRequestCreatePayload, token: string) =>
    apiClient.post<RestockRequestRecord>('/api/v1/restock', data, token),
  fulfilRequest: (id: number | string, token: string) =>
    apiClient.post<RestockRequestRecord>(`/api/v1/restock/${id}/fulfil`, {}, token),
  cancelRequest: (id: number | string, token: string) =>
    apiClient.delete(`/api/v1/restock/${id}`, token),
}
