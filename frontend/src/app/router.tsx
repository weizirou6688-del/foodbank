import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/features/auth/components/ProtectedRoute'

const Layout = lazy(() => import('@/app/layout/Layout'))
const Home = lazy(() => import('@/pages/Home/Home'))
const FindFoodBank = lazy(() => import('@/pages/FindFoodBank/FindFoodBank'))
const FoodPackages = lazy(() => import('@/pages/FoodPackages/FoodPackages'))
const ApplicationForm = lazy(() => import('@/pages/ApplicationForm/ApplicationForm'))
const DonateCash = lazy(() => import('@/pages/DonateCash/DonateCash'))
const DonateGoods = lazy(() => import('@/pages/DonateGoods/DonateGoods'))
const Admin = lazy(() => import('@/pages/Admin/Admin'))
const Supermarket = lazy(() => import('@/pages/Supermarket/Supermarket'))

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-6 text-sm text-slate-600">
      Loading...
    </div>
  )
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/home" replace /> },
  {
    path: '/admin-statistics',
    element: withSuspense(
      <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
        <Navigate to="/admin?section=statistics" replace />
      </ProtectedRoute>,
    ),
  },
  { path: '/home', element: withSuspense(<Home />) },
  { path: '/donate/cash', element: withSuspense(<DonateCash />) },
  { path: '/donate/goods', element: withSuspense(<DonateGoods />) },
  {
    path: '/admin-food-management',
    element: withSuspense(
      <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
        <Navigate to="/admin?section=food" replace />
      </ProtectedRoute>,
    ),
  },
  {
    path: '/supermarket',
    element: withSuspense(
      <ProtectedRoute allowedRole="supermarket" showFooterWhenBlocked>
        <Supermarket />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: withSuspense(
      <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
        <Admin />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: withSuspense(<Layout />),
    children: [
      { path: 'find-foodbank', element: withSuspense(<FindFoodBank />) },
      {
        path: 'food-packages',
        element: withSuspense(
          <ProtectedRoute>
            <FoodPackages />
          </ProtectedRoute>
        ),
      },
      {
        path: 'application',
        element: withSuspense(
          <ProtectedRoute>
            <ApplicationForm />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
])
