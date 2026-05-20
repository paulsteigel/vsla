// [paulsteigel - 2026-05-20] Zustand store thay Redux
// Fix: tự động init infoUser từ token trong localStorage khi app load
import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'

const initFromToken = () => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) return { infoUser: null, roleUser: null }
    const decoded = jwtDecode(token)
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('accessToken')
      return { infoUser: null, roleUser: null }
    }
    return { infoUser: decoded, roleUser: null }
  } catch {
    return { infoUser: null, roleUser: null }
  }
}

export const useAuthStore = create((set) => ({
  ...initFromToken(),
  setInfoUser: (user) => set({ infoUser: user }),
  setRoleUser: (role) => set({ roleUser: role }),
  logout: () => {
    localStorage.removeItem('accessToken')
    set({ infoUser: null, roleUser: null })
    window.location.href = '/login'
  },
}))