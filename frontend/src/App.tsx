import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useAuthStore } from '@/app/store/authStore'
import { router } from './app/router'

function AuthSessionBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const refreshSession = useAuthStore((state) => state.refreshSession)

  useEffect(() => {
    if (!accessToken) {
      return
    }

    void refreshSession()
  }, [accessToken, refreshSession])

  return null
}

// ts-prune-ignore-next
export function App() {
  return (
    <>
      <AuthSessionBootstrap />
      <RouterProvider router={router} />
    </>
  )
}
