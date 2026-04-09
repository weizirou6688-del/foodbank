import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/types/common'
import { API_BASE_URL } from '@/shared/lib/apiBaseUrl'

type AuthActionResult = {
  success: boolean
  message?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  login: (email: string, password: string) => Promise<AuthActionResult>
  refreshAccessToken: () => Promise<boolean>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<AuthActionResult>
  forgotPassword: (email: string) => Promise<AuthActionResult>
  resetPassword: (email: string, verificationCode: string, newPassword: string) => Promise<AuthActionResult>
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const error = await response.json()

    if (typeof error?.detail === 'string') {
      return error.detail
    }

    if (typeof error?.message === 'string') {
      return error.message
    }

    if (Array.isArray(error?.errors) && error.errors.length > 0) {
      const firstError = error.errors[0]
      if (firstError && typeof firstError.message === 'string') {
        return firstError.message
      }
    }
  } catch {
    return fallback
  }

  return fallback
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
            return {
              success: false,
              message: await readApiErrorMessage(response, 'Login failed'),
            }
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
            return {
              success: false,
              message: await readApiErrorMessage(response, 'Registration failed'),
            }
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

      forgotPassword: async (email) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })

          if (!response.ok) {
            return {
              success: false,
              message: await readApiErrorMessage(response, 'Unable to start password reset'),
            }
          }

          const data = (await response.json()) as { message?: string }
          return {
            success: true,
            message: data.message,
          }
        } catch {
          return {
            success: false,
            message: `Network error during password reset request. Cannot reach API at ${API_BASE_URL}`,
          }
        }
      },

      resetPassword: async (email, verificationCode, newPassword) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              verification_code: verificationCode,
              new_password: newPassword,
            }),
          })

          if (!response.ok) {
            return {
              success: false,
              message: await readApiErrorMessage(response, 'Password reset failed'),
            }
          }

          const data = (await response.json()) as { message?: string }
          return {
            success: true,
            message: data.message ?? 'Password reset successful.',
          }
        } catch {
          return {
            success: false,
            message: `Network error during password reset. Cannot reach API at ${API_BASE_URL}`,
          }
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
