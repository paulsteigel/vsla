// [paulsteigel - 2026-05-20]
import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { httpAuth } from '@/shared/api/http'
import LoginPage from '@/features/auth/LoginPage'
import Layout from '@/shared/components/Layout'
import ReportPage from '@/features/reports/ReportPage'
import DashboardPage from '@/features/dashboard/DashboardPage'

function RequireAuth({ children }) {
  const token = localStorage.getItem('accessToken')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { infoUser, setRoleUser } = useAuthStore()

  // Load roleUser từ API sau khi có infoUser
  useEffect(() => {
    if (!infoUser?.customerId) return
    httpAuth.get(`/admin-roles?customerId=${infoUser.customerId}&_start=0&_end=10`)
      .then((res) => {
        if (res?.payload?.data?.[0]) setRoleUser(res.payload.data[0])
      })
      .catch(() => {})
  }, [infoUser?.customerId])

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
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-64 text-gray-400 font-inter text-[15px]">
              Trang đang được xây dựng...
            </div>
          }
        />
      </Route>
    </Routes>
  )
}