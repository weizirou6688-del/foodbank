import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from '@/widgets/layout/Layout'
import Home from '@/pages/Home/Home'
import FindFoodBank from '@/pages/FindFoodBank/FindFoodBank'
import FoodPackages from '@/pages/FoodPackages/FoodPackages'
import DonateCash from '@/pages/DonateCash/DonateCash'
import DonateGoods from '@/pages/DonateGoods/DonateGoods'
import Admin from '@/pages/Admin/Admin'
import Supermarket from '@/pages/Supermarket/Supermarket'
import ProtectedRoute from '@/features/auth/components/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'find-foodbank', element: <FindFoodBank /> },
      {
        path: 'food-packages',
        element: (
          <ProtectedRoute>
            <FoodPackages />
          </ProtectedRoute>
        ),
      },
      { path: 'donate/cash',  element: <DonateCash /> },
      { path: 'donate/goods', element: <DonateGoods /> },
      {
        path: 'admin',
        element: (
          <ProtectedRoute allowedRole="admin">
            <Admin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'supermarket',
        element: (
          <ProtectedRoute allowedRole="supermarket">
            <Supermarket />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
