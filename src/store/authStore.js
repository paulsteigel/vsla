import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  infoUser: null,
  roleUser: null,
  setInfoUser: (user) => set({ infoUser: user }),
  setRoleUser: (role) => set({ roleUser: role }),
  logout: () => {
    localStorage.removeItem('accessToken')
    set({ infoUser: null, roleUser: null })
    window.location.href = '/login'
  },
}))
