import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import ProtectedRoute from '@/features/auth/components/ProtectedRoute'
import RouteErrorPage from './RouteErrorPage'

const Workspace = lazy(() => import('@/pages/Admin/Admin'))
const Home = lazy(() => import('@/pages/Home/Home'))
const FindFoodBank = lazy(() => import('@/pages/FindFoodBank/FindFoodBank'))
const FoodPackages = lazy(() => import('@/pages/FoodPackages/FoodPackages'))
const DonateCash = lazy(() => import('@/pages/DonateCash/DonateCash'))
const DonateGoods = lazy(() => import('@/pages/DonateGoods/DonateGoods'))

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

function RouterRoot() {
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RouterRoot />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: 'workspace',
        element: withSuspense(
          <ProtectedRoute allowedRole={['admin', 'supermarket']} showFooterWhenBlocked>
            <Workspace />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'admin-statistics',
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=statistics" replace />
          </ProtectedRoute>,
        ),
      },
      { path: 'home', element: withSuspense(<Home />) },
      { path: 'find-foodbank', element: withSuspense(<FindFoodBank />) },
      {
        path: 'food-packages',
        element: withSuspense(
          <ProtectedRoute>
            <FoodPackages />
          </ProtectedRoute>,
        ),
      },
      { path: 'donate/cash', element: withSuspense(<DonateCash />) },
      { path: 'donate/goods', element: withSuspense(<DonateGoods />) },
      {
        path: 'admin-food-management',
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=food" replace />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'supermarket',
        element: withSuspense(
          <ProtectedRoute allowedRole="supermarket" showFooterWhenBlocked>
            <Navigate to="/workspace?section=restock" replace />
          </ProtectedRoute>,
        ),
      },
      {
        path: 'admin',
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=food" replace />
          </ProtectedRoute>,
        ),
      },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
])
