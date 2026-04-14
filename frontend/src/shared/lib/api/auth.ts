import type { User } from '@/shared/types/auth'
import { apiClient } from '../apiClient'

interface AuthTokenResponse {
  access_token: string
  token_type: string
  user: User
}

interface MessageResponse {
  message?: string
}

export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post<User>('/api/v1/auth/register', data),
  login: (data: { email: string; password: string }) => apiClient.post<AuthTokenResponse>('/api/v1/auth/login', data),
  getMe: (token: string) => apiClient.get<User>('/api/v1/auth/me', token),
  forgotPassword: (data: { email: string }) => apiClient.post<MessageResponse>('/api/v1/auth/forgot-password', data),
  resetPassword: (data: { email: string; verification_code: string; new_password: string }) =>
    apiClient.post<MessageResponse>('/api/v1/auth/reset-password', data),
  logout: (token: string) => apiClient.postNoContent('/api/v1/auth/logout', {}, token),
}
