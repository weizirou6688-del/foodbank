import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/types/common'
import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  refreshAccessToken: () => Promise<boolean>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>
}

function normalizeUser(user: User | null | undefined): User | null {
  if (!user) {
    return null
  }

  return {
    ...user,
    food_bank_id: user.food_bank_id ?? null,
    food_bank_name: user.food_bank_name ?? null,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,

      login: async (email, password) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            return { success: false, message: error.detail || 'Login failed' }
          }

          const data = await response.json()
          set({
            user: normalizeUser(data.user),
            isAuthenticated: true,
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? null,
          })
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: `Network error during login. Cannot reach API at ${API_BASE_URL}`,
          }
        }
      },

      refreshAccessToken: async () => {
        try {
          const currentRefreshToken = useAuthStore.getState().refreshToken
          if (!currentRefreshToken) {
            return false
          }

          const response = await fetch(
            `${API_BASE_URL}/api/v1/auth/refresh?refresh_token=${encodeURIComponent(currentRefreshToken)}`,
            { method: 'POST' },
          )

          if (!response.ok) {
            set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
            return false
          }

          const data = await response.json()
          set((state) => ({
            ...state,
            accessToken: data.access_token,
            isAuthenticated: true,
          }))
          return true
        } catch {
          return false
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      },

      register: async (name, email, password) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            return { success: false, message: error.detail || 'Registration failed' }
          }

          // After successful registration, automatically log in
          const loginResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (loginResponse.ok) {
            const loginData = await loginResponse.json()
            set({
              user: normalizeUser(loginData.user),
              isAuthenticated: true,
              accessToken: loginData.access_token,
              refreshToken: loginData.refresh_token ?? null,
            })
          }
          return { success: true }
        } catch (error) {
          return { success: false, message: 'Network error during registration' }
        }
      },
    }),
    {
      name: 'fba-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)
