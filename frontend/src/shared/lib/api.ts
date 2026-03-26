import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async get(endpoint: string, token?: string) {
    return this.request(endpoint, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async post(endpoint: string, data?: Record<string, any>, token?: string) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data || {}),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async patch(endpoint: string, data?: Record<string, any>, token?: string) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
  }

  async delete(endpoint: string, token?: string) {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return null
  }
}

const apiClient = new APIClient(API_BASE_URL)

export const donationsAPI = {
  donateCash: (data: {
    email: string
    amount: number
    cardholder_name: string
    card_number: string
    expiry_date: string
    cvv: string
  }) => apiClient.post('/api/v1/donations/cash', data),

  donateGoods: (
    data: {
      donor_name: string
      contact_email: string
      items: Array<{ name: string; quantity: number; category: string }>
    },
    token: string
  ) => apiClient.post('/api/v1/donations/goods', data, token),
}

export const statsAPI = {
  getOverview: () => apiClient.get('/api/v1/stats/overview'),
}

export const restockAPI = {
  getRequests: (token: string) =>
    apiClient.get('/api/v1/restock-requests', token),

  submitRequest: (
    data: {
      supermarket_id: string
      items: Array<{ food_name: string; quantity: number }>
      notes?: string
    },
    token: string
  ) => apiClient.post('/api/v1/restock-requests', data, token),
}

export const adminAPI = {
  getStats: (token: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') =>
    apiClient.get(`/api/v1/stats/admin?period=${period}`, token),

  getFoodPackages: (token: string) =>
    apiClient.get('/api/v1/food-packages/admin', token),

  updateFoodPackage: (
    id: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/packages/${id}`, data, token),

  deleteFoodPackage: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/packages/${id}`, token),

  getInventoryItems: (token: string) =>
    apiClient.get('/api/v1/inventory/items', token),

  updateInventoryItem: (
    id: number | string,
    data: Record<string, any>,
    token: string
  ) => apiClient.patch(`/api/v1/inventory/${id}`, data, token),

  deleteInventoryItem: (
    id: number | string,
    token: string
  ) => apiClient.delete(`/api/v1/inventory/${id}`, token),
}
