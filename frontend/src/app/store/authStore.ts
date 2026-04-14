import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/shared/types/auth'
import { authAPI } from '@/shared/lib/api/auth'

type AuthActionResult = {
  success: boolean
  message?: string
}

type AuthSessionPayload = {
  access_token: string
  user: User
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<AuthActionResult>
  refreshSession: () => Promise<void>
  logout: () => void
  signOut: () => Promise<void>
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

const clearedAuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
}

function buildAuthenticatedState(payload: AuthSessionPayload) {
  return {
    user: normalizeUser(payload.user),
    isAuthenticated: true,
    accessToken: payload.access_token,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...clearedAuthState,
      login: async (email, password) => {
        try {
          const session = await authAPI.login({ email, password })
          set(buildAuthenticatedState(session))
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Login failed'),
          }
        }
      },
      refreshSession: async () => {
        const accessToken = useAuthStore.getState().accessToken
        if (!accessToken) {
          return
        }

        try {
          const user = await authAPI.getMe(accessToken)
          set({
            user: normalizeUser(user),
            isAuthenticated: true,
            accessToken,
          })
        } catch (error) {
          const message = getErrorMessage(error, '')
          if (message === 'User not found') {
            set(clearedAuthState)
          }
        }
      },
      logout: () => {
        set(clearedAuthState)
      },
      signOut: async () => {
        const accessToken = useAuthStore.getState().accessToken
        set(clearedAuthState)

        if (!accessToken) {
          return
        }

        try {
          await authAPI.logout(accessToken)
        } catch {
          // Local sign-out has already completed. Ignore remote logout failures.
        }
      },
      register: async (name, email, password) => {
        try {
          await authAPI.register({ name, email, password })

          try {
            const session = await authAPI.login({ email, password })
            set(buildAuthenticatedState(session))
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
      }),
    },
  ),
)
