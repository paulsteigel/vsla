import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { isTokenExpired } from '@/shared/utils/auth'
import LoginPage from '@/features/auth/LoginPage'
import Layout from '@/shared/components/Layout'
import ReportPage from '@/features/reports/ReportPage'
import DashboardPage from '@/features/dashboard/DashboardPage'

function RequireAuth({ children }) {
  const token = localStorage.getItem('accessToken')
  if (!token || isTokenExpired(token)) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportPage />} />
        {/* TODO: thêm các route khác dần */}
        <Route path="*" element={<div className="p-8 text-gray-400 text-center font-inter">Trang đang được xây dựng...</div>} />
      </Route>
    </Routes>
  )
}
