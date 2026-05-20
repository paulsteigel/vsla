import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const menuItems = [
  {
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    to: '/',
    exact: true,
  },
  {
    label: 'Quản lý tổ TTV',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    children: [
      { label: 'Danh sách tổ TTV', to: '/groups' },
      { label: 'Tra cứu người dùng', to: '/search-users' },
      { label: 'Cuộc họp', to: '/meetings' },
      { label: 'Danh sách giao dịch', to: '/manage-transaction' },
    ],
  },
  {
    label: 'Quản lý bài viết',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    children: [
      { label: 'Bài viết', to: '/article' },
      { label: 'Chủ đề', to: '/topics' },
    ],
  },
  {
    label: 'Thông báo & khảo sát',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
    children: [
      { label: 'Thông báo', to: '/messages' },
      { label: 'Khảo sát', to: '/surveys' },
    ],
  },
  {
    label: 'Quản lý dự án',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
    ),
    children: [
      { label: 'Dự án', to: '/projects' },
      { label: 'Tổ chức', to: '/organize' },
    ],
  },
  {
    label: 'Quản trị & báo cáo',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    children: [
      { label: 'Quản lý user admin', to: '/admin-roles' },
      { label: 'Báo cáo tiết kiệm tương trợ vốn', to: '/reports' },
      { label: 'Truy vấn dữ liệu', to: '/query-data' },
    ],
  },
]

function MenuItem({ item }) {
  const [open, setOpen] = useState(false)

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        end={item.exact}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-[14px] font-[500] font-inter ${
            isActive
              ? 'bg-orange-bg text-white shadow-md'
              : 'text-gray-text hover:bg-orange-bg/10 hover:text-orange-bg'
          }`
        }
      >
        {item.icon}
        <span>{item.label}</span>
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[14px] font-[500] font-inter text-gray-text hover:bg-orange-bg/10 hover:text-orange-bg transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          {item.icon}
          <span>{item.label}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="ml-9 mt-1 space-y-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-[13px] font-inter transition-all duration-200 ${
                  isActive
                    ? 'text-orange-bg font-[600] bg-orange-bg/10'
                    : 'text-gray-text hover:text-orange-bg'
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { infoUser, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-screen bg-[#FAFBFC]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-[260px]' : 'w-[70px]'} bg-white border-r border-light-gray transition-all duration-300 flex flex-col shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[70px] border-b border-light-gray">
          <div className="w-10 h-10 bg-orange-bg rounded-xl flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" fill="white"/>
              <circle cx="24" cy="24" r="6" fill="#E4701E"/>
            </svg>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-[15px] font-manrope text-main-title leading-tight">Nông Dân Số</p>
              <p className="text-[11px] text-gray-400 font-inter">VSLA Admin</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item, i) => (
            <MenuItem key={i} item={item} />
          ))}
        </nav>

        {/* Bottom — logout */}
        <div className="p-3 border-t border-light-gray">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-[500] font-inter text-danger hover:bg-light-pink transition-all duration-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>

        {/* Version */}
        {sidebarOpen && (
          <p className="text-center text-[11px] text-gray-300 pb-3 font-inter">Phiên bản: 2.0.0</p>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[70px] bg-white border-b border-light-gray flex items-center justify-between px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#484746" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[14px] font-[600] font-manrope text-main-title leading-tight">
                {infoUser?.name || infoUser?.username}
              </p>
              <p className="text-[12px] text-orange-bg font-inter">{infoUser?.role}</p>
            </div>
            <div className="w-10 h-10 bg-orange-bg rounded-full flex items-center justify-center text-white font-bold text-[15px] font-manrope">
              {(infoUser?.name || infoUser?.username || 'A')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
