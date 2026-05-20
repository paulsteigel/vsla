import { useAuthStore } from '@/store/authStore'

export default function DashboardPage() {
  const { infoUser } = useAuthStore()

  return (
    <div>
      <h1 className="text-2xl font-bold font-manrope text-main-title mb-2">
        Xin chào, {infoUser?.name || infoUser?.username} 👋
      </h1>
      <p className="text-gray-text font-inter mb-8">Chào mừng bạn đến với VSLA Admin v2.0</p>

      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Nhóm VSLA', value: '—', bg: 'bg-light-green', icon: '👥' },
          { label: 'Thành viên', value: '—', bg: 'bg-light-purple', icon: '🧑‍🤝‍🧑' },
          { label: 'Bài viết', value: '—', bg: 'bg-light-pink', icon: '📝' },
          { label: 'Cuộc họp', value: '—', bg: 'bg-light-orange', icon: '📅' },
        ].map((card, i) => (
          <div key={i} className={`${card.bg} rounded-2xl p-6`}>
            <div className="text-3xl mb-3">{card.icon}</div>
            <p className="text-2xl font-bold font-manrope text-main-title">{card.value}</p>
            <p className="text-[14px] text-gray-text font-inter mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-2xl p-8 text-center border border-light-gray">
        <p className="text-gray-400 font-inter text-[15px]">
          Dashboard đang được xây dựng. Vào menu <strong className="text-orange-bg">Báo cáo</strong> để test tính năng báo cáo.
        </p>
      </div>
    </div>
  )
}
