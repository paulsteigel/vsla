// [paulsteigel - 2026-05-22] MANAGEMENT COMMAND CENTER v4
// CRITICAL FIX: overview_report_v2 có 3 section A/B/C với ID bị lặp lại
// Phải dùng bySection() cho các ID không unique. Chi tiết mapping:
//
//  SECTION A - XÂY DỰNG TỔ CHỨC:
//    '3'  → Nhóm đang HĐ (value=kỳ, accumulated=lũy kế)
//    '4'  → TV mới tham gia
//    '6'  → TV đang HĐ  ← SAFE gv()
//    '7'  → TV trung bình/nhóm (~14) — ĐỪNG nhầm với disbursed!
//    '8'  → Tỉ lệ họp %  ← SAFE gv()
//
//  SECTION B - TÍN DỤNG (cần bySection vì ID trùng với A):
//    B'3'  → Tiết kiệm gốc cuối kỳ (Đồng)
//    B'4'  → Tiết kiệm bình quân/TV (Đồng)
//    B'13' → Tổng vốn phát ra (Đồng)  ← UNIQUE, gv() OK
//    B'13.1-4' → Vốn theo mục đích   ← UNIQUE, gv() OK
//    B'14'  → Hoàn trả vốn tổng       ← UNIQUE, gv() OK
//    B'14.1'→ Hoàn trả gốc (Đồng)    ← UNIQUE, gv() OK
//    B'14.2'→ Lãi thu được (Đồng)     ← UNIQUE, gv() OK
//    B'10' → Số khoản vay chưa hoàn trả (count) ← bySection
//
//  SECTION C - QUỸ TƯƠNG TRỢ (cần bySection):
//    C'1'  → Tổng thu quỹ (Đồng)
//    C'4'  → Dư nợ quỹ tương trợ (Đồng)
//
//  DƯ NỢ VND = gv('13') - gv('14.1')  (tổng phát - đã thu gốc)
//  TỈ LỆ HOÀN TRẢ = gv('14.1') / gv('13') × 100
//
// BUG CŨ: gv('7')=14 (TB TV/nhóm) dùng làm principal, gv('12')=5039
// (TV đang giữ vốn) dùng làm repaid → 5039/14×100 = 35992% 💀

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

// ─── VSLA Thresholds ─────────────────────────────────────────────────────────
const THR = {
  repayment:   { good: 95, warn: 80 },
  attendance:  { good: 80, warn: 65 },
  activeMember:{ good: 75, warn: 60 },
  meetings:    { good: 85, warn: 65 },
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtVN = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtM  = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(2)} tỷ`
  if (v >= 1_000_000)     return `${(v/1_000_000).toFixed(2)} tr`
  if (v > 0)              return fmtVN(Math.round(v))
  return '—'
}
const pct = (v, max) => (max > 0 ? Math.min(Math.round((v/max)*100), 100) : 0)

// ─── Report data helpers ──────────────────────────────────────────────────────
// gv: lấy accumulatedValue theo id (chỉ dùng cho IDs UNIQUE giữa các section)
const mkGv = (data) => (id, field = 'accumulatedValue') =>
  Number(data.find(r => String(r.id) === String(id))?.[field] || 0)

// bySection: lấy value trong section cụ thể (cho IDs bị trùng A/B/C)
const mkBs = (data) => (section, id, field = 'accumulatedValue') => {
  const secIdx = data.findIndex(r => String(r.id) === section)
  if (secIdx === -1) return 0
  const endIdx = data.findIndex((r, i) => i > secIdx && ['A','B','C'].includes(String(r.id)))
  const rows = endIdx === -1 ? data.slice(secIdx+1) : data.slice(secIdx+1, endIdx)
  return Number(rows.find(r => String(r.id) === String(id))?.[field] || 0)
}

// ─── Health color ─────────────────────────────────────────────────────────────
const hColor = (v, thr) => {
  if (!thr || v === 0) return 'gray'
  if (v >= thr.good)  return 'green'
  if (v >= thr.warn)  return 'amber'
  return 'red'
}
const hCls = {
  green: { bg:'bg-green-50',  border:'border-green-200',  text:'text-green-700',  dot:'bg-green-500',  bar:'#16A34A' },
  amber: { bg:'bg-amber-50',  border:'border-amber-200',  text:'text-amber-700',  dot:'bg-amber-500',  bar:'#D97706' },
  red:   { bg:'bg-red-50',    border:'border-red-200',    text:'text-red-700',    dot:'bg-red-500',    bar:'#DC2626' },
  gray:  { bg:'bg-gray-50',   border:'border-gray-200',   text:'text-gray-500',   dot:'bg-gray-300',   bar:'#9CA3AF' },
}

const ROLE_LABEL = {
  ADMIN:'Quản trị hệ thống', ORGANIZATION_ADMIN:'Quản lý tổ chức',
  PROJECT_ADMIN:'Quản lý dự án', CITY_ADMIN:'Cán bộ tỉnh', WARD_ADMIN:'Cán bộ xã',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({h='h-4',w='w-full'}) => <div className={`animate-pulse bg-gray-100 rounded-lg ${h} ${w}`}/>

// ─── Status dot ───────────────────────────────────────────────────────────────
function Dot({ color='gray', size='w-2.5 h-2.5', pulse=false }) {
  const c = hCls[color]
  return (
    <span className="relative flex shrink-0">
      {pulse && color==='red' && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-60`}/>}
      <span className={`relative inline-flex rounded-full ${size} ${c.dot}`}/>
    </span>
  )
}

// ─── Threshold meter ──────────────────────────────────────────────────────────
function Meter({ value=0, thr, label, sub, delta, unit='%', loading }) {
  const color = hColor(value, thr)
  const cls   = hCls[color]
  return (
    <div className={`rounded-xl border p-4 ${cls.bg} ${cls.border}`}>
      {loading
        ? <div className="space-y-2"><Sk h="h-4" w="w-28"/><Sk h="h-8" w="w-20"/><Sk h="h-2"/></div>
        : <>
            <div className="flex items-start justify-between mb-1">
              <p className="text-[12px] font-inter text-gray-500 leading-tight pr-2">{label}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <Dot color={color} size="w-2 h-2"/>
                {delta !== undefined && delta !== 0 && (
                  <span className={`text-[11px] font-[600] ${delta>0?'text-green-600':'text-red-600'}`}>
                    {delta>0?'↑':'↓'}{Math.abs(Math.round(delta))}
                  </span>
                )}
              </div>
            </div>
            <p className={`text-2xl font-bold font-manrope ${cls.text} leading-none mb-2`}>
              {value > 0 ? `${value}${unit}` : '—'}
            </p>
            <div className="relative h-1.5 bg-gray-200 rounded-full">
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{width:`${Math.min(value,100)}%`, background:cls.bar}}/>
              {thr && (
                <div className="absolute top-[-3px] w-0.5 h-[9px] bg-gray-500 rounded-full"
                  style={{left:`${thr.good}%`}} title={`Ngưỡng tốt: ${thr.good}%`}/>
              )}
            </div>
            {sub && <p className="text-[11px] text-gray-400 font-inter mt-1.5">{sub}</p>}
          </>
      }
    </div>
  )
}

// ─── Alert item ───────────────────────────────────────────────────────────────
function Alert({ severity='warning', title, detail, to }) {
  const cfg = {
    critical:{ icon:'🔴', bg:'bg-red-50',   border:'border-red-200',   text:'text-red-800',   badge:'Cần xử lý', bc:'bg-red-100 text-red-700' },
    warning: { icon:'🟡', bg:'bg-amber-50', border:'border-amber-200', text:'text-amber-800', badge:'Chú ý',    bc:'bg-amber-100 text-amber-700' },
    info:    { icon:'🔵', bg:'bg-blue-50',  border:'border-blue-200',  text:'text-blue-800',  badge:'Thông tin',bc:'bg-blue-100 text-blue-700' },
  }[severity]
  const inner = (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} hover:opacity-90 transition-opacity`}>
      <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[13px] font-[600] font-manrope ${cfg.text}`}>{title}</p>
          <span className={`text-[10px] font-[600] px-1.5 py-0.5 rounded-md ${cfg.bc}`}>{cfg.badge}</span>
        </div>
        {detail && <p className="text-[12px] text-gray-500 font-inter mt-0.5">{detail}</p>}
      </div>
      {to && <span className="text-[12px] text-link font-inter shrink-0 mt-0.5">→</span>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Impact stat card ─────────────────────────────────────────────────────────
function ImpactCard({ icon, value, label, sub, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-orange-bg/10 flex items-center justify-center text-xl shrink-0">{icon}</div>
      <div className="min-w-0">
        {loading
          ? <div className="space-y-1.5"><Sk h="h-7" w="w-24"/><Sk h="h-3.5" w="w-36"/></div>
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
function Section({ title, subtitle, to, children }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-[15px] font-manrope text-main-title">{title}</h3>
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

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-light-gray rounded-xl p-3 shadow-sm text-[12px] font-inter">
      <p className="font-[600] text-main-title mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: <strong>{fmtM(p.value)} ₫</strong></p>)}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { infoUser, roleUser } = useAuthStore()
  const [period, setPeriod] = useState([dayjs().startOf('month'), dayjs()])

  const fromDate = period[0].format('YYYY-MM-DD')
  const toDate   = period[1].format('YYYY-MM-DD')
  const prevFrom = period[0].subtract(1,'month').startOf('month').format('YYYY-MM-DD')
  const prevTo   = period[0].subtract(1,'month').endOf('month').format('YYYY-MM-DD')

  const [impact,  setImpact]  = useState({ totalGroups:0, activeGroups:0, totalMembers:0, activeMembers:0, avgMemberPerGroup:0 })
  const [finance, setFinance] = useState({ savings:0, savingsPerMember:0, totalDisbursed:0, repaidPrincipal:0, interestCollected:0, outstanding:0, socialFundBalance:0, socialFundIn:0 })
  const [meal,    setMeal]    = useState({ repaymentRate:0, attendanceRate:0, activeMemberRate:0, meetingCoverage:0 })
  const [delta,   setDelta]   = useState({ repaymentRate:0, attendanceRate:0, activeMemberRate:0 })
  const [loanPurpose, setLoan]= useState([])
  const [alerts,  setAlerts]  = useState([])
  const [trend,   setTrend]   = useState([])
  const [recentMtg, setRecent]= useState([])
  const [loading, setLoading] = useState(true)

  const scopeParam = useMemo(() => {
    const p = {}
    if (roleUser?.projectId)      p.projectId      = roleUser.projectId
    if (roleUser?.organizationId) p.organizationId = roleUser.organizationId
    if (roleUser?.cityCode)       p.cityCode       = roleUser.cityCode
    if (roleUser?.wardCode)       p.wardCode       = roleUser.wardCode
    return p
  }, [roleUser])

  const q = useCallback((extra={}) =>
    new URLSearchParams({...scopeParam, ...extra}).toString()
  , [scopeParam])

  const fetchReport = useCallback(async (from, to) => {
    const res = await httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${from}&toDate=${to}&${q()}&_start=0&_end=200`)
    return res?.payload?.data || []
  }, [q])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const now = dayjs()
      const months = Array.from({length:6}, (_,i) => {
        const m = now.subtract(5-i,'month')
        return { label:m.format('MM/YY'), from:m.startOf('month').format('YYYY-MM-DD'), to:m.endOf('month').format('YYYY-MM-DD') }
      })

      try {
        const [allGrpR, mtgPeriodR, latMtgR, rptCurrR, rptPrevR, suggR] = await Promise.allSettled([
          httpAuth.get(`/groups?${q()}`),
          httpAuth.get(`/meetings?${q({fromDate, toDate})}`),
          httpAuth.get(`/meetings?${q({_start:0, _end:8})}`),
          fetchReport(fromDate, toDate),
          fetchReport(prevFrom, prevTo),
          httpAuth.get(`/notifications?type=CUSTOMER_SUPPORT&_start=0&_end=4`),
        ])

        const vp = (r) => r.status==='fulfilled' ? r.value?.payload : null
        const vt = (r) => vp(r)?.total || 0
        const vd = (r) => vp(r)?.data  || []

        // rptCurrR is already the data array (fetchReport returns array directly)
        const rptData = rptCurrR.status==='fulfilled' ? rptCurrR.value : []
        const rptPrev = rptPrevR.status==='fulfilled' ? rptPrevR.value : []

        // Build helpers with actual data
        const gv  = mkGv(rptData)
        const bs  = mkBs(rptData)
        const gvP = mkGv(rptPrev)

        // ── Section A — Tổ chức ──────────────────────────────────────────
        const activeGroups      = gv('3')      // A-3 accumulated: nhóm đang HĐ
        const activeGroupsPeriod= gv('3','value') // A-3 value: nhóm HĐ trong kỳ
        const totalMembers      = gv('4')      // A-4 accumulated: TV mới (proxy total)
        const activeMembers     = gv('6')      // A-6 accumulated: TV đang HĐ ✓
        const avgMemberPerGroup = gv('7')      // A-7: TB TV/nhóm (display only)
        const attendanceRate    = Math.round(gv('8')) // A-8: % họp nhóm ✓

        const totalGroups = vt(allGrpR) || activeGroups

        // ── Section B — Tín dụng (unique IDs safe) ──────────────────────
        const savings         = bs('B','3')     // B-3: Tiết kiệm gốc cuối kỳ (Đồng)
        const savingsPerMember= bs('B','4')     // B-4: Tiết kiệm bình quân/TV
        const totalDisbursed  = gv('13')        // B-13: Tổng vốn phát ra (UNIQUE)
        const repaidPrincipal = gv('14.1')      // B-14.1: Gốc hoàn trả (UNIQUE)
        const interestCollected= gv('14.2')     // B-14.2: Lãi thu được (UNIQUE)
        const outstanding     = Math.max(0, totalDisbursed - repaidPrincipal)

        // ── Section C — Quỹ tương trợ ───────────────────────────────────
        const socialFundIn      = bs('C','1')   // C-1: Thu quỹ
        const socialFundBalance = bs('C','4')   // C-4: Dư nợ quỹ

        // ── Derived rates ────────────────────────────────────────────────
        const repaymentRate    = totalDisbursed > 0 ? pct(repaidPrincipal, totalDisbursed) : 0
        const activeMemberRate = totalMembers   > 0 ? pct(activeMembers,   totalMembers)   : 0
        // Meeting coverage = nhóm HĐ trong kỳ / tổng nhóm HĐ (dùng report, không fetch meetings)
        const meetingCoverage  = activeGroups   > 0 ? pct(activeGroupsPeriod, activeGroups) : 0

        // ── Previous period deltas ───────────────────────────────────────
        const prevDisbursed  = gvP('13')
        const prevRepaid     = gvP('14.1')
        const prevMembers    = gvP('4')
        const prevActive     = gvP('6')
        const prevAttendance = Math.round(gvP('8'))

        const prevRepaymentRate   = prevDisbursed > 0 ? pct(prevRepaid, prevDisbursed) : 0
        const prevActiveMemberRate= prevMembers   > 0 ? pct(prevActive, prevMembers)   : 0

        setImpact({ totalGroups, activeGroups, totalMembers, activeMembers, avgMemberPerGroup })
        setFinance({ savings, savingsPerMember, totalDisbursed, repaidPrincipal, interestCollected, outstanding, socialFundBalance, socialFundIn })
        setMeal({ repaymentRate, attendanceRate, activeMemberRate, meetingCoverage })
        setDelta({
          repaymentRate:    repaymentRate    - prevRepaymentRate,
          attendanceRate:   attendanceRate   - prevAttendance,
          activeMemberRate: activeMemberRate - prevActiveMemberRate,
        })

        // Loan amounts by purpose (13.1-13.4 are UNIQUE IDs — safe)
        setLoan([
          { name:'Khẩn cấp',  value:gv('13.1') },
          { name:'Kinh doanh',value:gv('13.2') },
          { name:'Tiêu dùng', value:gv('13.3') },
          { name:'Khác',      value:gv('13.4') },
        ])

        // ── Alerts ───────────────────────────────────────────────────────
        const newAlerts = []
        if (repaymentRate > 0 && repaymentRate < THR.repayment.warn) {
          newAlerts.push({ severity:'critical',
            title: `Tỉ lệ hoàn trả thấp: ${repaymentRate}%`,
            detail:`Ngưỡng an toàn ${THR.repayment.warn}%. Cần rà soát danh sách vay tồn đọng.`,
            to:'/groups' })
        } else if (repaymentRate > 0 && repaymentRate < THR.repayment.good) {
          newAlerts.push({ severity:'warning',
            title:`Tỉ lệ hoàn trả ${repaymentRate}% — chưa đạt mục tiêu ${THR.repayment.good}%`,
            detail:`Còn ${fmtM(outstanding)} ₫ chưa thu hồi. Theo dõi sát các khoản tồn đọng.`,
            to:'/groups' })
        }
        if (attendanceRate > 0 && attendanceRate < THR.attendance.warn) {
          newAlerts.push({ severity:'warning',
            title:`Tỉ lệ tham dự cuộc họp thấp: ${attendanceRate}%`,
            detail:`Mục tiêu ${THR.attendance.good}%. Kiểm tra vắng mặt ở các nhóm.`,
            to:'/meetings' })
        }
        if (meetingCoverage > 0 && meetingCoverage < THR.meetings.warn) {
          newAlerts.push({ severity:'warning',
            title:`Chỉ ${meetingCoverage}% nhóm có cuộc họp trong kỳ`,
            detail:`${fmtVN(activeGroups - activeGroupsPeriod)} nhóm chưa tổ chức họp kỳ này.`,
            to:'/meetings' })
        }
        const suggCount = vd(suggR).length
        if (suggCount > 0) {
          newAlerts.push({ severity:'info',
            title:`${suggCount} góp ý người dùng chưa xem`,
            detail:'Phản hồi cần được xử lý kịp thời.',
            to:'/messages?type=CUSTOMER_SUPPORT' })
        }
        setAlerts(newAlerts)

        setRecent(vd(latMtgR).map(m => ({
          ...m,
          _type:{ first_meeting:'Đầu kỳ', last_meeting:'Cuối kỳ', regular_meeting:'Thường kỳ' }[m.meetingType] || m.meetingType,
          _typeCls:{ first_meeting:'bg-purple-50 text-purple-700', last_meeting:'bg-blue-50 text-blue-700', regular_meeting:'bg-green-50 text-green-700' }[m.meetingType] || 'bg-gray-50 text-gray-500',
        })))

        // ── 6-month trend ─────────────────────────────────────────────────
        const trendRes = await Promise.allSettled(months.map(m => fetchReport(m.from, m.to)))
        setTrend(months.map((m,i) => {
          if (trendRes[i].status !== 'fulfilled') return { month:m.label, 'Tiết kiệm':0, 'Giải ngân':0, 'Thu hồi':0 }
          const d   = trendRes[i].value
          const g   = mkGv(d)
          const bsc = mkBs(d)
          return {
            month:     m.label,
            'Tiết kiệm': bsc('B','3'),     // B-3: Tiết kiệm gốc (Đồng)
            'Giải ngân': g('13'),           // B-13: Tổng vốn phát ra (Đồng)
            'Thu hồi':   g('14.1'),         // B-14.1: Gốc đã hoàn trả (Đồng)
          }
        }))

      } catch(e) {
        console.error('[Dashboard] error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fromDate, toDate, prevFrom, prevTo, q, fetchReport])

  // ── Computed ──────────────────────────────────────────────────────────────
  const loanTotal = loanPurpose.reduce((s,d) => s+d.value, 0)
  const hasTrend  = trend.some(d => d['Tiết kiệm']>0 || d['Giải ngân']>0)
  const overallHealth = useMemo(() => {
    const s = [hColor(meal.repaymentRate, THR.repayment), hColor(meal.attendanceRate, THR.attendance), hColor(meal.activeMemberRate, THR.activeMember)]
    if (s.some(x => x==='red'))   return 'red'
    if (s.some(x => x==='amber')) return 'amber'
    if (s.every(x => x==='green'))return 'green'
    return 'gray'
  }, [meal])

  const scopeLabel = useMemo(() => {
    const p = []
    if (roleUser?.projectName) p.push(roleUser.projectName)
    if (roleUser?.cityName)    p.push(roleUser.cityName)
    if (roleUser?.wardName)    p.push(roleUser.wardName)
    return p.join(' · ') || 'Toàn hệ thống'
  }, [roleUser])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Dot color={overallHealth} size="w-3 h-3" pulse={overallHealth==='red'}/>
            <h1 className="text-[18px] font-bold font-manrope text-main-title">
              {ROLE_LABEL[infoUser?.role] || 'Dashboard'}
            </h1>
            {alerts.length > 0 && (
              <span className="text-[11px] font-[700] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {alerts.length} cảnh báo
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400 font-inter mt-0.5">{scopeLabel} · {dayjs().format('DD/MM/YYYY')}</p>
        </div>
        <RangePicker picker="month" value={period} format="MM/YYYY" allowClear={false}
          onChange={v => v && setPeriod(v)}
          presets={[
            { label:'Tháng này',   value:[dayjs().startOf('month'), dayjs()] },
            { label:'Quý này',     value:[dayjs().startOf('quarter'), dayjs()] },
            { label:'Năm nay',     value:[dayjs().startOf('year'), dayjs()] },
            { label:'Tháng trước', value:[dayjs().subtract(1,'month').startOf('month'), dayjs().subtract(1,'month').endOf('month')] },
          ]}
        />
      </div>

      {/* ── ALERTS ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-light-gray p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-[15px] font-manrope text-main-title">Vấn đề cần chú ý</h3>
          <span className="text-[11px] font-inter text-gray-400">Tự động cập nhật</span>
        </div>
        {loading
          ? <div className="space-y-2"><Sk h="h-14"/><Sk h="h-14"/></div>
          : alerts.length === 0
          ? <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
              <span className="text-lg">✅</span>
              <p className="text-[13px] font-[500] font-inter text-green-700">Không có vấn đề nổi bật — các chỉ số đang ổn định.</p>
            </div>
          : <div className="space-y-2">{alerts.map((a,i) => <Alert key={i} {...a}/>)}</div>
        }
      </div>

      {/* ── IMPACT (Government view) ────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">Phạm vi tác động</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ImpactCard icon="🏘️"
            value={fmtVN(impact.activeGroups)}
            label="Nhóm VSLA đang hoạt động"
            sub={`/ ${fmtVN(impact.totalGroups)} tổng · TB ${fmtVN(Math.round(impact.avgMemberPerGroup))} TV/nhóm`}
            loading={loading}/>
          <ImpactCard icon="👥"
            value={fmtVN(impact.activeMembers)}
            label="Thành viên đang hoạt động"
            sub={`/ ${fmtVN(impact.totalMembers)} lũy kế tham gia`}
            loading={loading}/>
          <ImpactCard icon="💵"
            value={finance.savings > 0 ? `${fmtM(finance.savings)} ₫` : '—'}
            label="Tiết kiệm cổ phần lũy kế"
            sub={finance.savingsPerMember > 0 ? `${fmtM(finance.savingsPerMember)} ₫/người` : 'Chưa có dữ liệu'}
            loading={loading}/>
          <ImpactCard icon="🏦"
            value={finance.totalDisbursed > 0 ? `${fmtM(finance.totalDisbursed)} ₫` : '—'}
            label="Tổng vốn phát ra lũy kế"
            sub={finance.outstanding > 0 ? `Dư nợ: ${fmtM(finance.outstanding)} ₫` : undefined}
            loading={loading}/>
        </div>
      </div>

      {/* ── MEAL SCORECARD ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">
          Chỉ số MEAL — {period[0].format('MM/YYYY')} → {period[1].format('MM/YYYY')}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Meter value={meal.repaymentRate}    thr={THR.repayment}
            label="Tỉ lệ hoàn trả vay"
            sub={finance.totalDisbursed > 0 ? `${fmtM(finance.repaidPrincipal)} / ${fmtM(finance.totalDisbursed)} ₫` : 'Chưa có dữ liệu'}
            delta={delta.repaymentRate} loading={loading}/>
          <Meter value={meal.attendanceRate}   thr={THR.attendance}
            label="Tỉ lệ tham dự cuộc họp"
            sub={`Ngưỡng tốt: ${THR.attendance.good}%`}
            delta={delta.attendanceRate} loading={loading}/>
          <Meter value={meal.activeMemberRate} thr={THR.activeMember}
            label="Thành viên hoạt động"
            sub={`${fmtVN(impact.activeMembers)} / ${fmtVN(impact.totalMembers)}`}
            delta={delta.activeMemberRate} loading={loading}/>
          <Meter value={meal.meetingCoverage}  thr={THR.meetings}
            label="Nhóm có họp trong kỳ"
            sub="Tính theo nhóm có ≥1 cuộc họp"
            loading={loading}/>
        </div>
      </div>

      {/* ── FINANCIAL HEALTH + TREND ─────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">Sức khỏe tài chính</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Financial KPI cards */}
          <div className="space-y-2.5">
            {[
              { label:'Tiết kiệm cổ phần lũy kế',  v:finance.savings,          color:'text-green-700',  bg:'bg-green-50',  border:'border-green-200' },
              { label:'Dư nợ vay hiện tại',         v:finance.outstanding,      color:'text-orange-bg',  bg:'bg-orange-50', border:'border-orange-200' },
              { label:'Lãi thu được trong kỳ',      v:finance.interestCollected,color:'text-blue-700',   bg:'bg-blue-50',   border:'border-blue-200' },
              { label:'Thu quỹ tương trợ lũy kế',   v:finance.socialFundIn,     color:'text-purple-700', bg:'bg-purple-50', border:'border-purple-200' },
            ].map((item,i) => (
              <div key={i} className={`rounded-xl border p-3.5 ${item.bg} ${item.border} flex items-center justify-between gap-3`}>
                <p className="text-[12px] text-gray-text font-inter">{item.label}</p>
                {loading
                  ? <Sk h="h-6" w="w-28 shrink-0"/>
                  : <p className={`text-base font-bold font-manrope shrink-0 ${item.color}`}>
                      {item.v > 0 ? `${fmtM(item.v)} ₫` : '—'}
                    </p>
                }
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="xl:col-span-2">
            <Section title="Xu hướng tài chính 6 tháng" subtitle="Tiết kiệm · Vốn phát ra · Thu hồi gốc (đơn vị: đồng)">
              {loading ? <Sk h="h-52"/> : !hasTrend ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="font-inter text-[14px]">Chưa có dữ liệu tài chính</p>
                  <p className="font-inter text-[12px] mt-1">Dữ liệu sẽ hiện sau khi nhóm bắt đầu ghi nhận giao dịch</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trend} margin={{top:5,right:5,left:0,bottom:0}}>
                    <defs>
                      {[['s','#16A34A'],['d','#E4701E'],['r','#4079ED']].map(([id,c]) => (
                        <linearGradient key={id} id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={c} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={c} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                    <XAxis dataKey="month" tick={{fontSize:11,fontFamily:'Inter',fill:'#484746'}}/>
                    <YAxis tickFormatter={v=>fmtM(v)} tick={{fontSize:10,fontFamily:'Inter',fill:'#484746'}} width={52}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Area type="monotone" dataKey="Tiết kiệm" stroke="#16A34A" fill="url(#gs)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Giải ngân" stroke="#E4701E" fill="url(#gd)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Thu hồi"   stroke="#4079ED" fill="url(#gr)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>
        </div>
      </div>

      {/* ── LOAN PURPOSE + RECENT MEETINGS ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        <Section title="Cho vay theo mục đích" subtitle={loanTotal > 0 ? `Lũy kế ${fmtM(loanTotal)} ₫` : 'Kỳ này'}>
          {loading ? <Sk h="h-44"/> : loanTotal === 0 ? (
            <p className="text-center text-gray-400 font-inter text-[13px] py-8">Chưa có dữ liệu</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={loanPurpose} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                  <XAxis dataKey="name" tick={{fontSize:10,fontFamily:'Inter',fill:'#484746'}}/>
                  <YAxis tickFormatter={v=>fmtM(v)} tick={{fontSize:9,fontFamily:'Inter',fill:'#484746'}}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="value" name="Số tiền" radius={[5,5,0,0]}>
                    {loanPurpose.map((_,i) => <Cell key={i} fill={['#16A34A','#E4701E','#4079ED','#9333EA'][i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {loanPurpose.filter(d=>d.value>0).map((d,i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full shrink-0" style={{background:['#16A34A','#E4701E','#4079ED','#9333EA'][i], width:`${pct(d.value,loanTotal)}%`, minWidth:4}}/>
                    <span className="text-[11px] text-gray-400 font-inter shrink-0">
                      {d.name} — {fmtM(d.value)} ₫ ({pct(d.value,loanTotal)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <div className="xl:col-span-2">
          <Section title="Cuộc họp gần nhất" to="/meetings">
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_,i) => <Sk key={i} h="h-14"/>)}</div>
            ) : recentMtg.length === 0 ? (
              <p className="text-center text-gray-400 font-inter text-[13px] py-6">Chưa có cuộc họp nào</p>
            ) : (
              <div className="space-y-1.5">
                {recentMtg.map((m,i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`shrink-0 w-1 h-10 rounded-full ${m.status==='Done'?'bg-blue-400':'bg-green-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/groups/detailgroup/${m.groupId}`}
                          className="font-[500] text-[13px] text-main-title font-inter hover:text-orange-bg truncate">
                          {m.groupName}
                        </Link>
                        <span className={`text-[10px] font-[600] px-2 py-0.5 rounded-full font-inter shrink-0 ${m._typeCls}`}>
                          {m._type}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-inter mt-0.5">
                        {m.date ? dayjs(m.date).format('HH:mm · DD/MM/YY') : ''}
                        {m.location ? ` · ${m.location}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-[500] font-inter px-2 py-0.5 rounded-lg border
                      ${m.status==='Done'?'text-blue-600 bg-blue-50 border-blue-100':'text-green-600 bg-green-50 border-green-100'}`}>
                      {m.status==='Done'?'Xong':'Đang họp'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

    </div>
  )
}