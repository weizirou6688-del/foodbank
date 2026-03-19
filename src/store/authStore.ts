import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { MOCK_USERS } from '@/data/mockData'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => { success: boolean; message?: string }
  logout: () => void
  register: (name: string, email: string, password: string) => { success: boolean; message?: string }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (email, password) => {
        const found = MOCK_USERS.find(
          (u) => u.email === email && u.password === password,
        )
        if (found) {
          const { password: _pw, ...user } = found
          void _pw
          set({ user, isAuthenticated: true })
          return { success: true }
        }
        return { success: false, message: 'Incorrect email or password.' }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },

      register: (name, email, password) => {
        const exists = MOCK_USERS.find((u) => u.email === email)
        if (exists) {
          return { success: false, message: 'This email is already registered.' }
        }
        const newUser: User = {
          id: String(Date.now()),
          name,
          email,
          role: 'public',
        }
        // In a real app this would be an API call; for mock we just log in directly
        MOCK_USERS.push({ ...newUser, password })
        set({ user: newUser, isAuthenticated: true })
        return { success: true }
      },
    }),
    {
      name: 'fba-auth-storage', // localStorage key
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
)
