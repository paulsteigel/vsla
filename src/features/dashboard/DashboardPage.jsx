// [paulsteigel - 2026-05-22] MANAGEMENT VIEW v3 — Financial health focus, period filter, meeting compliance
// Redesigned for PROJECT_ADMIN / CITY_ADMIN / WARD_ADMIN perspective
// Key changes: +Savings/Loans/Repayment KPIs, +Period selector, +Meeting type breakdown, -Posts KPI

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { DatePicker } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { httpAuth } from '@/shared/api/http'
import dayjs from 'dayjs'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'

const { RangePicker } = DatePicker

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtVN    = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtM     = (n) => {                  // compact millions/billions
  const v = Number(n || 0)
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)} tr`
  return fmtVN(v)
}
const fmtPct   = (v, max = 100) => max > 0 ? Math.min(Math.round((v / max) * 100), 100) : 0

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_LABEL = {
  ADMIN: 'Quản trị viên hệ thống',
  ORGANIZATION_ADMIN: 'Quản lý tổ chức',
  PROJECT_ADMIN: 'Quản lý dự án',
  CITY_ADMIN: 'Cán bộ tỉnh',
  WARD_ADMIN: 'Cán bộ xã',
}

const MEETING_TYPE_LABEL = {
  first_meeting:   'Họp đầu kỳ',
  last_meeting:    'Họp cuối kỳ',
  regular_meeting: 'Họp thường kỳ',
}

const MEETING_STATUS_CLS = {
  Done:   'text-blue-600 bg-blue-50 border-blue-100',
  Active: 'text-green-600 bg-green-50 border-green-100',
}

const LOAN_COLORS = ['#E4701E', '#16A34A', '#4079ED', '#9333EA']

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ h = 'h-4', w = 'w-full', cls = '' }) => (
  <div className={`animate-pulse bg-gray-100 rounded-lg ${h} ${w} ${cls}`} />
)

// ─── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ value = 0, max = 100, color = '#E4701E', size = 72, label, sub }) {
  const pct = fmtPct(value, max)
  const r   = (size - 10) / 2
  const c   = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F0" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transformOrigin:'center', transform:'rotate(-90deg)', transition:'stroke-dashoffset 0.8s ease' }}/>
        <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#24272C">
          {pct}%
        </text>
      </svg>
      <div>
        <p className="font-[600] text-[13px] font-manrope text-main-title leading-tight">{label}</p>
        {sub && <p className="text-[12px] text-gray-400 font-inter mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ icon, bg, label, value, sub, trend, trendUp, to, loading }) {
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      {loading ? (
        <div className="space-y-2"><Sk h="h-7" w="w-8"/><Sk h="h-6" w="w-28"/><Sk h="h-4" w="w-36"/></div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">{icon}</span>
            {trend !== undefined && (
              <span className={`text-[11px] font-[600] px-2 py-0.5 rounded-full font-inter
                ${trendUp ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                {trendUp ? '▲' : '▼'} {trend}
              </span>
            )}
          </div>
          <p className="text-xl font-bold font-manrope text-main-title leading-tight">{value}</p>
          <p className="text-[13px] text-gray-text font-inter mt-0.5">{label}</p>
          {sub && (
            to
              ? <Link to={to} className="block mt-1 text-[12px] text-link font-inter hover:underline">{sub} →</Link>
              : <p className="mt-1 text-[12px] text-gray-400 font-inter">{sub}</p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, to, action, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-light-gray">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-[15px] font-manrope text-main-title">{title}</h3>
          {subtitle && <p className="text-[12px] text-gray-400 font-inter mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {to && (
            <Link to={to} className="text-[12px] text-link font-inter hover:underline flex items-center gap-1">
              Xem thêm <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-light-gray rounded-xl p-3 shadow-lg text-[12px] font-inter">
      <p className="font-[600] text-main-title mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{fmtM(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Meeting type badge ───────────────────────────────────────────────────────
function MeetingBadge({ type, count, loading }) {
  const labels = {
    first_meeting:   { label: 'Đầu kỳ',    cls: 'bg-purple-50 text-purple-700 border-purple-100' },
    last_meeting:    { label: 'Cuối kỳ',   cls: 'bg-blue-50 text-blue-700 border-blue-100' },
    regular_meeting: { label: 'Thường kỳ', cls: 'bg-green-50 text-green-700 border-green-100' },
  }
  const info = labels[type] || { label: type, cls: 'bg-gray-50 text-gray-600 border-gray-100' }
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${info.cls}`}>
      {loading ? <Sk h="h-7" w="w-12" cls="mx-auto mb-1"/> : (
        <p className="text-lg font-bold font-manrope">{fmtVN(count)}</p>
      )}
      <p className="text-[11px] font-inter font-[500] mt-0.5">{info.label}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { infoUser, roleUser } = useAuthStore()

  // Period state: default = current month
  const [period, setPeriod] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])

  // Data states
  const [kpi, setKpi]           = useState({ groups: 0, activeGroups: 0, newGroups: 0, members: 0, activeMembers: 0, meetings: 0, meetingsByType: {} })
  const [finance, setFinance]   = useState({ savings: 0, outstanding: 0, principal: 0, repaid: 0, interest: 0, socialFund: 0 })
  const [loanPurpose, setLoan]  = useState([])
  const [trendData, setTrend]   = useState([])
  const [recentMtg, setRecent]  = useState([])
  const [suggestions, setSugg]  = useState([])
  const [loading, setLoading]   = useState(true)

  const fromDate = period[0].format('YYYY-MM-DD')
  const toDate   = period[1].format('YYYY-MM-DD')

  // Build scope params from roleUser (role-scoped queries)
  const scopeParam = useMemo(() => {
    const p = {}
    if (roleUser?.projectId)      p.projectId      = roleUser.projectId
    if (roleUser?.organizationId) p.organizationId = roleUser.organizationId
    if (roleUser?.cityCode)       p.cityCode       = roleUser.cityCode
    if (roleUser?.wardCode)       p.wardCode       = roleUser.wardCode
    return p
  }, [roleUser])

  const buildQ = useCallback((extra = {}) => {
    const params = { ...scopeParam, ...extra }
    return Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  }, [scopeParam])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const now   = dayjs()
      const months = Array.from({ length: 6 }, (_, i) => {
        const m = now.subtract(5 - i, 'month')
        return {
          label: m.format('MM/YY'),
          from:  m.startOf('month').format('YYYY-MM-DD'),
          to:    m.endOf('month').format('YYYY-MM-DD'),
        }
      })

      try {
        // ── Parallel: core counts + report for period ──────────────────────
        const [grpR, grpA, memR, mtgR, mtgFirst, mtgLast, mtgReg, rptR, latMR, sugR] =
          await Promise.allSettled([
            httpAuth.get(`/groups?${buildQ()}`),                                      // all groups
            httpAuth.get(`/groups?${buildQ({ status: 'Active' })}`),                  // active
            httpAuth.get(`/customers?${buildQ()}`),                                   // all members
            httpAuth.get(`/meetings?${buildQ({ fromDate, toDate })}`),                // meetings in period
            httpAuth.get(`/meetings?${buildQ({ fromDate, toDate, meetingType: 'first_meeting' })}`),
            httpAuth.get(`/meetings?${buildQ({ fromDate, toDate, meetingType: 'last_meeting' })}`),
            httpAuth.get(`/meetings?${buildQ({ fromDate, toDate, meetingType: 'regular_meeting' })}`),
            httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${fromDate}&toDate=${toDate}&${buildQ()}&_start=0&_end=100`),
            httpAuth.get(`/meetings?${buildQ({ _start: 0, _end: 6 })}`),              // recent meetings
            httpAuth.get(`/notifications?type=CUSTOMER_SUPPORT&_start=0&_end=6`),     // suggestions
          ])

        const vp = (r) => r.status === 'fulfilled' ? r.value?.payload : null
        const vt = (r) => vp(r)?.total || 0
        const vd = (r) => vp(r)?.data || []

        // ── KPI assembly ──────────────────────────────────────────────────
        const rptData  = vd(rptR)
        const gv       = (id) => rptData.find(r => String(r.id) === String(id))?.accumulatedValue || 0
        const gvPeriod = (id) => rptData.find(r => String(r.id) === String(id))?.value || 0

        // New groups in period (use period-scoped query)
        const newGrpR = await httpAuth.get(`/groups?${buildQ({ fromDate, toDate })}`)
        const newGroups = newGrpR?.payload?.total || 0

        setKpi({
          groups:        vt(grpR),
          activeGroups:  vt(grpA),
          newGroups,
          members:       gv('4') || vt(memR),
          activeMembers: gv('6'),
          meetings:      vt(mtgR),
          meetingsByType: {
            first_meeting:   vt(mtgFirst),
            last_meeting:    vt(mtgLast),
            regular_meeting: vt(mtgReg),
          },
        })

        // ── Financial KPIs ────────────────────────────────────────────────
        // Try known report keys; graceful zero on unknown
        setFinance({
          savings:    gv('5')  || gv('3')  || 0,   // accumulated savings/deposits
          outstanding: gv('9') || gv('11') || 0,   // remaining principal
          principal:  gv('7')  || gv('10') || 0,   // total disbursed
          repaid:     gv('8.1')|| gv('12') || 0,   // total repaid principal
          interest:   gv('11') || gv('15') || 0,   // interest collected
          socialFund: gv('10') || gv('14') || 0,   // social/vaccine fund
        })

        // Loan purpose breakdown
        setLoan([
          { name: 'Khẩn cấp',   value: gv('13.1') },
          { name: 'Kinh doanh', value: gv('13.2') },
          { name: 'Tiêu dùng',  value: gv('13.3') },
          { name: 'Khác',       value: gv('13.4') },
        ])

        // ── Recent meetings ───────────────────────────────────────────────
        setRecent(vd(latMR).map(m => ({
          ...m,
          _statusCls: MEETING_STATUS_CLS[m.status] || 'text-gray-400 bg-gray-50 border-gray-100',
          _typeLabel: MEETING_TYPE_LABEL[m.meetingType] || m.meetingType,
        })))

        setSugg(vd(sugR))

        // ── 6-month financial trend ───────────────────────────────────────
        const trendRes = await Promise.allSettled(
          months.map(m =>
            httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${m.from}&toDate=${m.to}&${buildQ()}&_start=0&_end=100`)
          )
        )
        setTrend(months.map((m, i) => {
          if (trendRes[i].status !== 'fulfilled') return { month: m.label, Tiết_kiệm: 0, Dư_nợ: 0, Quỹ_xã_hội: 0 }
          const rd = trendRes[i].value?.payload?.data || []
          const g  = (id) => rd.find(r => String(r.id) === String(id))?.accumulatedValue || 0
          return {
            month:     m.label,
            Tiết_kiệm:  g('5') || g('3')  || 0,
            Dư_nợ:      g('9') || g('11') || 0,
            Quỹ_xã_hội: g('10')|| g('14') || 0,
          }
        }))

      } catch (e) {
        console.error('[Dashboard] load error:', e)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [fromDate, toDate, buildQ])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const repaymentPct   = finance.principal > 0 ? fmtPct(finance.repaid, finance.principal) : 0
  const activeMemberPct = kpi.members > 0 ? fmtPct(kpi.activeMembers, kpi.members) : 0
  const loanTotal      = useMemo(() => loanPurpose.reduce((s, d) => s + d.value, 0), [loanPurpose])

  const hasTrendData   = trendData.some(d => d.Tiết_kiệm > 0 || d.Dư_nợ > 0)
  const hasFinance     = finance.savings > 0 || finance.outstanding > 0

  // ── Scope label for header ──────────────────────────────────────────────────
  const scopeLabel = useMemo(() => {
    const parts = []
    if (roleUser?.cityName)  parts.push(roleUser.cityName)
    if (roleUser?.wardName)  parts.push(roleUser.wardName)
    if (roleUser?.projectName) parts.push(roleUser.projectName)
    return parts.join(' · ') || 'Toàn hệ thống'
  }, [roleUser])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Greeting banner + period filter ────────────────────────────────── */}
      <div className="bg-gradient-to-r from-orange-bg to-orange-hover rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-white/70 font-inter text-[13px]">
              {ROLE_LABEL[infoUser?.role] || infoUser?.role}
              {scopeLabel && <span className="ml-2 opacity-60">· {scopeLabel}</span>}
            </p>
            <h1 className="text-xl font-bold font-manrope mt-1">
              {greeting()}, {infoUser?.name?.split(' ').pop() || infoUser?.username} 👋
            </h1>
            <p className="text-white/60 font-inter text-[12px] mt-1">{dayjs().format('dddd, DD/MM/YYYY')}</p>
          </div>

          {/* Period picker */}
          <div className="shrink-0">
            <p className="text-white/70 font-inter text-[12px] mb-1">Kỳ báo cáo</p>
            <RangePicker
              picker="month"
              value={period}
              onChange={(v) => v && setPeriod(v)}
              format="MM/YYYY"
              allowClear={false}
              className="rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }}
              presets={[
                { label: 'Tháng này',  value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                { label: 'Quý này',    value: [dayjs().startOf('quarter'), dayjs().endOf('quarter')] },
                { label: 'Năm nay',    value: [dayjs().startOf('year'), dayjs().endOf('year')] },
                { label: 'Tháng trước', value: [dayjs().subtract(1,'month').startOf('month'), dayjs().subtract(1,'month').endOf('month')] },
              ]}
            />
          </div>
        </div>

        {/* Banner summary numbers */}
        <div className="hidden md:flex items-center gap-3 mt-4 flex-wrap">
          {[
            { label: 'Nhóm HĐ',     val: fmtVN(kpi.activeGroups) },
            { label: 'Thành viên',   val: fmtVN(kpi.members) },
            { label: 'Cuộc họp',     val: fmtVN(kpi.meetings) },
            { label: 'Nhóm mới kỳ', val: `+${fmtVN(kpi.newGroups)}` },
          ].map((s, i) => (
            <div key={i} className="bg-white/15 rounded-xl px-3 py-2 text-center backdrop-blur-sm min-w-[80px]">
              <p className="text-base font-bold font-manrope">{loading ? '—' : s.val}</p>
              <p className="text-[11px] text-white/70 font-inter">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 1: Operational KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard
          bg="bg-light-green" icon="🏘️"
          label="Nhóm đang hoạt động"
          value={fmtVN(kpi.activeGroups)}
          sub={`${fmtVN(kpi.groups)} tổng · +${fmtVN(kpi.newGroups)} nhóm mới kỳ này`}
          to="/groups" loading={loading}
        />
        <KPICard
          bg="bg-light-purple" icon="👥"
          label="Thành viên hoạt động"
          value={fmtVN(kpi.activeMembers)}
          sub={`/ ${fmtVN(kpi.members)} tổng — ${activeMemberPct}% HĐ`}
          trend={`${activeMemberPct}%`} trendUp={activeMemberPct >= 70}
          loading={loading}
        />
        <KPICard
          bg="bg-light-orange" icon="📅"
          label={`Cuộc họp (${period[0].format('MM/YYYY')} – ${period[1].format('MM/YYYY')})`}
          value={fmtVN(kpi.meetings)}
          sub={`ĐK: ${fmtVN(kpi.meetingsByType.first_meeting)}  CK: ${fmtVN(kpi.meetingsByType.last_meeting)}  TK: ${fmtVN(kpi.meetingsByType.regular_meeting)}`}
          to="/meetings" loading={loading}
        />
      </div>

      {/* ── Row 2: Financial KPIs ────────────────────────────────────────────── */}
      {hasFinance || !loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard
            bg="bg-amber-50" icon="💰"
            label="Tiết kiệm cổ phần lũy kế"
            value={fmtM(finance.savings)}
            sub={finance.savings > 0 ? `${fmtVN(finance.savings)} ₫` : 'Chưa có dữ liệu kỳ này'}
            trendUp={true}
            loading={loading}
          />
          <KPICard
            bg="bg-red-50" icon="📊"
            label="Dư nợ vay hiện tại"
            value={fmtM(finance.outstanding)}
            sub={finance.principal > 0 ? `Tổng giải ngân: ${fmtM(finance.principal)}` : 'Chưa có dữ liệu'}
            loading={loading}
          />
          <KPICard
            bg="bg-blue-50" icon="✅"
            label="Tỉ lệ hoàn trả vay"
            value={finance.principal > 0 ? `${repaymentPct}%` : 'N/A'}
            sub={finance.repaid > 0 ? `Đã thu hồi: ${fmtM(finance.repaid)}` : 'Chưa có dữ liệu'}
            trend={finance.principal > 0 ? `${repaymentPct}%` : undefined}
            trendUp={repaymentPct >= 80}
            loading={loading}
          />
        </div>
      ) : null}

      {/* ── Zone C: Financial trend + Health rings ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Area chart: Financial trend */}
        <div className="xl:col-span-2">
          <Section title="Xu hướng tài chính 6 tháng" subtitle="Tiết kiệm · Dư nợ · Quỹ xã hội (đơn vị: triệu đồng)">
            {loading ? <Sk h="h-52"/> : !hasTrendData ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <span className="text-3xl mb-2">📈</span>
                <p className="font-inter text-[14px]">Dữ liệu tài chính chưa được tổng hợp</p>
                <p className="font-inter text-[12px] mt-1">Kiểm tra cấu hình báo cáo overview_report_v2</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSavings"    x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gOutstanding" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E4701E" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#E4701E" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gSocial"     x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#9333EA" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#9333EA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#484746' }}/>
                  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }} width={52}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter' }}/>
                  <Area type="monotone" dataKey="Tiết_kiệm"   name="Tiết kiệm"   stroke="#16A34A" fill="url(#gSavings)"     strokeWidth={2} dot={false}/>
                  <Area type="monotone" dataKey="Dư_nợ"        name="Dư nợ"       stroke="#E4701E" fill="url(#gOutstanding)"  strokeWidth={2} dot={false}/>
                  <Area type="monotone" dataKey="Quỹ_xã_hội"  name="Quỹ xã hội"  stroke="#9333EA" fill="url(#gSocial)"      strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Section>
        </div>

        {/* Health rings */}
        <Section title="Chỉ số sức khỏe" subtitle="Tính theo kỳ báo cáo">
          {loading ? (
            <div className="space-y-4"><Sk h="h-16"/><Sk h="h-16"/><Sk h="h-16"/></div>
          ) : (
            <div className="flex flex-col gap-4">
              <ProgressRing
                value={repaymentPct} max={100} color="#16A34A" size={70}
                label="Tỉ lệ hoàn trả vay"
                sub={finance.principal > 0 ? `${fmtM(finance.repaid)} / ${fmtM(finance.principal)}` : 'Chưa có dữ liệu'}
              />
              <div className="h-px bg-light-gray"/>
              <ProgressRing
                value={kpi.activeMembers} max={kpi.members} color="#E4701E" size={70}
                label="Thành viên hoạt động"
                sub={`${fmtVN(kpi.activeMembers)} / ${fmtVN(kpi.members)}`}
              />
              <div className="h-px bg-light-gray"/>
              {finance.socialFund > 0 && (
                <>
                  <div className="bg-light-purple rounded-xl p-3">
                    <p className="text-[12px] text-gray-text font-inter">Quỹ xã hội khả dụng</p>
                    <p className="text-base font-bold font-manrope text-main-title mt-0.5">{fmtM(finance.socialFund)} ₫</p>
                  </div>
                </>
              )}
              {finance.interest > 0 && (
                <div className="bg-light-green rounded-xl p-3">
                  <p className="text-[12px] text-gray-text font-inter">Lãi thu được kỳ này</p>
                  <p className="text-base font-bold font-manrope text-main-title mt-0.5">{fmtM(finance.interest)} ₫</p>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* ── Zone D: Loan purpose + Meeting compliance ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Loan purpose bar */}
        <Section title="Cho vay theo mục đích" subtitle={loanTotal > 0 ? `Lũy kế ${fmtVN(loanTotal)} khoản` : 'Kỳ này'}>
          {loading ? <Sk h="h-44"/> : loanTotal === 0 ? (
            <p className="text-center text-gray-400 font-inter text-[13px] py-8">Chưa có dữ liệu cho vay</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={loanPurpose} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }}/>
                <YAxis tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="value" name="Số khoản" radius={[5, 5, 0, 0]}>
                  {loanPurpose.map((_, i) => <Cell key={i} fill={LOAN_COLORS[i % LOAN_COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Meeting compliance breakdown */}
        <div className="xl:col-span-2">
          <Section title="Tuân thủ cuộc họp" subtitle={`Kỳ ${period[0].format('MM/YYYY')} – ${period[1].format('MM/YYYY')}`} to="/meetings">
            {loading ? (
              <div className="space-y-4"><Sk h="h-16"/><div className="grid grid-cols-3 gap-3"><Sk h="h-20"/><Sk h="h-20"/><Sk h="h-20"/></div></div>
            ) : (
              <>
                {/* Total + breakdown badges */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MeetingBadge type="first_meeting"   count={kpi.meetingsByType.first_meeting}   loading={loading}/>
                  <MeetingBadge type="last_meeting"    count={kpi.meetingsByType.last_meeting}    loading={loading}/>
                  <MeetingBadge type="regular_meeting" count={kpi.meetingsByType.regular_meeting} loading={loading}/>
                </div>

                {/* Risk flag: no last_meeting (groups haven't closed the cycle) */}
                {kpi.meetingsByType.last_meeting === 0 && kpi.meetings > 0 && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                    <span className="text-red-500 text-lg shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-[13px] font-[600] text-red-700 font-manrope">Không có cuộc họp cuối kỳ</p>
                      <p className="text-[12px] text-red-600 font-inter mt-0.5">
                        Kỳ này chưa ghi nhận cuộc họp cuối kỳ nào. Kiểm tra các nhóm chưa kết thúc chu kỳ.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent meetings list */}
                {recentMtg.length === 0 ? (
                  <p className="text-center text-gray-400 font-inter text-[13px] py-4">Chưa có cuộc họp nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentMtg.slice(0, 5).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="shrink-0 w-1 h-8 rounded-full bg-orange-bg"/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link to={`/groups/detailgroup/${m.groupId}`}
                              className="font-[500] text-[13px] text-main-title font-inter truncate hover:text-orange-bg">
                              {m.groupName}
                            </Link>
                            <span className="text-[11px] text-gray-400 shrink-0">{m._typeLabel}</span>
                          </div>
                          {m.date && (
                            <p className="text-[11px] text-gray-400 font-inter">
                              {dayjs(m.date).format('HH:mm DD/MM/YY')}
                              {m.location && ` · ${m.location}`}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 text-[11px] font-[500] px-2 py-0.5 rounded-lg border font-inter ${m._statusCls}`}>
                          {m.status === 'Done' ? 'Xong' : 'Đang họp'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>
        </div>
      </div>

      {/* ── Zone E: Suggestions (reduced priority) ──────────────────────────── */}
      {suggestions.length > 0 && (
        <Section title="Góp ý từ người dùng" to="/messages?type=CUSTOMER_SUPPORT" subtitle="Phản hồi gần nhất">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {suggestions.map((msg, i) => (
              <Link key={i} to={`/messages/view/${msg.id}`}
                className="block p-3 rounded-xl hover:bg-orange-bg/5 border border-transparent hover:border-orange-bg/20 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-[500] text-[13px] text-main-title font-manrope line-clamp-1">{msg.title}</p>
                  <span className="text-[11px] text-gray-400 font-inter shrink-0">
                    {msg.sendDate ? dayjs(msg.sendDate).format('DD/MM') : ''}
                  </span>
                </div>
                <p className="text-[12px] text-gray-text font-inter mt-0.5 line-clamp-1">{msg.content}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

    </div>
  )
}