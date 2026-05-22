// [paulsteigel - 2026-05-22] MANAGEMENT COMMAND CENTER v3
// Radical redesign: exception-first, threshold-aware, three-persona view
// Personas: Project Manager / MEAL Officer / Government Official

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { DatePicker } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { httpAuth } from '@/shared/api/http'
import dayjs from 'dayjs'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

const { RangePicker } = DatePicker

// ─── Thresholds (VSLA best practice) ─────────────────────────────────────────
const THRESHOLDS = {
  repayment:      { good: 95, warn: 80 },   // % hoàn trả
  attendance:     { good: 80, warn: 65 },   // % tham dự
  activeMember:   { good: 75, warn: 60 },   // % thành viên HĐ
  dataFreshness:  { good: 85, warn: 60 },   // % nhóm cập nhật < 30 ngày
  meetingCompliance: { good: 90, warn: 70 },
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtVN  = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtM   = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)} tr`
  if (v > 0)              return fmtVN(Math.round(v))
  return '—'
}
const fmtPct = (v, max = 100) => max > 0 ? Math.min(Math.round((v / max) * 100), 100) : 0
const pct    = (v, max) => max > 0 ? Math.round((v / max) * 100) : 0

// ─── Health scoring ───────────────────────────────────────────────────────────
const healthColor = (value, threshold) => {
  if (!threshold || value === 0) return 'gray'
  if (value >= threshold.good) return 'green'
  if (value >= threshold.warn) return 'amber'
  return 'red'
}
const healthCls = {
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500', bar: '#16A34A' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', bar: '#D97706' },
  red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   dot: 'bg-red-500',   bar: '#DC2626' },
  gray:  { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-500',  dot: 'bg-gray-400',  bar: '#9CA3AF' },
}

const ROLE_LABEL = {
  ADMIN: 'Quản trị hệ thống', ORGANIZATION_ADMIN: 'Quản lý tổ chức',
  PROJECT_ADMIN: 'Quản lý dự án', CITY_ADMIN: 'Cán bộ tỉnh', WARD_ADMIN: 'Cán bộ xã',
}
const MTG_TYPE = { first_meeting: 'Đầu kỳ', last_meeting: 'Cuối kỳ', regular_meeting: 'Thường kỳ' }

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ h = 'h-4', w = 'w-full', r = 'rounded-lg' }) => (
  <div className={`animate-pulse bg-gray-100 ${r} ${h} ${w}`} />
)

// ─── Traffic light dot ────────────────────────────────────────────────────────
function StatusDot({ color = 'gray', size = 'w-2.5 h-2.5', pulse = false }) {
  const c = healthCls[color]
  return (
    <span className="relative flex shrink-0">
      {pulse && color === 'red' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-60`}/>
      )}
      <span className={`relative inline-flex rounded-full ${size} ${c.dot}`}/>
    </span>
  )
}

// ─── Threshold meter ──────────────────────────────────────────────────────────
function ThresholdMeter({ value = 0, threshold, label, sub, delta, unit = '%', loading }) {
  const color  = healthColor(value, threshold)
  const cls    = healthCls[color]
  const thPct  = threshold ? (threshold.good / 100) * 100 : null

  return (
    <div className={`rounded-xl border p-4 ${cls.bg} ${cls.border}`}>
      {loading ? (
        <div className="space-y-2"><Sk h="h-5" w="w-24"/><Sk h="h-8" w="w-16"/><Sk h="h-2"/></div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-1">
            <p className="text-[12px] font-inter text-gray-text leading-tight">{label}</p>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <StatusDot color={color} size="w-2 h-2"/>
              {delta !== undefined && delta !== 0 && (
                <span className={`text-[11px] font-inter font-[600] ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
                </span>
              )}
            </div>
          </div>
          <p className={`text-2xl font-bold font-manrope ${cls.text} leading-none mb-2`}>
            {value > 0 ? `${value}${unit}` : '—'}
          </p>
          {/* Bar with threshold marker */}
          <div className="relative h-1.5 bg-gray-200 rounded-full overflow-visible">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(value, 100)}%`, background: cls.bar }}
            />
            {thPct && (
              <div
                className="absolute top-[-3px] w-0.5 h-[9px] bg-gray-500 rounded-full"
                style={{ left: `${thPct}%` }}
                title={`Ngưỡng: ${threshold.good}%`}
              />
            )}
          </div>
          {sub && <p className="text-[11px] text-gray-400 font-inter mt-1.5">{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── Alert item ───────────────────────────────────────────────────────────────
function AlertItem({ severity = 'warning', title, detail, to, action }) {
  const cfg = {
    critical: { icon: '🔴', bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-800',   badge: 'Cần xử lý',  badgeCls: 'bg-red-100 text-red-700' },
    warning:  { icon: '🟡', bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800', badge: 'Chú ý',     badgeCls: 'bg-amber-100 text-amber-700' },
    info:     { icon: '🔵', bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',  badge: 'Thông tin', badgeCls: 'bg-blue-100 text-blue-700' },
  }[severity]

  const inner = (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} hover:opacity-90 transition-opacity`}>
      <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[13px] font-[600] font-manrope ${cfg.text} leading-tight`}>{title}</p>
          <span className={`text-[10px] font-inter font-[600] px-1.5 py-0.5 rounded-md ${cfg.badgeCls}`}>{cfg.badge}</span>
        </div>
        {detail && <p className="text-[12px] text-gray-500 font-inter mt-0.5 leading-snug">{detail}</p>}
      </div>
      {(to || action) && (
        <span className="text-[12px] text-link font-inter shrink-0 mt-0.5">→</span>
      )}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : <div onClick={action} className={action ? 'cursor-pointer' : ''}>{inner}</div>
}

// ─── Impact stat ──────────────────────────────────────────────────────────────
function ImpactStat({ icon, value, label, sub, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-orange-bg/10 flex items-center justify-center text-2xl shrink-0">{icon}</div>
      <div className="min-w-0">
        {loading
          ? <div className="space-y-1.5"><Sk h="h-7" w="w-24"/><Sk h="h-4" w="w-36"/></div>
          : <>
              <p className="text-xl font-bold font-manrope text-main-title leading-tight">{value}</p>
              <p className="text-[13px] text-gray-text font-inter">{label}</p>
              {sub && <p className="text-[11px] text-gray-400 font-inter">{sub}</p>}
            </>
        }
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, badge, to, children }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[15px] font-manrope text-main-title">{title}</h3>
            {badge && (
              <span className="text-[11px] font-inter font-[600] px-2 py-0.5 rounded-full bg-orange-bg/10 text-orange-bg">{badge}</span>
            )}
          </div>
          {subtitle && <p className="text-[12px] text-gray-400 font-inter mt-0.5">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="text-[12px] text-link font-inter hover:underline shrink-0 flex items-center gap-1 mt-0.5">
            Xem thêm <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
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
    <div className="bg-white border border-light-gray rounded-xl p-3 shadow-sm text-[12px] font-inter">
      <p className="font-[600] text-main-title mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <strong>{fmtM(p.value)}</strong></p>)}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { infoUser, roleUser } = useAuthStore()

  const [period, setPeriod] = useState([dayjs().startOf('month'), dayjs()])
  const fromDate = period[0].format('YYYY-MM-DD')
  const toDate   = period[1].format('YYYY-MM-DD')
  const prevFrom = period[0].subtract(1, 'month').format('YYYY-MM-DD')
  const prevTo   = period[1].subtract(1, 'month').format('YYYY-MM-DD')

  // Data states
  const [impact, setImpact]     = useState({ totalGroups: 0, activeGroups: 0, totalMembers: 0, activeMembers: 0, communityCapital: 0, coveredWards: 0, newGroupsPeriod: 0 })
  const [finance, setFinance]   = useState({ savings: 0, outstanding: 0, principal: 0, repaid: 0, interest: 0, socialFund: 0 })
  const [meal, setMeal]         = useState({ repaymentRate: 0, attendanceRate: 0, activeMemberRate: 0, meetingCompliance: 0 })
  const [mealDelta, setDelta]   = useState({ repaymentRate: 0, attendanceRate: 0, activeMemberRate: 0 })
  const [alerts, setAlerts]     = useState([])
  const [trendData, setTrend]   = useState([])
  const [loanPurpose, setLoan]  = useState([])
  const [recentMtg, setRecent]  = useState([])
  const [loading, setLoading]   = useState(true)

  const scopeParam = useMemo(() => {
    const p = {}
    if (roleUser?.projectId)      p.projectId      = roleUser.projectId
    if (roleUser?.organizationId) p.organizationId = roleUser.organizationId
    if (roleUser?.cityCode)       p.cityCode       = roleUser.cityCode
    if (roleUser?.wardCode)       p.wardCode       = roleUser.wardCode
    return p
  }, [roleUser])

  const q = useCallback((extra = {}) =>
    new URLSearchParams({ ...scopeParam, ...extra }).toString()
  , [scopeParam])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const now    = dayjs()
      const d45    = now.subtract(45, 'day').format('YYYY-MM-DD')
      const months = Array.from({ length: 6 }, (_, i) => {
        const m = now.subtract(5 - i, 'month')
        return { label: m.format('MM/YY'), from: m.startOf('month').format('YYYY-MM-DD'), to: m.endOf('month').format('YYYY-MM-DD') }
      })

      try {
        // ── Core parallel fetch ───────────────────────────────────────────
        const [allGrpR, actGrpR, allMemR, mtgPeriodR, mtgRecentR, latMtgR, rptCurrR, rptPrevR, suggR] =
          await Promise.allSettled([
            httpAuth.get(`/groups?${q()}`),
            httpAuth.get(`/groups?${q({ status: 'Active' })}`),
            httpAuth.get(`/customers?${q()}`),
            httpAuth.get(`/meetings?${q({ fromDate, toDate })}`),
            httpAuth.get(`/meetings?${q({ fromDate: d45, toDate: now.format('YYYY-MM-DD'), _start: 0, _end: 500 })}`),
            httpAuth.get(`/meetings?${q({ _start: 0, _end: 8 })}`),
            httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${fromDate}&toDate=${toDate}&${q()}&_start=0&_end=100`),
            httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${prevFrom}&toDate=${prevTo}&${q()}&_start=0&_end=100`),
            httpAuth.get(`/notifications?type=CUSTOMER_SUPPORT&_start=0&_end=4`),
          ])

        const vp  = (r) => r.status === 'fulfilled' ? r.value?.payload : null
        const vt  = (r) => vp(r)?.total || 0
        const vd  = (r) => vp(r)?.data  || []
        const rpt = (r, id) => (vd(r).find(x => String(x.id) === String(id))?.accumulatedValue) || 0

        const totalGroups   = vt(allGrpR)
        const activeGroups  = vt(actGrpR)
        const totalMembers  = rpt(rptCurrR, '4') || vt(allMemR)
        const activeMembers = rpt(rptCurrR, '6')
        const attendancePct = rpt(rptCurrR, '8')

        // Tìm nhóm chưa họp trong 45 ngày (approximate bằng set groupId)
        const recentGroupIds = new Set(vd(mtgRecentR).map(m => m.groupId))
        const inactiveCount  = Math.max(0, activeGroups - recentGroupIds.size)

        // Financial từ report
        const savings     = rpt(rptCurrR, '5') || rpt(rptCurrR, '3')
        const outstanding = rpt(rptCurrR, '9') || rpt(rptCurrR, '11')
        const principal   = rpt(rptCurrR, '7') || rpt(rptCurrR, '10')
        const repaid      = rpt(rptCurrR, '12')|| rpt(rptCurrR, '8.1')
        const interest    = rpt(rptCurrR, '11')|| rpt(rptCurrR, '15')
        const socialFund  = rpt(rptCurrR, '10')|| rpt(rptCurrR, '14')
        const communityCapital = savings + outstanding + socialFund

        // Prev period
        const prevActiveMembers = rpt(rptPrevR, '6')
        const prevAttendance    = rpt(rptPrevR, '8')
        const prevRepaid        = rpt(rptPrevR, '12')|| rpt(rptPrevR, '8.1')
        const prevPrincipal     = rpt(rptPrevR, '7') || rpt(rptPrevR, '10')
        const prevRepaymentRate = prevPrincipal > 0 ? pct(prevRepaid, prevPrincipal) : 0
        const prevActiveMemberRate = prevActiveMembers > 0 && totalMembers > 0
          ? pct(prevActiveMembers, totalMembers) : 0

        const repaymentRate    = principal > 0 ? pct(repaid, principal) : 0
        const activeMemberRate = totalMembers > 0 ? pct(activeMembers, totalMembers) : 0
        const meetingCount     = vt(mtgPeriodR)
        // meeting compliance proxy: nhóm có meeting / active groups
        const meetingCompliancePct = activeGroups > 0 ? pct(recentGroupIds.size, activeGroups) : 0

        setImpact({ totalGroups, activeGroups, totalMembers, activeMembers, communityCapital, newGroupsPeriod: 0 })
        setFinance({ savings, outstanding, principal, repaid, interest, socialFund })
        setMeal({
          repaymentRate,
          attendanceRate: attendancePct,
          activeMemberRate,
          meetingCompliance: meetingCompliancePct,
        })
        setDelta({
          repaymentRate:    repaymentRate    - prevRepaymentRate,
          attendanceRate:   attendancePct    - (prevAttendance || 0),
          activeMemberRate: activeMemberRate - prevActiveMemberRate,
        })

        // ── Build alerts ──────────────────────────────────────────────────
        const newAlerts = []

        if (inactiveCount > 0) {
          newAlerts.push({
            severity: inactiveCount > 5 ? 'critical' : 'warning',
            title: `${inactiveCount} nhóm chưa họp trong 45 ngày qua`,
            detail: 'Các nhóm này có thể đang gặp khó khăn hoặc chưa cập nhật dữ liệu.',
            to: '/groups',
          })
        }

        if (repaymentRate > 0 && repaymentRate < THRESHOLDS.repayment.warn) {
          newAlerts.push({
            severity: 'critical',
            title: `Tỉ lệ hoàn trả thấp: ${repaymentRate}%`,
            detail: `Ngưỡng an toàn là ${THRESHOLDS.repayment.warn}%. Cần rà soát danh sách vay.`,
            to: '/groups',
          })
        } else if (repaymentRate > 0 && repaymentRate < THRESHOLDS.repayment.good) {
          newAlerts.push({
            severity: 'warning',
            title: `Tỉ lệ hoàn trả chưa đạt: ${repaymentRate}%`,
            detail: `Mục tiêu ${THRESHOLDS.repayment.good}%. Theo dõi sát các nhóm có dư nợ cao.`,
            to: '/groups',
          })
        }

        if (attendancePct > 0 && attendancePct < THRESHOLDS.attendance.warn) {
          newAlerts.push({
            severity: 'warning',
            title: `Tỉ lệ tham dự cuộc họp thấp: ${Math.round(attendancePct)}%`,
            detail: `Ngưỡng đề xuất ${THRESHOLDS.attendance.good}%. Kiểm tra các nhóm có vắng mặt cao.`,
            to: '/meetings',
          })
        }

        if (vd(suggR).length > 0) {
          newAlerts.push({
            severity: 'info',
            title: `${vd(suggR).length} góp ý người dùng chưa xem`,
            detail: 'Phản hồi từ cán bộ và thành viên cần được xử lý.',
            to: '/messages?type=CUSTOMER_SUPPORT',
          })
        }

        setAlerts(newAlerts)
        setRecent(vd(latMtgR).map(m => ({ ...m, _type: MTG_TYPE[m.meetingType] || m.meetingType })))

        // Loan purpose
        setLoan([
          { name: 'Khẩn cấp',   value: rpt(rptCurrR, '13.1') },
          { name: 'Kinh doanh', value: rpt(rptCurrR, '13.2') },
          { name: 'Tiêu dùng',  value: rpt(rptCurrR, '13.3') },
          { name: 'Khác',       value: rpt(rptCurrR, '13.4') },
        ])

        // ── 6-month trend ─────────────────────────────────────────────────
        const trendRes = await Promise.allSettled(
          months.map(m => httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${m.from}&toDate=${m.to}&${q()}&_start=0&_end=100`))
        )
        setTrend(months.map((m, i) => {
          const r = (id) => (trendRes[i].status === 'fulfilled'
            ? (trendRes[i].value?.payload?.data?.find(x => String(x.id) === String(id))?.accumulatedValue || 0)
            : 0)
          return { month: m.label, 'Tiết kiệm': r('5')||r('3'), 'Dư nợ': r('9')||r('11'), 'Quỹ XH': r('10')||r('14') }
        }))

      } catch (e) {
        console.error('[Dashboard] load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fromDate, toDate, prevFrom, prevTo, q])

  // ── Computed ──────────────────────────────────────────────────────────────
  const overallHealth = useMemo(() => {
    const scores = [
      healthColor(meal.repaymentRate,    THRESHOLDS.repayment),
      healthColor(meal.attendanceRate,   THRESHOLDS.attendance),
      healthColor(meal.activeMemberRate, THRESHOLDS.activeMember),
    ]
    if (scores.some(s => s === 'red'))   return 'red'
    if (scores.some(s => s === 'amber')) return 'amber'
    if (scores.every(s => s === 'green'))return 'green'
    return 'gray'
  }, [meal])

  const loanTotal = loanPurpose.reduce((s, d) => s + d.value, 0)
  const hasTrend  = trendData.some(d => d['Tiết kiệm'] > 0 || d['Dư nợ'] > 0)
  const scopeLabel = useMemo(() => {
    const p = []
    if (roleUser?.projectName)    p.push(roleUser.projectName)
    if (roleUser?.cityName)       p.push(roleUser.cityName)
    if (roleUser?.wardName)       p.push(roleUser.wardName)
    return p.join(' · ') || 'Toàn hệ thống'
  }, [roleUser])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── 1. COMPACT HEADER + PERIOD ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <StatusDot color={overallHealth} size="w-3 h-3" pulse={overallHealth === 'red'}/>
            <h1 className="text-[18px] font-bold font-manrope text-main-title">
              {ROLE_LABEL[infoUser?.role] || 'Dashboard'}
            </h1>
            {alerts.length > 0 && (
              <span className="text-[11px] font-[700] font-inter px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {alerts.length} cảnh báo
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400 font-inter mt-0.5">{scopeLabel} · {dayjs().format('DD/MM/YYYY')}</p>
        </div>
        <div className="shrink-0">
          <RangePicker
            picker="month" value={period} format="MM/YYYY" allowClear={false}
            onChange={(v) => v && setPeriod(v)}
            presets={[
              { label: 'Tháng này',  value: [dayjs().startOf('month'), dayjs()] },
              { label: 'Quý này',    value: [dayjs().startOf('quarter'), dayjs()] },
              { label: 'Năm nay',    value: [dayjs().startOf('year'), dayjs()] },
              { label: 'Tháng trước', value: [dayjs().subtract(1,'month').startOf('month'), dayjs().subtract(1,'month').endOf('month')] },
            ]}
          />
        </div>
      </div>

      {/* ── 2. ALERTS & EXCEPTIONS (exception-first design) ──────────────── */}
      {(loading || alerts.length > 0) && (
        <div className="bg-white rounded-2xl border border-light-gray p-5">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-[15px] font-manrope text-main-title">Vấn đề cần chú ý</h3>
            {!loading && <span className="text-[11px] font-inter text-gray-400">Cập nhật tự động</span>}
          </div>
          {loading ? (
            <div className="space-y-2"><Sk h="h-14"/><Sk h="h-14"/></div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
              <span className="text-lg">✅</span>
              <p className="text-[13px] font-inter font-[500]">Không có vấn đề nổi bật — mọi chỉ số đang ổn định.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => <AlertItem key={i} {...a}/>)}
            </div>
          )}
        </div>
      )}

      {/* ── 3. IMPACT & COVERAGE (Government view) ───────────────────────── */}
      <div>
        <p className="text-[11px] font-inter font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">
          Phạm vi tác động
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ImpactStat icon="🏘️"
            value={fmtVN(impact.activeGroups)}
            label="Nhóm VSLA đang hoạt động"
            sub={`/ ${fmtVN(impact.totalGroups)} tổng`}
            loading={loading}
          />
          <ImpactStat icon="👥"
            value={fmtVN(impact.totalMembers)}
            label="Thành viên tiếp cận TCDM"
            sub={`${fmtVN(impact.activeMembers)} đang hoạt động`}
            loading={loading}
          />
          <ImpactStat icon="💵"
            value={fmtM(finance.savings + finance.outstanding + finance.socialFund)}
            label="Tổng vốn lưu thông cộng đồng"
            sub="Tiết kiệm + Dư nợ + Quỹ XH"
            loading={loading}
          />
          <ImpactStat icon="💰"
            value={impact.totalMembers > 0 && finance.savings > 0
              ? `${fmtM(finance.savings / impact.totalMembers)} ₫`
              : '—'}
            label="Tiết kiệm bình quân / người"
            sub="Chỉ số bao phủ tài chính"
            loading={loading}
          />
        </div>
      </div>

      {/* ── 4. MEAL SCORECARD ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-inter font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">
          Chỉ số MEAL — kỳ {period[0].format('MM/YYYY')}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ThresholdMeter
            value={meal.repaymentRate}
            threshold={THRESHOLDS.repayment}
            label="Tỉ lệ hoàn trả vay"
            sub={finance.principal > 0 ? `${fmtM(finance.repaid)} / ${fmtM(finance.principal)}` : 'Chưa có dữ liệu'}
            delta={mealDelta.repaymentRate}
            loading={loading}
          />
          <ThresholdMeter
            value={Math.round(meal.attendanceRate)}
            threshold={THRESHOLDS.attendance}
            label="Tỉ lệ tham dự cuộc họp"
            sub={`Ngưỡng đề xuất: ${THRESHOLDS.attendance.good}%`}
            delta={Math.round(mealDelta.attendanceRate)}
            loading={loading}
          />
          <ThresholdMeter
            value={meal.activeMemberRate}
            threshold={THRESHOLDS.activeMember}
            label="Thành viên hoạt động"
            sub={`${fmtVN(impact.activeMembers)} / ${fmtVN(impact.totalMembers)}`}
            delta={mealDelta.activeMemberRate}
            loading={loading}
          />
          <ThresholdMeter
            value={meal.meetingCompliance}
            threshold={THRESHOLDS.meetingCompliance}
            label="Nhóm có cuộc họp gần đây"
            sub="Trong vòng 45 ngày qua"
            loading={loading}
          />
        </div>
      </div>

      {/* ── 5. FINANCIAL HEALTH + TREND ──────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-inter font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">
          Sức khỏe tài chính
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Financial KPI cards */}
          <div className="space-y-3">
            {[
              { label: 'Tiết kiệm cổ phần lũy kế',  value: finance.savings,     color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
              { label: 'Dư nợ vay hiện tại',         value: finance.outstanding, color: 'text-orange-bg',  bg: 'bg-orange-50', border: 'border-orange-200' },
              { label: 'Quỹ xã hội & Vacxin',        value: finance.socialFund,  color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
              { label: 'Lãi thu trong kỳ',           value: finance.interest,    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-3.5 ${item.bg} ${item.border} flex items-center justify-between gap-3`}>
                <p className="text-[12px] text-gray-text font-inter leading-tight">{item.label}</p>
                {loading
                  ? <Sk h="h-7" w="w-24 shrink-0"/>
                  : <p className={`text-lg font-bold font-manrope shrink-0 ${item.color}`}>
                      {item.value > 0 ? `${fmtM(item.value)} ₫` : '—'}
                    </p>
                }
              </div>
            ))}
          </div>

          {/* Area chart — financial trend */}
          <div className="xl:col-span-2">
            <Section title="Xu hướng tài chính 6 tháng" subtitle="Tiết kiệm · Dư nợ · Quỹ xã hội">
              {loading ? <Sk h="h-52"/> : !hasTrend ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="font-inter text-[14px]">Chưa có dữ liệu tài chính tổng hợp</p>
                  <p className="font-inter text-[12px] mt-1 text-center max-w-xs">
                    Kiểm tra cấu hình data_key trong overview_report_v2
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      {[['s', '#16A34A'], ['l', '#E4701E'], ['f', '#9333EA']].map(([id, c]) => (
                        <linearGradient key={id} id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={c} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={c} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#484746' }}/>
                    <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }} width={48}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="Tiết kiệm" stroke="#16A34A" fill="url(#gs)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Dư nợ"     stroke="#E4701E" fill="url(#gl)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Quỹ XH"    stroke="#9333EA" fill="url(#gf)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>
        </div>
      </div>

      {/* ── 6. LOAN PORTFOLIO + RECENT MEETINGS ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Loan purpose — MEAL / project manager analysis */}
        <Section title="Cho vay theo mục đích" subtitle={loanTotal > 0 ? `${fmtVN(loanTotal)} khoản lũy kế` : 'Kỳ này'}>
          {loading ? <Sk h="h-44"/> : loanTotal === 0 ? (
            <p className="text-center text-gray-400 font-inter text-[13px] py-8">Chưa có dữ liệu cho vay</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={loanPurpose} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }}/>
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Inter', fill: '#484746' }}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="value" name="Khoản" radius={[5,5,0,0]}>
                    {loanPurpose.map((_, i) => (
                      <Cell key={i} fill={['#16A34A','#E4701E','#4079ED','#9333EA'][i]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* % breakdown */}
              <div className="mt-3 space-y-1.5">
                {loanPurpose.filter(d => d.value > 0).map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full shrink-0" style={{ width: `${pct(d.value, loanTotal)}%`, minWidth: 4, background: ['#16A34A','#E4701E','#4079ED','#9333EA'][i]}}/>
                    <span className="text-[11px] text-gray-400 font-inter shrink-0">{d.name} {pct(d.value, loanTotal)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Recent meetings with type breakdown */}
        <div className="xl:col-span-2">
          <Section title="Cuộc họp gần nhất" subtitle="Hoạt động thực địa" to="/meetings">
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_,i) => <Sk key={i} h="h-14"/>)}</div>
            ) : recentMtg.length === 0 ? (
              <p className="text-center text-gray-400 font-inter text-[13px] py-6">Chưa có cuộc họp nào</p>
            ) : (
              <div className="space-y-1.5">
                {recentMtg.map((m, i) => {
                  const typeCls = {
                    first_meeting:   'bg-purple-50 text-purple-700',
                    last_meeting:    'bg-blue-50 text-blue-700',
                    regular_meeting: 'bg-green-50 text-green-700',
                  }[m.meetingType] || 'bg-gray-50 text-gray-600'
                  const statusDone = m.status === 'Done'
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className={`shrink-0 w-1 h-10 rounded-full ${statusDone ? 'bg-blue-400' : 'bg-green-400'}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/groups/detailgroup/${m.groupId}`}
                            className="font-[500] text-[13px] text-main-title font-inter hover:text-orange-bg truncate">
                            {m.groupName}
                          </Link>
                          <span className={`text-[10px] font-[600] px-2 py-0.5 rounded-full font-inter shrink-0 ${typeCls}`}>
                            {m._type}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-inter mt-0.5">
                          {m.date ? dayjs(m.date).format('HH:mm · DD/MM/YY') : ''}
                          {m.location ? ` · ${m.location}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-[500] font-inter px-2 py-0.5 rounded-lg border
                        ${statusDone ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                        {statusDone ? 'Xong' : 'Đang họp'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

    </div>
  )
}