// [paulsteigel - 2026-05-22] MANAGEMENT COMMAND CENTER v5
// FIXES:
// 1. SAVINGS: dùng bs('B','3','value') thay accumulatedValue
//    Lý do: overview_report lưu snapshot per-meeting từ group_asset.accumulated_*
//    accumulatedValue = SUM(tất cả snapshots lịch sử) → overcount 4-8x
//    value = SUM(snapshots kỳ này) → gần đúng số dư hiện tại
//
// 2. REPAYMENT: dùng count-based (B-9 / B-9+B-10 theo value kỳ)
//    Lý do: amount-based (14.1/13) không tin cậy vì hoan_tra_goc cũng dùng
//    snapshot group_asset → repaid > disbursed → 100% giả tạo
//
// 3. TREND: all 8 report calls parallel ngay từ đầu → không load tuần tự
//
// 4. PERFORMANCE: tách loading 2 phase
//    Phase 1: KPI chính (1 report call) → hiện ngay
//    Phase 2: Trend 6 tháng (6 report calls parallel) → hiện sau
//
// DATA KEY REFERENCE (overview_report_v2, 3 sections A/B/C):
//   SAFE gv(): '6','8','13','13.1-4','14','14.1','14.2' (unique across sections)
//   bySection bs(): tất cả ID số đơn (1-12) do trùng giữa A/B/C
//   value  = tổng kỳ hiện tại (SUM WHERE created_date IN period)
//   accumulatedValue = SUM tất cả records lịch sử → chỉ dùng cho FLOW metrics
//                      KHÔNG dùng cho BALANCE metrics (tiết kiệm, dư nợ)

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
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

// ─── Thresholds (VSLA standard) ───────────────────────────────────────────────
const THR = {
  repayment:   { good: 90, warn: 75 },
  attendance:  { good: 80, warn: 65 },
  activeMember:{ good: 75, warn: 60 },
  meetings:    { good: 85, warn: 65 },
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtVN = (n) => Number(n || 0).toLocaleString('vi-VN')
const fmtM  = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v) || v === 0) return '—'
  if (v >= 1_000_000_000_000) return `${(v/1_000_000_000_000).toFixed(2)} nghìn tỷ`
  if (v >= 1_000_000_000)     return `${(v/1_000_000_000).toFixed(2)} tỷ`
  if (v >= 1_000_000)         return `${(v/1_000_000).toFixed(2)} tr`
  return fmtVN(Math.round(v))
}
const fmtD  = (n) => n > 0 ? `${fmtM(n)} ₫` : '—'
const pct   = (v, max) => (max > 0 ? Math.min(Math.round((v/max)*100), 100) : 0)

// ─── Report helpers ───────────────────────────────────────────────────────────
// mkGv: lookup theo id trong flat array (safe chỉ với unique IDs)
const mkGv = (data) => (id, field='accumulatedValue') =>
  Number(data.find(r => String(r.id) === String(id))?.[field] || 0)

// mkBs: lookup trong section cụ thể (dùng khi ID bị trùng giữa A/B/C)
const mkBs = (data) => (section, id, field='accumulatedValue') => {
  const si = data.findIndex(r => String(r.id) === section)
  if (si === -1) return 0
  const ei = data.findIndex((r,i) => i > si && ['A','B','C'].includes(String(r.id)))
  const rows = ei === -1 ? data.slice(si+1) : data.slice(si+1, ei)
  return Number(rows.find(r => String(r.id) === String(id))?.[field] || 0)
}

// ─── Health color ─────────────────────────────────────────────────────────────
const hCol = (v, t) => {
  if (!t || v === 0) return 'gray'
  if (v >= t.good)  return 'green'
  if (v >= t.warn)  return 'amber'
  return 'red'
}
const H = {
  green: { bg:'bg-green-50', bd:'border-green-200', tx:'text-green-700', dot:'bg-green-500', bar:'#16A34A' },
  amber: { bg:'bg-amber-50', bd:'border-amber-200', tx:'text-amber-700', dot:'bg-amber-500', bar:'#D97706' },
  red:   { bg:'bg-red-50',   bd:'border-red-200',   tx:'text-red-700',   dot:'bg-red-500',   bar:'#DC2626' },
  gray:  { bg:'bg-gray-50',  bd:'border-gray-200',  tx:'text-gray-500',  dot:'bg-gray-300',  bar:'#9CA3AF' },
}

const ROLE = {
  ADMIN:'Quản trị hệ thống', ORGANIZATION_ADMIN:'Quản lý tổ chức',
  PROJECT_ADMIN:'Quản lý dự án', CITY_ADMIN:'Cán bộ tỉnh', WARD_ADMIN:'Cán bộ xã',
}

// ─── UI primitives ────────────────────────────────────────────────────────────
const Sk = ({h='h-4',w='w-full',r='rounded-lg'}) =>
  <div className={`animate-pulse bg-gray-100 ${r} ${h} ${w}`}/>

function Dot({color='gray', size='w-2.5 h-2.5', pulse=false}) {
  const c = H[color]
  return (
    <span className="relative flex shrink-0">
      {pulse && color==='red' && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-60`}/>}
      <span className={`relative inline-flex rounded-full ${size} ${c.dot}`}/>
    </span>
  )
}

// ─── ThresholdMeter ───────────────────────────────────────────────────────────
function Meter({value=0, thr, label, sub, delta, unit='%', loading}) {
  const color = hCol(value, thr)
  const c     = H[color]
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.bd}`}>
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
            <p className={`text-2xl font-bold font-manrope ${c.tx} leading-none mb-2`}>
              {value > 0 ? `${value}${unit}` : '—'}
            </p>
            <div className="relative h-1.5 bg-gray-200 rounded-full">
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{width:`${Math.min(value,100)}%`, background:c.bar}}/>
              {thr && (
                <div className="absolute top-[-3px] w-0.5 h-[9px] bg-gray-600 rounded-full"
                  style={{left:`${thr.good}%`}} title={`Ngưỡng tốt: ${thr.good}%`}/>
              )}
            </div>
            {sub && <p className="text-[11px] text-gray-400 font-inter mt-1.5 leading-tight">{sub}</p>}
          </>
      }
    </div>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
function AlertItem({severity='warning', title, detail, to}) {
  const cfg = {
    critical:{ icon:'🔴', bg:'bg-red-50',   bd:'border-red-200',   tx:'text-red-800',   badge:'Cần xử lý', bc:'bg-red-100 text-red-700' },
    warning: { icon:'🟡', bg:'bg-amber-50', bd:'border-amber-200', tx:'text-amber-800', badge:'Chú ý',    bc:'bg-amber-100 text-amber-700' },
    info:    { icon:'🔵', bg:'bg-blue-50',  bd:'border-blue-200',  tx:'text-blue-800',  badge:'Thông tin',bc:'bg-blue-100 text-blue-700' },
  }[severity]
  const inner = (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.bd} hover:opacity-90 transition-opacity`}>
      <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[13px] font-[600] font-manrope ${cfg.tx}`}>{title}</p>
          <span className={`text-[10px] font-[600] px-1.5 py-0.5 rounded-md ${cfg.bc}`}>{cfg.badge}</span>
        </div>
        {detail && <p className="text-[12px] text-gray-500 font-inter mt-0.5">{detail}</p>}
      </div>
      {to && <span className="text-[12px] text-link font-inter shrink-0 mt-0.5">→</span>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Finance card ─────────────────────────────────────────────────────────────
function FinCard({label, value, color, bg, border, loading}) {
  return (
    <div className={`rounded-xl border p-3.5 ${bg} ${border} flex items-center justify-between gap-3`}>
      <p className="text-[12px] text-gray-text font-inter">{label}</p>
      {loading
        ? <Sk h="h-6" w="w-32 shrink-0"/>
        : <p className={`text-base font-bold font-manrope shrink-0 ${color}`}>{value}</p>
      }
    </div>
  )
}

// ─── Impact card ──────────────────────────────────────────────────────────────
function ImpactCard({icon, value, label, sub, loading}) {
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

function Section({title, subtitle, to, children}) {
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

const ChartTip = ({active, payload, label}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-light-gray rounded-xl p-3 shadow-sm text-[12px] font-inter">
      <p className="font-[600] text-main-title mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: <strong>{fmtD(p.value)}</strong></p>)}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { infoUser, roleUser } = useAuthStore()
  // Default: tháng trước vì overview_report chỉ có data cho tháng đã kết thúc
  // (cron INSERT cuối tháng, tháng hiện tại chưa có record)
  const [period, setPeriod] = useState([
    dayjs().subtract(1,'month').startOf('month'),
    dayjs().subtract(1,'month').endOf('month'),
  ])

  const fromDate = period[0].format('YYYY-MM-DD')
  const toDate   = period[1].format('YYYY-MM-DD')
  const prevFrom = period[0].subtract(1,'month').startOf('month').format('YYYY-MM-DD')
  const prevTo   = period[0].subtract(1,'month').endOf('month').format('YYYY-MM-DD')

  // ── State: 2-phase loading ──────────────────────────────────────────────────
  const [kpi,     setKpi]     = useState({ activeGroups:0, totalGroups:0, activeMembers:0, totalMembers:0, avgPerGroup:0, activeGroupsPeriod:0 })
  const [finance, setFinance] = useState({ savings:0, disbursed:0, repaidCount:0, outstandingCount:0, interest:0, socialIn:0 })
  const [meal,    setMeal]    = useState({ repaymentRate:0, attendanceRate:0, activeMemberRate:0, meetingCoverage:0 })
  const [delta,   setDelta]   = useState({ repayment:0, attendance:0, activeMember:0 })
  const [alerts,  setAlerts]  = useState([])
  const [loanPurpose, setLoan]= useState([])
  const [recentMtg, setRecent]= useState([])
  const [loadingKpi, setLKpi] = useState(true)

  const [trend,       setTrend]   = useState([])
  const [loadingTrend,setLTrend]  = useState(true)

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

  // fetchReport: trả về data array trực tiếp
  const fetchReport = useCallback(async (from, to) => {
    try {
      const r = await httpAuth.get(`/reports?reportType=overview_report_v2&fromDate=${from}&toDate=${to}&${q()}&_start=0&_end=200`)
      return r?.payload?.data || []
    } catch { return [] }
  }, [q])

  // ── PHASE 1: KPI chính ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadKpi = async () => {
      setLKpi(true)
      try {
        // Tất cả parallel: 2 report calls + 3 API calls cùng lúc
        const [rptCurr, rptPrev, allGrpR, latMtgR, suggR] = await Promise.all([
          fetchReport(fromDate, toDate),
          fetchReport(prevFrom, prevTo),
          httpAuth.get(`/groups?${q()}`).catch(()=>null),
          httpAuth.get(`/meetings?${q({_start:0,_end:8})}`).catch(()=>null),
          httpAuth.get(`/notifications?type=CUSTOMER_SUPPORT&_start:0&_end=4`).catch(()=>null),
        ])

        const vt  = (r) => r?.payload?.total || 0
        const vd  = (r) => r?.payload?.data  || []
        const gv  = mkGv(rptCurr)
        const bs  = mkBs(rptCurr)
        const gvP = mkGv(rptPrev)
        const bsP = mkBs(rptPrev)

        // ── Section A values ──────────────────────────────────────────────
        const activeGroups       = gv('3')           // A-3 accumulated: nhóm đang HĐ lũy kế
        const activeGroupsPeriod = gv('3','value')   // A-3 value: nhóm HĐ trong kỳ
        const totalMembers       = gv('4')           // A-4 acc: TV mới lũy kế (proxy total)
        const activeMembers      = gv('6')           // A-6 acc: TV đang HĐ ✓
        const avgPerGroup        = gv('7')           // A-7: TB TV/nhóm
        const attendanceRate     = Math.round(gv('8')) // A-8: % họp nhóm ✓

        const totalGroups = vt(allGrpR) || activeGroups

        // ── Section B: BALANCE metrics → dùng 'value' (kỳ hiện tại) ─────
        // Lý do: accumulatedValue = SUM(all historical snapshots) = overcounts
        // meetings × nhóm lần. 'value' = snapshot kỳ này = gần đúng số dư thực.
        const savings = bs('B', '3', 'value')  // Tiết kiệm gốc cuối kỳ

        // ── Section B: FLOW metrics → dùng 'value' (kỳ hiện tại) ────────
        // Lý do: muốn hiện "Cho vay trong kỳ" không phải tổng lịch sử
        const disbursedPeriod = gv('13', 'value')   // B-13 value: vốn phát ra trong kỳ
        const interestPeriod  = gv('14.2', 'value') // B-14.2 value: lãi thu trong kỳ

        // ── Repayment: dùng COUNT (tin cậy hơn amount) ───────────────────
        // B-9: khoản đã hoàn trả hết; B-10: khoản chưa hoàn trả
        // Dùng 'value' (kỳ) thay accumulatedValue
        const repaidCount      = bs('B', '9',  'value')
        const outstandingCount = bs('B', '10', 'value')
        const repaymentRate    = (repaidCount + outstandingCount) > 0
          ? pct(repaidCount, repaidCount + outstandingCount) : 0

        // ── Section C: Quỹ tương trợ → dùng 'value' ─────────────────────
        const socialIn  = bs('C', '1', 'value')

        // ── MEAL rates ────────────────────────────────────────────────────
        const activeMemberRate = pct(activeMembers, totalMembers)
        const meetingCoverage  = pct(activeGroupsPeriod, activeGroups)

        // ── Previous period deltas ────────────────────────────────────────
        const prevActive     = gvP('6')
        const prevMembers    = gvP('4')
        const prevAttendance = Math.round(gvP('8'))
        const prevRepaid     = bsP('B','9','value')
        const prevOutstanding= bsP('B','10','value')
        const prevRepayment  = (prevRepaid+prevOutstanding) > 0 ? pct(prevRepaid, prevRepaid+prevOutstanding) : 0

        setKpi({ activeGroups, totalGroups, activeMembers, totalMembers, avgPerGroup, activeGroupsPeriod })
        setFinance({ savings, disbursed:disbursedPeriod, repaidCount, outstandingCount, interest:interestPeriod, socialIn })
        setMeal({ repaymentRate, attendanceRate, activeMemberRate, meetingCoverage })
        setDelta({
          repayment:    repaymentRate    - prevRepayment,
          attendance:   attendanceRate   - prevAttendance,
          activeMember: activeMemberRate - (prevMembers > 0 ? pct(prevActive, prevMembers) : 0),
        })

        // Loan purpose (amounts trong kỳ, gv safe vì IDs unique)
        setLoan([
          { name:'Khẩn cấp',  value:gv('13.1','value') },
          { name:'Kinh doanh',value:gv('13.2','value') },
          { name:'Tiêu dùng', value:gv('13.3','value') },
          { name:'Khác',      value:gv('13.4','value') },
        ])

        // Recent meetings
        setRecent(vd(latMtgR).map(m => ({
          ...m,
          _type:{first_meeting:'Đầu kỳ',last_meeting:'Cuối kỳ',regular_meeting:'Thường kỳ'}[m.meetingType]||m.meetingType,
          _cls: {first_meeting:'bg-purple-50 text-purple-700',last_meeting:'bg-blue-50 text-blue-700',regular_meeting:'bg-green-50 text-green-700'}[m.meetingType]||'bg-gray-50 text-gray-500',
        })))

        // Alerts
        const newAlerts = []
        if (repaymentRate > 0 && repaymentRate < THR.repayment.warn) {
          newAlerts.push({severity:'critical',
            title:`Tỉ lệ hoàn trả thấp: ${repaymentRate}%`,
            detail:`${fmtVN(outstandingCount)} khoản vay chưa hoàn trả. Ngưỡng an toàn: ${THR.repayment.warn}%.`,
            to:'/groups'})
        } else if (repaymentRate > 0 && repaymentRate < THR.repayment.good) {
          newAlerts.push({severity:'warning',
            title:`Tỉ lệ hoàn trả ${repaymentRate}% — chưa đạt ${THR.repayment.good}%`,
            detail:`${fmtVN(outstandingCount)} khoản còn dư nợ.`,
            to:'/groups'})
        }
        if (attendanceRate > 0 && attendanceRate < THR.attendance.warn) {
          newAlerts.push({severity:'warning',
            title:`Tỉ lệ tham dự cuộc họp thấp: ${attendanceRate}%`,
            detail:`Kiểm tra vắng mặt tại các nhóm. Mục tiêu: ${THR.attendance.good}%.`,
            to:'/meetings'})
        }
        if (meetingCoverage > 0 && meetingCoverage < THR.meetings.warn) {
          newAlerts.push({severity:'warning',
            title:`Chỉ ${meetingCoverage}% nhóm họp trong kỳ`,
            detail:`${fmtVN(activeGroups - activeGroupsPeriod)} nhóm chưa tổ chức họp.`,
            to:'/meetings'})
        }
        const suggCount = vd(suggR).length
        if (suggCount > 0) {
          newAlerts.push({severity:'info',
            title:`${suggCount} góp ý người dùng chưa xem`,
            detail:'Phản hồi cần xử lý kịp thời.',
            to:'/messages?type=CUSTOMER_SUPPORT'})
        }
        setAlerts(newAlerts)

      } catch(e) {
        console.error('[Dashboard KPI]', e)
      } finally {
        setLKpi(false)
      }
    }
    loadKpi()
  }, [fromDate, toDate, prevFrom, prevTo, q, fetchReport])

  // ── PHASE 2: Trend (6 report calls parallel, không block Phase 1) ──────────
  useEffect(() => {
    const loadTrend = async () => {
      setLTrend(true)
      const now = dayjs()
      const months = Array.from({length:6}, (_,i) => {
        const m = now.subtract(5-i,'month')
        return { label:m.format('MM/YY'), from:m.startOf('month').format('YYYY-MM-DD'), to:m.endOf('month').format('YYYY-MM-DD') }
      })
      try {
        // Tất cả 6 calls parallel
        const results = await Promise.all(months.map(m => fetchReport(m.from, m.to)))
        setTrend(months.map((m,i) => {
          const d   = results[i]
          const g   = mkGv(d)
          const bsc = mkBs(d)
          return {
            month:       m.label,
            'Tiết kiệm': bsc('B','3','value'),    // value kỳ: số dư tiết kiệm tháng đó
            'Cho vay':   g('13','value'),          // value kỳ: vốn phát ra tháng đó
            'Thu hồi':   g('14.2','value'),        // value kỳ: lãi thu tháng đó
          }
        }))
      } catch(e) {
        console.error('[Dashboard Trend]', e)
      } finally {
        setLTrend(false)
      }
    }
    loadTrend()
  }, [fromDate, toDate, q, fetchReport])

  // ── Computed ──────────────────────────────────────────────────────────────
  const loanTotal = loanPurpose.reduce((s,d) => s+d.value, 0)
  const hasTrend  = trend.some(d => d['Tiết kiệm']>0 || d['Cho vay']>0)
  const overallH  = useMemo(() => {
    const s = [hCol(meal.repaymentRate,THR.repayment), hCol(meal.attendanceRate,THR.attendance), hCol(meal.activeMemberRate,THR.activeMember)]
    if (s.some(x=>x==='red'))   return 'red'
    if (s.some(x=>x==='amber')) return 'amber'
    if (s.every(x=>x==='green'))return 'green'
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
            <Dot color={overallH} size="w-3 h-3" pulse={overallH==='red'}/>
            <h1 className="text-[18px] font-bold font-manrope text-main-title">
              {ROLE[infoUser?.role] || 'Dashboard'}
            </h1>
            {!loadingKpi && alerts.filter(a=>a.severity!=='info').length > 0 && (
              <span className="text-[11px] font-[700] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {alerts.filter(a=>a.severity!=='info').length} cảnh báo
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
          <span className="text-[11px] text-gray-400 font-inter">Tự động cập nhật</span>
        </div>
        {loadingKpi
          ? <div className="space-y-2"><Sk h="h-14"/><Sk h="h-14"/></div>
          : alerts.length === 0
          ? <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
              <span>✅</span>
              <p className="text-[13px] font-[500] font-inter text-green-700">Không có vấn đề nổi bật — các chỉ số ổn định.</p>
            </div>
          : <div className="space-y-2">{alerts.map((a,i) => <AlertItem key={i} {...a}/>)}</div>
        }
      </div>

      {/* ── IMPACT ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">Phạm vi tác động</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ImpactCard icon="🏘️"
            value={fmtVN(kpi.activeGroups)}
            label="Nhóm VSLA đang hoạt động"
            sub={`/ ${fmtVN(kpi.totalGroups)} tổng · TB ${Math.round(kpi.avgPerGroup)} TV/nhóm`}
            loading={loadingKpi}/>
          <ImpactCard icon="👥"
            value={fmtVN(kpi.activeMembers)}
            label="Thành viên hoạt động"
            sub={`/ ${fmtVN(kpi.totalMembers)} lũy kế tham gia`}
            loading={loadingKpi}/>
          <ImpactCard icon="💰"
            value={fmtD(finance.savings)}
            label="Tiết kiệm cổ phần kỳ này"
            sub={kpi.activeMembers > 0 && finance.savings > 0
              ? `${fmtD(finance.savings / kpi.activeMembers)}/người`
              : 'Số dư ước tính cuối kỳ'}
            loading={loadingKpi}/>
          <ImpactCard icon="🏦"
            value={fmtD(finance.disbursed)}
            label="Vốn phát ra trong kỳ"
            sub={finance.outstandingCount > 0
              ? `${fmtVN(finance.outstandingCount)} khoản chưa hoàn trả`
              : finance.disbursed > 0 ? 'Tất cả khoản đã hoàn trả' : undefined}
            loading={loadingKpi}/>
        </div>
      </div>

      {/* ── MEAL SCORECARD ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">
          Chỉ số MEAL — kỳ {period[0].format('MM/YYYY')}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Meter value={meal.repaymentRate}    thr={THR.repayment}
            label="Tỉ lệ hoàn trả khoản vay"
            sub={`${fmtVN(finance.repaidCount)} hoàn trả / ${fmtVN(finance.repaidCount + finance.outstandingCount)} khoản`}
            delta={delta.repayment} loading={loadingKpi}/>
          <Meter value={meal.attendanceRate}   thr={THR.attendance}
            label="Tỉ lệ tham dự cuộc họp"
            sub={`Ngưỡng tốt: ${THR.attendance.good}%`}
            delta={delta.attendance} loading={loadingKpi}/>
          <Meter value={meal.activeMemberRate} thr={THR.activeMember}
            label="Thành viên hoạt động"
            sub={`${fmtVN(kpi.activeMembers)} / ${fmtVN(kpi.totalMembers)}`}
            delta={delta.activeMember} loading={loadingKpi}/>
          <Meter value={meal.meetingCoverage}  thr={THR.meetings}
            label="Nhóm có họp trong kỳ"
            sub={`${fmtVN(kpi.activeGroupsPeriod)} / ${fmtVN(kpi.activeGroups)} nhóm`}
            loading={loadingKpi}/>
        </div>
      </div>

      {/* ── FINANCIAL HEALTH + TREND ─────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-[600] text-gray-400 uppercase tracking-wider mb-2 px-1">Sức khỏe tài chính</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          <div className="space-y-2.5">
            <FinCard label="Tiết kiệm cổ phần kỳ này"
              value={fmtD(finance.savings)}
              color="text-green-700" bg="bg-green-50" border="border-green-200" loading={loadingKpi}/>
            <FinCard label="Vốn cho vay trong kỳ"
              value={fmtD(finance.disbursed)}
              color="text-orange-bg" bg="bg-orange-50" border="border-orange-200" loading={loadingKpi}/>
            <FinCard label="Lãi thu được trong kỳ"
              value={fmtD(finance.interest)}
              color="text-blue-700" bg="bg-blue-50" border="border-blue-200" loading={loadingKpi}/>
            <FinCard label="Thu quỹ tương trợ trong kỳ"
              value={fmtD(finance.socialIn)}
              color="text-purple-700" bg="bg-purple-50" border="border-purple-200" loading={loadingKpi}/>
          </div>

          {/* Trend — Phase 2 loading riêng biệt */}
          <div className="xl:col-span-2">
            <Section title="Xu hướng tài chính 6 tháng"
              subtitle="Tiết kiệm · Cho vay · Lãi thu (đơn vị: đồng, kỳ từng tháng)">
              {loadingTrend ? (
                <div className="flex flex-col items-center justify-center h-52 gap-3">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-bg border-t-transparent rounded-full"/>
                  <p className="text-[12px] text-gray-400 font-inter">Đang tải dữ liệu 6 tháng...</p>
                </div>
              ) : !hasTrend ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="font-inter text-[14px]">Chưa có dữ liệu tài chính</p>
                  <p className="font-inter text-[12px] mt-1">Dữ liệu cập nhật cuối mỗi tháng</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trend} margin={{top:5,right:5,left:0,bottom:0}}>
                    <defs>
                      {[['s','#16A34A'],['d','#E4701E'],['i','#4079ED']].map(([id,c]) => (
                        <linearGradient key={id} id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={c} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={c} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                    <XAxis dataKey="month" tick={{fontSize:11,fontFamily:'Inter',fill:'#484746'}}/>
                    <YAxis tickFormatter={v=>fmtM(v)} tick={{fontSize:10,fontFamily:'Inter',fill:'#484746'}} width={60}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Area type="monotone" dataKey="Tiết kiệm" stroke="#16A34A" fill="url(#gs)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Cho vay"   stroke="#E4701E" fill="url(#gd)" strokeWidth={2} dot={false}/>
                    <Area type="monotone" dataKey="Thu hồi"   stroke="#4079ED" fill="url(#gi)" strokeWidth={2} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>
        </div>
      </div>

      {/* ── LOAN PURPOSE + MEETINGS ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Section title="Cho vay theo mục đích"
          subtitle={loanTotal > 0 ? `Tổng ${fmtD(loanTotal)} trong kỳ` : 'Kỳ này'}>
          {loadingKpi ? <Sk h="h-44"/> : loanTotal === 0 ? (
            <p className="text-center text-gray-400 font-inter text-[13px] py-8">Chưa có dữ liệu cho vay kỳ này</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={loanPurpose} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5"/>
                  <XAxis dataKey="name" tick={{fontSize:10,fontFamily:'Inter',fill:'#484746'}}/>
                  <YAxis tickFormatter={v=>fmtM(v)} tick={{fontSize:9,fontFamily:'Inter',fill:'#484746'}}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="value" name="Giá trị" radius={[5,5,0,0]}>
                    {loanPurpose.map((_,i) => <Cell key={i} fill={['#16A34A','#E4701E','#4079ED','#9333EA'][i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {loanPurpose.filter(d=>d.value>0).map((d,i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full shrink-0"
                      style={{background:['#16A34A','#E4701E','#4079ED','#9333EA'][i], width:`${pct(d.value,loanTotal)}%`, minWidth:4}}/>
                    <span className="text-[11px] text-gray-400 font-inter shrink-0">
                      {d.name} — {fmtD(d.value)} ({pct(d.value,loanTotal)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <div className="xl:col-span-2">
          <Section title="Cuộc họp gần nhất" to="/meetings">
            {loadingKpi
              ? <div className="space-y-2">{[...Array(5)].map((_,i)=><Sk key={i} h="h-14"/>)}</div>
              : recentMtg.length === 0
              ? <p className="text-center text-gray-400 font-inter text-[13px] py-6">Chưa có cuộc họp nào</p>
              : (
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
                          <span className={`text-[10px] font-[600] px-2 py-0.5 rounded-full font-inter shrink-0 ${m._cls}`}>
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
              )
            }
          </Section>
        </div>
      </div>

    </div>
  )
}