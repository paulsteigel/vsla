/**
 * DashboardPage.jsx
 * [paulsteigel - 2026-05-20] REWRITE v2 — Thêm biểu đồ Recharts, layout 3 zone
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { httpAuth } from '@/shared/api/http'
import dayjs from 'dayjs'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'

const fmtVN = (n) => Number(n || 0).toLocaleString('vi-VN')
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối' }
const ROLE_LABEL = { ADMIN: 'Quản trị viên hệ thống', ORGANIZATION_ADMIN: 'Quản lý tổ chức', PROJECT_ADMIN: 'Quản lý dự án', CITY_ADMIN: 'Cán bộ tỉnh', WARD_ADMIN: 'Cán bộ xã' }
const MEETING_STATUS = { Done: { label: 'Đã xong', cls: 'text-blue-600 bg-blue-50 border-blue-100' }, Active: { label: 'Đang họp', cls: 'text-green-600 bg-green-50 border-green-100' } }
const MEETING_TYPE = { first_meeting: 'Đầu kỳ', last_meeting: 'Cuối kỳ', regular_meeting: 'Thường kỳ' }
const PROJECT_STATUS = { Active: { label: 'Hoạt động', cls: 'text-green-600' }, Pending: { label: 'Chờ duyệt', cls: 'text-orange-bg' }, Done: { label: 'Kết thúc', cls: 'text-gray-400' } }
const COLORS = ['#E4701E', '#F28649', '#FFA47A', '#16A34A']

const Sk = ({ h = 'h-4', w = 'w-full', cls = '' }) => <div className={`animate-pulse bg-gray-100 rounded-lg ${h} ${w} ${cls}`} />

function ProgressRing({ value, max, color = '#E4701E', size = 80 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F5F5F5" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.8s ease' }}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#24272C">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

function KPICard({ icon, bg, label, total, weekCount, weekLabel, to, loading }) {
  return (
    <div className={`${bg} rounded-2xl p-5`}>
      {loading ? <div className="space-y-3"><Sk h="h-8" w="w-8"/><Sk h="h-7" w="w-24"/><Sk h="h-4" w="w-32"/></div> : (
        <>
          <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center text-xl">{icon}</div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-manrope text-main-title">{fmtVN(total)}</p>
            <p className="text-[14px] text-gray-text font-inter mt-0.5">{label}</p>
          </div>
          {to
            ? <Link to={to} className="block mt-3 text-[13px] text-link font-inter hover:underline">+{fmtVN(weekCount)} {weekLabel} trong tuần →</Link>
            : <p className="mt-3 text-[13px] text-link font-inter">+{fmtVN(weekCount)} {weekLabel} trong tuần</p>
          }
        </>
      )}
    </div>
  )
}

function Section({ title, subtitle, to, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-[15px] font-manrope text-main-title">{title}</h3>
          {subtitle && <p className="text-[12px] text-gray-400 font-inter mt-0.5">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="text-[13px] text-link font-inter hover:underline flex items-center gap-1">
            Xem thêm <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-light-gray rounded-xl p-3 shadow-lg text-[13px] font-inter">
      <p className="font-[600] text-main-title mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <strong>{fmtVN(p.value)}</strong></p>)}
    </div>
  )
}

export default function DashboardPage() {
  const { infoUser } = useAuthStore()
  const [stats, setStats]         = useState({ groups: {}, users: {}, posts: {}, meetings: {} })
  const [trendData, setTrendData] = useState([])
  const [loanData, setLoanData]   = useState([])
  const [ringData, setRingData]   = useState({ active: 0, total: 0, meetingPct: 0 })
  const [meetings, setMeetings]   = useState([])
  const [projects, setProjects]   = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const now = dayjs()
      const weekAgo = now.subtract(7, 'day').format('YYYY-MM-DD')
      const today = now.format('YYYY-MM-DD')
      const months = Array.from({ length: 6 }, (_, i) => {
        const m = now.subtract(5 - i, 'month')
        return { label: m.format('MM/YYYY'), from: m.startOf('month').format('YYYY-MM-DD'), to: m.endOf('month').format('YYYY-MM-DD') }
      })
      try {
        const [gR, uR, pR, mR, gW, uW, pW, mW, latM, latP, sugR] = await Promise.allSettled([
          httpAuth.get('/groups'), httpAuth.get('/customers'), httpAuth.get('/posts'), httpAuth.get('/meetings'),
          httpAuth.get(`/groups?fromDate=${weekAgo}&toDate=${today}`),
          httpAuth.get(`/customers?fromDate=${weekAgo}&toDate=${today}`),
          httpAuth.get(`/posts?fromDate=${weekAgo}&toDate=${today}`),
          httpAuth.get(`/meetings?fromDate=${weekAgo}&toDate=${today}`),
          httpAuth.get('/meetings?_start=0&_end=6'),
          httpAuth.get('/projects?_start=0&_end=5'),
          httpAuth.get('/notifications?type=CUSTOMER_SUPPORT&_start=0&_end=8'),
        ])
        const v = (r) => r.status === 'fulfilled' ? r.value?.payload : null
        setStats({
          groups:   { total: v(gR)?.total || 0, week: v(gW)?.total || 0 },
          users:    { total: v(uR)?.total || 0, week: v(uW)?.total || 0 },
          posts:    { total: v(pR)?.total || 0, week: v(pW)?.total || 0 },
          meetings: { total: v(mR)?.total || 0, week: v(mW)?.total || 0 },
        })
        // Trend 6 tháng
        const trendRes = await Promise.allSettled(months.map(m => Promise.all([
          httpAuth.get(`/groups?fromDate=${m.from}&toDate=${m.to}`),
          httpAuth.get(`/customers?fromDate=${m.from}&toDate=${m.to}`),
          httpAuth.get(`/meetings?fromDate=${m.from}&toDate=${m.to}`),
        ])))
        setTrendData(months.map((m, i) => {
          if (trendRes[i].status !== 'fulfilled') return { month: m.label, 'Nhóm mới': 0, 'Thành viên': 0, 'Cuộc họp': 0 }
          const [g, u, mt] = trendRes[i].value
          return { month: m.label, 'Nhóm mới': g?.payload?.total || 0, 'Thành viên': u?.payload?.total || 0, 'Cuộc họp': mt?.payload?.total || 0 }
        }))
        // Report data
        const rptRes = await httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${now.startOf('year').format('YYYY-MM-DD')}&toDate=${today}&_start=0&_end=100`)
        const rpt = rptRes?.payload?.data || []
        const gv = (id) => rpt.find(r => r.id === id)?.accumulatedValue || 0
        setLoanData([
          { name: 'Khẩn cấp', value: gv('13.1') },
          { name: 'Kinh doanh', value: gv('13.2') },
          { name: 'Tiêu dùng', value: gv('13.3') },
          { name: 'Khác', value: gv('13.4') },
        ])
        setRingData({ active: gv('6'), total: gv('4'), meetingPct: gv('8') })
        setMeetings((v(latM)?.data || []).map(m => ({
          ...m,
          _status: MEETING_STATUS[m.status] || { label: m.status, cls: 'text-gray-400 bg-gray-50 border-gray-100' },
          _type: MEETING_TYPE[m.meetingType] || m.meetingType,
        })))
        setProjects(v(latP)?.data || [])
        setSuggestions(v(sugR)?.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const loanTotal = useMemo(() => loanData.reduce((s, d) => s + d.value, 0), [loanData])

  return (
    <div className="space-y-6">

      {/* Greeting banner */}
      <div className="bg-gradient-to-r from-orange-bg to-orange-hover rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-white/70 font-inter text-[14px]">{ROLE_LABEL[infoUser?.role] || infoUser?.role}</p>
          <h1 className="text-2xl font-bold font-manrope mt-1">{greeting()}, {infoUser?.name?.split(' ').pop() || infoUser?.username} 👋</h1>
          <p className="text-white/70 font-inter text-[13px] mt-1">{dayjs().format('DD/MM/YYYY')}</p>
        </div>
        <div className="hidden md:flex items-center gap-4">
          {[
            { label: 'Nhóm HĐ', val: fmtVN(stats.groups.total) },
            { label: 'Thành viên', val: fmtVN(stats.users.total) },
            { label: 'Cuộc họp', val: fmtVN(stats.meetings.total) },
          ].map((s, i) => (
            <div key={i} className="bg-white/15 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-xl font-bold font-manrope">{loading ? '—' : s.val}</p>
              <p className="text-[12px] text-white/75 font-inter mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard bg="bg-light-green"  icon="👥" label="Nhóm VSLA"  total={stats.groups.total}   weekCount={stats.groups.week}   weekLabel="nhóm mới"  to="/groups"   loading={loading}/>
        <KPICard bg="bg-light-purple" icon="🧑" label="Người dùng" total={stats.users.total}    weekCount={stats.users.week}    weekLabel="người mới"                 loading={loading}/>
        <KPICard bg="bg-light-pink"   icon="📝" label="Bài viết"   total={stats.posts.total}    weekCount={stats.posts.week}    weekLabel="bài mới"   to="/article"  loading={loading}/>
        <KPICard bg="bg-light-orange" icon="📅" label="Cuộc họp"   total={stats.meetings.total} weekCount={stats.meetings.week} weekLabel="cuộc mới"  to="/meetings" loading={loading}/>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Section title="Hoạt động 6 tháng gần nhất" subtitle="Nhóm mới, thành viên và cuộc họp theo tháng">
            {loading ? <Sk h="h-56"/> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'Inter', fill: '#484746' }}/>
                  <YAxis tick={{ fontSize: 12, fontFamily: 'Inter', fill: '#484746' }}/>
                  <Tooltip content={<CustomTooltip />}/>
                  <Legend wrapperStyle={{ fontSize: 13, fontFamily: 'Inter' }}/>
                  <Line type="monotone" dataKey="Nhóm mới"   stroke="#E4701E" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                  <Line type="monotone" dataKey="Thành viên" stroke="#16A34A" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                  <Line type="monotone" dataKey="Cuộc họp"   stroke="#4079ED" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                </LineChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>
        <Section title="Chỉ số hoạt động" subtitle="Tính đến hiện tại">
          {loading ? <div className="space-y-4"><Sk h="h-24"/><Sk h="h-24"/></div> : (
            <div className="flex flex-col gap-5 py-1">
              <div className="flex items-center gap-4">
                <ProgressRing value={ringData.active} max={ringData.total} color="#16A34A" size={76}/>
                <div>
                  <p className="font-[600] text-[14px] font-manrope text-main-title">Thành viên HĐ</p>
                  <p className="text-[13px] text-gray-text font-inter mt-1">{fmtVN(ringData.active)} / {fmtVN(ringData.total)}</p>
                </div>
              </div>
              <div className="h-px bg-light-gray"/>
              <div className="flex items-center gap-4">
                <ProgressRing value={ringData.meetingPct} max={100} color="#E4701E" size={76}/>
                <div>
                  <p className="font-[600] text-[14px] font-manrope text-main-title">Tỉ lệ họp nhóm</p>
                  <p className="text-[13px] text-gray-text font-inter mt-1">Thành viên tham dự</p>
                </div>
              </div>
              <div className="h-px bg-light-gray"/>
              <div className="bg-light-orange rounded-xl p-3 text-center">
                <p className="text-[12px] text-gray-text font-inter">Nhóm mới tuần này</p>
                <p className="text-xl font-bold font-manrope text-orange-bg mt-0.5">+{fmtVN(stats.groups.week)}</p>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Loan chart + Meetings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section title="Cho vay theo mục đích" subtitle={`Lũy kế năm — ${fmtVN(loanTotal)} khoản`}>
          {loading ? <Sk h="h-48"/> : loanTotal === 0 ? (
            <p className="text-center text-gray-400 font-inter text-[14px] py-8">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={loanData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#484746' }}/>
                <YAxis tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#484746' }}/>
                <Tooltip content={<CustomTooltip />}/>
                <Bar dataKey="value" name="Số khoản" radius={[6, 6, 0, 0]}>
                  {loanData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
        <div className="xl:col-span-2">
          <Section title="Cuộc họp gần nhất" to="/meetings">
            {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} h="h-14"/>)}</div>
            : !meetings.length ? <p className="text-center text-gray-400 font-inter text-[14px] py-8">Không có dữ liệu</p>
            : (
              <div className="space-y-2">
                {meetings.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="shrink-0 w-1 h-10 rounded-full bg-orange-bg"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/groups/detailgroup/${m.groupId}`} className="font-[500] text-[14px] text-main-title font-inter truncate hover:text-orange-bg">{m.groupName}</Link>
                        <span className="text-[12px] text-gray-400 font-inter shrink-0">{m._type}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] text-gray-400 font-inter truncate">{m.location}</span>
                        {m.date && <><span className="text-gray-300">·</span><span className="text-[12px] text-gray-400 font-inter shrink-0">{dayjs(m.date).format('HH:mm DD/MM/YY')}</span></>}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[12px] font-[500] px-2 py-1 rounded-lg border font-inter ${m._status.cls}`}>{m._status.label}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Projects + Suggestions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="Dự án" to="/projects">
          {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Sk key={i} h="h-14"/>)}</div>
          : !projects.length ? <p className="text-center text-gray-400 font-inter text-[14px] py-6">Không có dữ liệu</p>
          : (
            <div className="space-y-2">
              {projects.map((p, i) => {
                const st = PROJECT_STATUS[p.status] || { label: p.status, cls: 'text-gray-400' }
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-orange-bg/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover"/>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E4701E" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to="/projects/detail" state={{ fromHome: { props: p } }} className="font-[500] text-[14px] text-main-title font-inter hover:text-orange-bg block truncate">{p.name}</Link>
                      {p.shortName && <p className="text-[12px] text-gray-400 font-inter">{p.shortName}</p>}
                    </div>
                    <span className={`text-[13px] font-[500] font-inter shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
        <Section title="Góp ý từ người dùng" to="/messages?type=CUSTOMER_SUPPORT">
          {loading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Sk key={i} h="h-16"/>)}</div>
          : !suggestions.length ? <p className="text-center text-gray-400 font-inter text-[14px] py-6">Chưa có góp ý nào</p>
          : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {suggestions.map((msg, i) => (
                <Link key={i} to={`/messages/view/${msg.id}`} className="block p-3 rounded-xl hover:bg-orange-bg/5 transition-colors border border-transparent hover:border-orange-bg/20">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-[500] text-[14px] text-main-title font-manrope line-clamp-1">{msg.title}</p>
                    <span className="text-[11px] text-gray-400 font-inter shrink-0">{msg.sendDate ? dayjs(msg.sendDate).format('HH:mm DD/MM') : ''}</span>
                  </div>
                  <p className="text-[13px] text-gray-text font-inter mt-1 line-clamp-2">{msg.content}</p>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

    </div>
  )
}