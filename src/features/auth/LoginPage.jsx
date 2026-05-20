/**
 * LoginPage.jsx
 *
 * CHANGE LOG:
 * -----------
 * [paulsteigel - 2026-05-20]
 *   BUG FIX — Login không được sau khi đã wrap http:
 *     http.post() trả về { status, payload } nhưng code cũ đọc res.data.token
 *     → token luôn undefined → throw error → không login được.
 *     Fix: đọc đúng res.payload.token
 */

import { useState } from 'react'
import { toast } from 'react-toastify'
import { jwtDecode } from 'jwt-decode'
import { httpAuth } from '@/shared/api/http'
import { useAuthStore } from '@/store/authStore'

const ALLOWED_ROLES = ['ADMIN', 'ORGANIZATION_ADMIN', 'PROJECT_ADMIN', 'CITY_ADMIN', 'WARD_ADMIN']

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setInfoUser, setRoleUser } = useAuthStore()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu')
      return
    }
    setLoading(true)
    setError('')
    try {
      // [paulsteigel - 2026-05-20] FIX: dùng httpAuth wrapper → res = { status, payload }
      const res = await httpAuth.post('/auth', { username, password })

      if (res.status !== 200 || !res.payload?.token) {
        setError('Tên đăng nhập hoặc mật khẩu không đúng')
        return
      }

      const token = res.payload.token
      const decoded = jwtDecode(token)

      if (!ALLOWED_ROLES.includes(decoded.role)) {
        setError('Bạn không có quyền truy cập hệ thống admin')
        return
      }

      localStorage.setItem('accessToken', token)
      setInfoUser(decoded)

      // Load role detail
      try {
        const roleRes = await httpAuth.get(`/admin-roles?customerId=${decoded.customerId}&_start=0&_end=10`)
        if (roleRes?.payload?.data?.[0]) setRoleUser(roleRes.payload.data[0])
      } catch {}

      toast.success('Đăng nhập thành công!')
      window.location.href = decoded.role === 'ADMIN' ? '/' : '/groups'

    } catch (err) {
      setError('Đã xảy ra lỗi, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#FAFBFC]">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-1/2 bg-orange-bg flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white opacity-5" />
          <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-white opacity-5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white opacity-5" />
        </div>

        <div className="relative z-10 text-center text-white max-w-sm">
          {/* Logo */}
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" fill="#E4701E"/>
              <path d="M24 14L36 20V32L24 38L12 32V20L24 14Z" fill="white" fillOpacity="0.3"/>
              <circle cx="24" cy="26" r="5" fill="white"/>
            </svg>
          </div>

          <h1 className="text-4xl font-bold font-manrope mb-3">VSLA Admin</h1>
          <p className="text-lg font-manrope opacity-90 mb-2">Nền tảng Quản lý Nông Dân Số</p>
          <p className="text-sm opacity-70 font-inter leading-relaxed">
            Hệ thống quản lý tiết kiệm tương trợ vốn cho cộng đồng nông thôn Việt Nam
          </p>

          {/* Stats decorative */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Tỉnh thành', value: '30+' },
              { label: 'Nhóm VSLA', value: '2K+' },
              { label: 'Thành viên', value: '40K+' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xl font-bold font-manrope">{s.value}</p>
                <p className="text-xs opacity-75 font-inter mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-orange-bg rounded-xl flex items-center justify-center shadow-md">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" fill="white"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-main-title font-manrope">VSLA Admin</p>
              <p className="text-xs text-gray-text font-inter">Nông Dân Số</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold font-manrope text-main-title mb-1">Đăng nhập</h2>
          <p className="text-gray-text font-inter text-[15px] mb-8">Chào mừng bạn quay trở lại</p>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-[14px] font-[500] text-main-title mb-2 font-inter">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                className="w-full h-12 px-4 rounded-xl border-2 border-light-gray bg-white font-inter text-[15px] outline-none transition-all focus:border-orange-bg focus:shadow-[0_0_0_3px_rgba(228,112,30,0.1)]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[14px] font-[500] text-main-title mb-2 font-inter">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-light-gray bg-white font-inter text-[15px] outline-none transition-all focus:border-orange-bg focus:shadow-[0_0_0_3px_rgba(228,112,30,0.1)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-bg transition-colors"
                >
                  {showPass ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-danger text-[14px] font-inter bg-light-pink rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-orange-bg hover:bg-orange-hover text-white font-[600] font-manrope rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Đang đăng nhập...
                </>
              ) : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400 font-inter">
            VSLA Admin v2.0 — CARE Việt Nam © 2026
          </p>
        </div>
      </div>
    </div>
  )
}