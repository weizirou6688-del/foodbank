import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/types/common'
import { authAPI } from '@/shared/lib/api'

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

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,

      login: async (email, password) => {
        try {
          const data = await authAPI.login({ email, password })
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
            message: getErrorMessage(error, 'Login failed'),
          }
        }
      },

      refreshAccessToken: async () => {
        try {
          const currentRefreshToken = useAuthStore.getState().refreshToken
          if (!currentRefreshToken) {
            return false
          }

          try {
            const data = await authAPI.refreshAccessToken(currentRefreshToken)
            set((state) => ({
              ...state,
              accessToken: data.access_token,
              isAuthenticated: true,
            }))
            return true
          } catch {
            set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
            return false
          }
        } catch {
          return false
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      },

      register: async (name, email, password) => {
        try {
          await authAPI.register({ name, email, password })

          // After successful registration, automatically log in
          try {
            const loginData = await authAPI.login({ email, password })
            set({
              user: normalizeUser(loginData.user),
              isAuthenticated: true,
              accessToken: loginData.access_token,
              refreshToken: loginData.refresh_token ?? null,
            })
          } catch {
            // Keep registration successful even if auto-login fails.
          }
          return { success: true }
        } catch (error) {
          return { success: false, message: getErrorMessage(error, 'Registration failed') }
        }
      },

      forgotPassword: async (email) => {
        try {
          const data = await authAPI.forgotPassword({ email })
          return {
            success: true,
            message: data.message,
          }
        } catch (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Unable to start password reset'),
          }
        }
      },

      resetPassword: async (email, verificationCode, newPassword) => {
        try {
          const data = await authAPI.resetPassword({
            email,
            verification_code: verificationCode,
            new_password: newPassword,
          })
          return {
            success: true,
            message: data.message ?? 'Password reset successful.',
          }
        } catch (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Password reset failed'),
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
