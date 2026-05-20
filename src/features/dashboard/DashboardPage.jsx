/**
 * DashboardPage.jsx
 *
 * CHANGE LOG:
 * -----------
 * [paulsteigel - 2026-05-20]
 *   REWRITE — Viết lại hoàn toàn từ RightBlock.js cũ:
 *   - Gộp 5 widget riêng lẻ vào 1 file duy nhất, dễ maintain
 *   - Dùng httpAuth thay fetch thủ công
 *   - Layout 2 cột nhất quán, responsive
 *   - Thêm loading skeleton thay vì render rỗng
 *   - Format ngày giờ chuẩn Việt Nam
 *   - Status badge đồng nhất màu sắc với toàn hệ thống
 *   - Thêm greeting theo giờ trong ngày
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { httpAuth } from '@/shared/api/http'
import dayjs from 'dayjs'

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatVN = (n) => Number(n || 0).toLocaleString('vi-VN')

const formatDateTime = (str) => {
  if (!str) return ''
  const d = new Date(str)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} — ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const formatDate = (str) => {
  if (!str) return ''
  const d = new Date(str)
  return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Chào buổi sáng'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const today = dayjs().format('dddd, DD/MM/YYYY')
  .replace('Monday', 'Thứ Hai').replace('Tuesday', 'Thứ Ba')
  .replace('Wednesday', 'Thứ Tư').replace('Thursday', 'Thứ Năm')
  .replace('Friday', 'Thứ Sáu').replace('Saturday', 'Thứ Bảy')
  .replace('Sunday', 'Chủ Nhật')

const MEETING_STATUS = {
  Done:   { label: 'Đã xong',  color: 'text-blue-500 bg-blue-50' },
  Active: { label: 'Đang họp', color: 'text-green-600 bg-green-50' },
}
const MEETING_TYPE = {
  first_meeting:   'Họp đầu kỳ',
  last_meeting:    'Họp cuối kỳ',
  regular_meeting: 'Họp thường kỳ',
}
const PROJECT_STATUS = {
  Active:  { label: 'Đang hoạt động', color: 'text-green-600' },
  Pending: { label: 'Chờ duyệt',      color: 'text-orange-bg' },
  Done:    { label: 'Đã kết thúc',    color: 'text-gray-400' },
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
)

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ bg, icon, total, label, weekCount, weekLabel, to, loading }) {
  return (
    <div className={`${bg} rounded-2xl p-5 flex flex-col gap-3`}>
      {loading ? (
        <>
          <Skeleton className="w-10 h-10" />
          <Skeleton className="w-20 h-7" />
          <Skeleton className="w-32 h-4" />
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center text-xl">
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold font-manrope text-main-title">{formatVN(total)}</p>
            <p className="text-[14px] text-gray-text font-inter mt-0.5">{label}</p>
          </div>
          {to ? (
            <Link to={to} className="text-[13px] text-link font-inter hover:underline">
              +{formatVN(weekCount)} {weekLabel} trong tuần →
            </Link>
          ) : (
            <p className="text-[13px] text-link font-inter">
              +{formatVN(weekCount)} {weekLabel} trong tuần
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title, to, linkLabel = 'Xem thêm' }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-[16px] font-manrope text-main-title">{title}</h3>
      {to && (
        <Link to={to} className="text-[13px] text-link font-inter hover:underline flex items-center gap-1">
          {linkLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      )}
    </div>
  )
}

// ─── Latest Meetings ─────────────────────────────────────────────────────────

function LatestMeetings({ data, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray">
      <SectionHeader title="Cuộc họp gần nhất" to="/meetings" />
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !data?.length ? (
        <p className="text-center text-gray-400 font-inter text-[14px] py-6">Không có dữ liệu</p>
      ) : (
        <div className="space-y-2">
          {data.map((m, i) => {
            const status = MEETING_STATUS[m.status] || { label: m.status, color: 'text-gray-400 bg-gray-50' }
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9F7F4] hover:bg-orange-bg/5 transition-colors">
                <div className="shrink-0 w-1 h-10 rounded-full bg-orange-bg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/groups/detailgroup/${m.groupId}`}
                      className="font-[500] text-[14px] text-main-title font-inter truncate hover:text-orange-bg"
                    >
                      {m.groupName}
                    </Link>
                    <span className="shrink-0 text-[11px] text-gray-400 font-inter">
                      {MEETING_TYPE[m.meetingType] || m.meetingType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] text-gray-400 font-inter">{m.location}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-[12px] text-gray-400 font-inter">{formatDateTime(m.date)}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-[12px] font-[500] px-2 py-1 rounded-lg font-inter ${status.color}`}>
                  {status.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── VSLA Groups ─────────────────────────────────────────────────────────────

function VSLAGroups({ data, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray">
      <SectionHeader title="Nhóm VSLA mới nhất" to="/groups" />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.length ? (
        <p className="text-center text-gray-400 font-inter text-[14px] py-6">Không có dữ liệu</p>
      ) : (
        <div className="divide-y divide-light-gray">
          {/* Header */}
          <div className="grid grid-cols-4 pb-2 text-[12px] font-[600] text-gray-400 font-inter uppercase tracking-wide">
            <span>Tên tổ TTV</span>
            <span>Dự án</span>
            <span className="text-center">Thành viên</span>
            <span className="text-right">Ngày lập</span>
          </div>
          {data.map((g, i) => (
            <div key={i} className="grid grid-cols-4 py-3 text-[14px] font-inter items-center">
              <Link
                to={`/groups/detailgroup/${g.id}`}
                className="text-main-title font-[500] hover:text-orange-bg truncate pr-2"
              >
                {g.name}
              </Link>
              <span className="text-gray-text truncate pr-2">{g.projectName}</span>
              <span className="text-center font-[600] text-main-title">{formatVN(g.totalMember)}</span>
              <span className="text-right text-gray-400 text-[12px]">
                {dayjs(g.createdDate).format('DD/MM/YYYY')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Projects ────────────────────────────────────────────────────────────────

function ProjectList({ data, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray">
      <SectionHeader title="Danh sách dự án" to="/projects" />
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !data?.length ? (
        <p className="text-center text-gray-400 font-inter text-[14px] py-6">Không có dữ liệu</p>
      ) : (
        <div className="space-y-2">
          {data.map((p, i) => {
            const status = PROJECT_STATUS[p.status] || { label: p.status, color: 'text-gray-400' }
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-orange-bg/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {p.logo ? (
                    <img src={p.logo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E4701E" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                      <polyline points="2 17 12 22 22 17"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/projects/detail"
                    state={{ fromHome: { props: p } }}
                    className="font-[500] text-[14px] text-main-title font-inter hover:text-orange-bg truncate block"
                  >
                    {p.name}
                  </Link>
                </div>
                <span className={`text-[13px] font-[500] font-inter shrink-0 ${status.color}`}>
                  {status.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

function Suggestions({ data, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray h-full">
      <SectionHeader title="Góp ý từ người dùng" to="/messages?type=CUSTOMER_SUPPORT" />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data?.length ? (
        <p className="text-center text-gray-400 font-inter text-[14px] py-6">Không có góp ý nào</p>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[400px] pr-1">
          {data.map((msg, i) => (
            <Link
              key={i}
              to={`/messages/view/${msg.id}`}
              className="block p-3 rounded-xl hover:bg-orange-bg/5 transition-colors border border-transparent hover:border-orange-bg/20"
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-[500] text-[14px] text-main-title font-manrope line-clamp-1">{msg.title}</p>
                <span className="text-[11px] text-gray-400 font-inter shrink-0">
                  {formatDateTime(msg.sendDate)}
                </span>
              </div>
              <p className="text-[13px] text-gray-text font-inter mt-1 line-clamp-2">{msg.content}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { infoUser } = useAuthStore()

  const [stats, setStats] = useState({
    groups: { total: 0, week: 0 },
    users: { total: 0, week: 0 },
    posts: { total: 0, week: 0 },
    meetings: { total: 0, week: 0 },
  })
  const [meetings, setMeetings] = useState([])
  const [groups, setGroups] = useState([])
  const [projects, setProjects] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fromDate = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
    const toDate = dayjs().format('YYYY-MM-DD')

    const load = async () => {
      setLoading(true)
      try {
        const [
          groupsRes, usersRes, postsRes, meetingsRes,
          groupsWeekRes, usersWeekRes, postsWeekRes, meetingsWeekRes,
          latestMeetings, latestGroups, latestProjects, suggestions,
        ] = await Promise.allSettled([
          httpAuth.get('/groups'),
          httpAuth.get('/customers'),
          httpAuth.get('/posts'),
          httpAuth.get('/meetings'),
          httpAuth.get(`/groups?fromDate=${fromDate}&toDate=${toDate}`),
          httpAuth.get(`/customers?fromDate=${fromDate}&toDate=${toDate}`),
          httpAuth.get(`/posts?fromDate=${fromDate}&toDate=${toDate}`),
          httpAuth.get(`/meetings?fromDate=${fromDate}&toDate=${toDate}`),
          httpAuth.get('/meetings?_start=0&_end=5'),
          httpAuth.get('/groups?_start=0&_end=5'),
          httpAuth.get('/projects?_start=0&_end=5'),
          httpAuth.get('/notifications?type=CUSTOMER_SUPPORT'),
        ])

        const v = (r) => r.status === 'fulfilled' ? r.value?.payload : null

        setStats({
          groups:   { total: v(groupsRes)?.total || 0,   week: v(groupsWeekRes)?.total || 0 },
          users:    { total: v(usersRes)?.total || 0,    week: v(usersWeekRes)?.total || 0 },
          posts:    { total: v(postsRes)?.total || 0,    week: v(postsWeekRes)?.total || 0 },
          meetings: { total: v(meetingsRes)?.total || 0, week: v(meetingsWeekRes)?.total || 0 },
        })
        setMeetings(v(latestMeetings)?.data || [])
        setGroups(v(latestGroups)?.data || [])
        setProjects(v(latestProjects)?.data || [])
        setSuggestions(v(suggestions)?.data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="space-y-6">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-manrope text-main-title">
            {greeting()}, {infoUser?.name?.split(' ').pop() || infoUser?.username} 👋
          </h1>
          <p className="text-gray-text font-inter text-[14px] mt-1 capitalize">{today}</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[13px] text-gray-400 font-inter">Dữ liệu cập nhật lúc</p>
          <p className="text-[14px] font-[500] text-main-title font-inter">
            {dayjs().format('HH:mm, DD/MM/YYYY')}
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          bg="bg-light-green" icon="👥"
          total={stats.groups.total} label="Nhóm VSLA"
          weekCount={stats.groups.week} weekLabel="nhóm mới"
          to="/groups" loading={loading}
        />
        <StatCard
          bg="bg-light-purple" icon="🧑‍🤝‍🧑"
          total={stats.users.total} label="Người dùng"
          weekCount={stats.users.week} weekLabel="người mới"
          loading={loading}
        />
        <StatCard
          bg="bg-light-pink" icon="📝"
          total={stats.posts.total} label="Bài viết"
          weekCount={stats.posts.week} weekLabel="bài mới"
          to="/article" loading={loading}
        />
        <StatCard
          bg="bg-light-orange" icon="📅"
          total={stats.meetings.total} label="Cuộc họp"
          weekCount={stats.meetings.week} weekLabel="cuộc họp mới"
          to="/meetings" loading={loading}
        />
      </div>

      {/* ── Main Content ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left — 2/3 width */}
        <div className="xl:col-span-2 space-y-6">
          <LatestMeetings data={meetings} loading={loading} />
          <VSLAGroups data={groups} loading={loading} />
        </div>

        {/* Right — 1/3 width */}
        <div className="space-y-6">
          <ProjectList data={projects} loading={loading} />
          <Suggestions data={suggestions} loading={loading} />
        </div>

      </div>
    </div>
  )
}